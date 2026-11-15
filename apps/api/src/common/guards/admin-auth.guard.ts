import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from '../../admin/admin.entity';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Admin) private readonly adminRepository: Repository<Admin>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing admin token');
    }

    const token = authHeader.slice('Bearer '.length);

    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }

    if (payload.role !== 'admin') {
      throw new UnauthorizedException('Admin privileges required');
    }

    // Never trust is_active/permissions from the token itself - a permission
    // change or deactivation must take effect on the very next request, not
    // wait until the token expires.
    const admin = await this.adminRepository.findOne({ where: { id: payload.sub } });
    if (!admin || !admin.is_active) {
      throw new UnauthorizedException('Invalid or expired admin token');
    }

    // Single-session enforcement: a later login bumps session_version, which
    // immediately invalidates every token issued before it.
    if (payload.sv !== admin.session_version) {
      throw new UnauthorizedException('Session invalidated - logged in elsewhere');
    }

    request.admin = {
      id: admin.id,
      username: admin.username,
      is_super_admin: admin.is_super_admin,
      permissions: admin.permissions,
    };
    return true;
  }
}
