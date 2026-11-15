import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductVersionsService } from './product-versions.service';
import { ProductVersionsController } from './product-versions.controller';
import { Product } from './product.entity';
import { ProductPricingTier } from './product-pricing-tier.entity';
import { ProductGroup } from './product-group.entity';
import { ProductVersion } from './product-version.entity';
import { ProductVersionAccess } from './product-version-access.entity';
import { License } from '../licenses/license.entity';
import { User } from '../users/user.entity';
import { AdminAccessModule } from '../common/guards/admin-access.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SettingsModule } from '../settings/settings.module';
import { CryptoModule } from '../common/crypto/crypto.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductPricingTier, ProductGroup, License, ProductVersion, ProductVersionAccess, User]),
    AdminAccessModule,
    AuditLogModule,
    SettingsModule,
    CryptoModule,
  ],
  providers: [ProductsService, ProductVersionsService],
  controllers: [ProductsController, ProductVersionsController],
  exports: [ProductsService],
})
export class ProductsModule {}