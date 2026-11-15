import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Purchase } from '../purchases/purchase.entity';
import { Order } from '../purchases/order.entity';
import { User } from '../users/user.entity';
import { License } from '../licenses/license.entity';
import { Ticket } from '../tickets/ticket.entity';
import { TicketGroup } from '../tickets/ticket-group.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { AdminAccessModule } from '../common/guards/admin-access.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase, Order, User, License, Ticket, TicketGroup, AuditLog]),
    AdminAccessModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
