import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from './admin.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminAccessModule } from '../common/guards/admin-access.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Admin]), AdminAccessModule, AuditLogModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}