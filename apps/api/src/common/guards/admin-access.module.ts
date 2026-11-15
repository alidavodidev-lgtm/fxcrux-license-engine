import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../../admin/admin.entity';
import { AdminAuthGuard } from './admin-auth.guard';
import { PermissionGuard } from './permission.guard';
import { SuperAdminGuard } from './super-admin.guard';

// Shared by every module whose controllers use AdminAuthGuard/PermissionGuard/
// SuperAdminGuard - those guards need the Admin repository injected, so any
// module using them must import this one (same pattern as CryptoModule).
@Module({
  imports: [TypeOrmModule.forFeature([Admin])],
  providers: [AdminAuthGuard, PermissionGuard, SuperAdminGuard],
  exports: [AdminAuthGuard, PermissionGuard, SuperAdminGuard, TypeOrmModule],
})
export class AdminAccessModule {}
