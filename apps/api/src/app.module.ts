import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { LicensesModule } from './licenses/licenses.module';
import { Product } from './products/product.entity';
import { ProductPricingTier } from './products/product-pricing-tier.entity';
import { ProductGroup } from './products/product-group.entity';
import { ProductVersion } from './products/product-version.entity';
import { ProductVersionAccess } from './products/product-version-access.entity';
import { License } from './licenses/license.entity';
import { LicenseLog } from './licenses/license-log.entity';
import { AdminModule } from './admin/admin.module';
import { Admin } from './admin/admin.entity';

import { PurchasesModule } from './purchases/purchases.module';
import { Wallet } from './purchases/wallet.entity';
import { Purchase } from './purchases/purchase.entity';
import { Order } from './purchases/order.entity';
import { TicketsModule } from './tickets/tickets.module';
import { Ticket } from './tickets/ticket.entity';
import { TicketMessage } from './tickets/ticket-message.entity';
import { TicketGroup } from './tickets/ticket-group.entity';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuditLog } from './audit-log/audit-log.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { Notification } from './notifications/notification.entity';
import { CartModule } from './cart/cart.module';
import { CartItem } from './cart/cart-item.entity';
import { SettingsModule } from './settings/settings.module';
import { SystemSettings } from './settings/system-settings.entity';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    // 20/min was fine before polling existed, but every admin/client request is
    // proxied server-side through 127.0.0.1, so this budget is shared across
    // ALL concurrent admins/users - the new live-polling pages blew past it in
    // seconds, causing intermittent 429s that looked like lost permissions
    // (the frontend treats a non-ok /admin/me as "no admin"). The genuinely
    // sensitive endpoints (login, hardware-login, license validate/check-by-machine)
    // already have their own tighter per-route @Throttle overrides, which take
    // precedence over this default - raising it only loosens the blanket budget
    // for authenticated read/poll traffic, not those.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 600 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [User, Product, ProductPricingTier, ProductGroup, ProductVersion, ProductVersionAccess, License, LicenseLog, Wallet, Purchase, Order, Admin, Ticket, TicketMessage, TicketGroup, AuditLog, Notification, CartItem, SystemSettings],
        synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
      }),
    }),
    UsersModule,
    AuthModule,
    ProductsModule,
    LicensesModule,
    PurchasesModule,
    AdminModule,
    TicketsModule,
    AuditLogModule,
    NotificationsModule,
    CartModule,
    SettingsModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
