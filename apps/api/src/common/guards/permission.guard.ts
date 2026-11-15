import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

// Must run after AdminAuthGuard (which attaches the fresh `request.admin` record).
// Super admins bypass this entirely; everyone else needs the specific section
// flag set to true on their own permissions record.
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const admin = request.admin;
    if (!admin) throw new ForbiddenException('Admin identity missing');
    if (admin.is_super_admin) return true;

    if (!admin.permissions?.[required]) {
      throw new ForbiddenException(`You don't have access to ${required}`);
    }
    return true;
  }
}
