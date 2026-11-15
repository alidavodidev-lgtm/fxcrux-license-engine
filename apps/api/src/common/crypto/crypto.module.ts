import { Module } from '@nestjs/common';
import { RsaHybridService } from './rsa-hybrid.service';
import { LicenseSigningService } from './license-signing.service';

@Module({
  providers: [RsaHybridService, LicenseSigningService],
  exports: [RsaHybridService, LicenseSigningService],
})
export class CryptoModule {}
