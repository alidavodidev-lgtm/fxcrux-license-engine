import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // DB-backed on purpose (not stateless): a status/ban change or a login from
  // another device must take effect on the very next request, not wait until
  // the token expires. Never trust status/session-version from the token itself.
  async validate(payload: any) {
    const user = await this.usersRepository.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (user.status === 'BANNED') {
      throw new UnauthorizedException('Account has been banned');
    }
    // Single-session enforcement: a later login bumps session_version, which
    // immediately invalidates every token issued before it.
    if (payload.sv !== user.session_version) {
      throw new UnauthorizedException('Session invalidated - logged in elsewhere');
    }
    return { userId: user.id, email: user.email, status: user.status };
  }
}
