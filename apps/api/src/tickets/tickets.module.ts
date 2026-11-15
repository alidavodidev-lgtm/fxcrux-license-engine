import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './ticket.entity';
import { TicketMessage } from './ticket-message.entity';
import { TicketGroup } from './ticket-group.entity';
import { User } from '../users/user.entity';
import { Admin } from '../admin/admin.entity';
import { TicketsService } from './tickets.service';
import { TicketsCronService } from './tickets-cron.service';
import { TicketsController } from './tickets.controller';
import { AdminAccessModule } from '../common/guards/admin-access.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, TicketMessage, TicketGroup, User, Admin]), AdminAccessModule, AuditLogModule, NotificationsModule, SettingsModule],
  providers: [TicketsService, TicketsCronService],
  controllers: [TicketsController],
})
export class TicketsModule {}
