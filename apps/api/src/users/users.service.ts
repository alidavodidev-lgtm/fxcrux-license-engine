import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import * as bcrypt from 'bcrypt';

interface ActingAdmin {
  id: string;
  username: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<any> {
    const { username, email, password } = createUserDto;

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = this.usersRepository.create({
      username,
      email,
      password_hash,
    });

    try {
      const savedUser = await this.usersRepository.save(user);

      const { password_hash: _hash, ...safeUser } = savedUser;

      return { message: 'User registered successfully', user: safeUser };
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Username or email already exists');
      } else {
        throw new InternalServerErrorException('Server error during user registration');
      }
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

async changePassword(userId: string, newPass: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    user.password_hash = await bcrypt.hash(newPass, 10);
    const saved = await this.usersRepository.save(user);

    this.auditLogService.record({
      actorType: 'USER', actorId: user.id, actorLabel: user.username,
      action: 'USER_PASSWORD_CHANGED',
    });

    return saved;
  }

async getProfile(userId: string) {
  return this.usersRepository.findOne({ where: { id: userId } });
}

async updateUser(id: string, updateData: { username?: string; email?: string; password?: string }, actingAdmin: ActingAdmin) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (updateData.username) user.username = updateData.username;
    if (updateData.email) user.email = updateData.email;
    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      user.password_hash = await bcrypt.hash(updateData.password, salt);
    }

    let saved: User;
    try {
      saved = await this.usersRepository.save(user);
    } catch (error) {
      throw new ConflictException('Username or email already exists');
    }

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'USER_UPDATED', targetType: 'User', targetId: saved.id, targetLabel: saved.username,
      metadata: { username_changed: !!updateData.username, email_changed: !!updateData.email, password_changed: !!updateData.password },
    });

    return saved;
  }

  // Required for the toggleUserStatus controller
  async toggleStatus(userId: string, actingAdmin: ActingAdmin) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If user is PENDING, approve them to ACTIVE. Otherwise toggle between ACTIVE and BANNED.
    if (user.status === 'PENDING') {
      user.status = 'ACTIVE';
    } else {
      user.status = user.status === 'BANNED' ? 'ACTIVE' : 'BANNED';
    }

    const saved = await this.usersRepository.save(user);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'USER_STATUS_CHANGED', targetType: 'User', targetId: saved.id, targetLabel: saved.username,
      metadata: { status: saved.status },
    });

    return saved;
  }

  async findAllUsers() {
    return this.usersRepository.find({
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        machine_id: true,
        created_at: true
      },
      order: { created_at: 'DESC' }
    });
  }
}