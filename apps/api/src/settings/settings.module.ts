import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { SystemSettings } from './system-settings.entity';
import { AdminAccessModule } from '../common/guards/admin-access.module';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSettings]), AdminAccessModule],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
