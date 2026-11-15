import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

// Must run after AdminAuthGuard. Only the super admin can create/manage other
// admins and their permissions - a deliberately separate, stricter check from
// PermissionGuard's per-section flags.
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.admin?.is_super_admin) {
      throw new ForbiddenException('Super admin privileges required');
    }
    return true;
  }
}
