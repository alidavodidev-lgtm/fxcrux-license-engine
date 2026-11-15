import { SetMetadata } from '@nestjs/common';
import { AdminPermissions } from '../../admin/admin.entity';

export const PERMISSION_KEY = 'requiredPermission';

// Marks a route as requiring a specific admin permission section. Must be paired
// with @UseGuards(AdminAuthGuard, PermissionGuard) - AdminAuthGuard attaches the
// fresh admin record (incl. permissions) that PermissionGuard then checks.
export const RequirePermission = (section: keyof Omit<AdminPermissions, 'ticketGroupIds'>) =>
  SetMetadata(PERMISSION_KEY, section);
