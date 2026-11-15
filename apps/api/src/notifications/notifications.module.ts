import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { Admin } from '../admin/admin.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { AdminAccessModule } from '../common/guards/admin-access.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, Admin]), AdminAccessModule],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
