import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LicensesService } from './licenses.service';
import { LicensesController } from './licenses.controller';
import { License } from './license.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { LicenseLog } from './license-log.entity';
import { CryptoModule } from '../common/crypto/crypto.module';
import { AdminAccessModule } from '../common/guards/admin-access.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([License, User, Product, LicenseLog]), CryptoModule, AdminAccessModule, AuditLogModule],
  providers: [LicensesService],
  controllers: [LicensesController],
    exports: [LicensesService],
})
export class LicensesModule {}