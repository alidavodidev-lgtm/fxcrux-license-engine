import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './wallet.entity';
import { Purchase } from './purchase.entity';
import { Order } from './order.entity';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { LicensesModule } from '../licenses/licenses.module';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { ProductPricingTier } from '../products/product-pricing-tier.entity';
import { License } from '../licenses/license.entity';
import { AdminAccessModule } from '../common/guards/admin-access.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, Purchase, Order, User, Product, ProductPricingTier, License]),
    LicensesModule,
    AdminAccessModule,
    AuditLogModule,
    NotificationsModule,
    CartModule,
  ],
  providers: [PurchasesService],
  controllers: [PurchasesController],
})
export class PurchasesModule {}