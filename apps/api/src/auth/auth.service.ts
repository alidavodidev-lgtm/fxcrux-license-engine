import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.entity';
import { RsaHybridService } from '../common/crypto/rsa-hybrid.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly rsaHybrid: RsaHybridService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async hardwareLogin(encryptedPayload: string, encryptedAesKey: string, ivBase64: string) {
    try {
      const { data: payloadData, rawAesKey } = this.rsaHybrid.decryptPayload(encryptedPayload, encryptedAesKey, ivBase64);
      const { username, password, machine_code, nonce } = payloadData;

      const user = await this.usersRepository.findOne({
        where: { username },
        select: { id: true, username: true, password_hash: true, machine_id: true, status: true, terminal_pairing_secret: true },
      });
      if (!user) throw new Error('User not found');

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) throw new Error('Invalid password');

      if (!user.machine_id) {
        user.machine_id = machine_code;
        console.log(`[Gatekeeper] Hardware bound for user: ${username}`);
        this.auditLogService.record({
          actorType: 'USER', actorId: user.id, actorLabel: user.username,
          action: 'USER_HARDWARE_BOUND', targetType: 'User', targetId: user.id, targetLabel: user.username,
          metadata: { old_machine_id: null, new_machine_id: machine_code },
        });
      } else if (user.machine_id !== machine_code) {
        console.log(`[Gatekeeper] SECURITY ALERT: Hardware mismatch for user: ${username}`);
        throw new Error('Hardware mismatch. Account locked to another device.');
      }

      // Minted once per account, never shipped as a global constant - see
      // User.terminal_pairing_secret. Every subsequent hardware-login just
      // returns the same value so the Engine can keep it cached locally.
      // Held in a local variable rather than re-read from `user`/save()'s
      // return value afterward - avoids any ambiguity around how TypeORM's
      // save() reconciles a partial-select entity with a select:false column,
      // which is what caused this field to come back empty in practice.
      let pairingSecret = user.terminal_pairing_secret;
      if (!pairingSecret) {
        pairingSecret = randomBytes(24).toString('hex');
        user.terminal_pairing_secret = pairingSecret;
      }

      await this.usersRepository.save(user);

      return this.rsaHybrid.encryptResponse({
        status: 'success',
        nonce: nonce,
        message: 'Hardware authenticated.',
        terminalPairingSecret: pairingSecret,
      }, rawAesKey);

    } catch (error: any) {
      console.error('Hardware Login Error:', error.message);
      throw new UnauthorizedException('Authentication failed or hardware mismatch.');
    }
  }

    async checkHardwareStatus(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    return {
      is_bound: !!user.machine_id,
      username: user.username
    };
  }

  async register(email: string, username: string, pass: string) {
    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { username }]
    });
    if (existingUser) {
      throw new BadRequestException('Username or email already exists');
    }
    const hash = await bcrypt.hash(pass, 10);
    const newUser = this.usersRepository.create({ email, username, password_hash: hash });
    const saved = await this.usersRepository.save(newUser);

    this.auditLogService.record({
      actorType: 'USER', actorId: saved.id, actorLabel: saved.username,
      action: 'USER_REGISTERED', targetType: 'User', targetId: saved.id, targetLabel: saved.username,
    });

    return { success: true, message: 'User registered successfully' };
  }

  async login(username: string, pass: string, rememberMe?: boolean) {
    const user = await this.usersRepository.findOne({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Fail-safe: Prevent bcrypt crash if pass is missing or user has no hashed password in DB
    if (!pass || !user.password_hash) {
      console.error(`[Security] Login attempt with missing password data for user: ${username}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(pass, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Bump session_version so any previously-issued token for this account is
    // invalidated on its next request - enforces a single active session.
    user.session_version = (user.session_version ?? 1) + 1;
    await this.usersRepository.save(user);

    const access_token = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        status: user.status,
        sv: user.session_version,
      },
      { expiresIn: rememberMe ? '30d' : '10h' },
    );

    this.auditLogService.record({
      actorType: 'USER', actorId: user.id, actorLabel: user.username,
      action: 'USER_LOGIN',
    });

    return { success: true, username: user.username, access_token };
  }
}