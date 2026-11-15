import { Body, Controller, Get, Patch, Request, UseGuards, ValidationPipe } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Any authenticated admin can read the current limits (nothing sensitive in
  // these two integers) - only mutation is super-admin gated.
  @UseGuards(AdminAuthGuard)
  @Get()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @UseGuards(AdminAuthGuard, SuperAdminGuard)
  @Patch()
  async updateSettings(@Request() req, @Body(ValidationPipe) body: UpdateSettingsDto) {
    return this.settingsService.updateSettings(body, req.admin);
  }

  // Unguarded - just upload ceilings, needed by the user-facing client app's
  // ticket pages too. Matches the existing pattern of GET /products being public.
  @Get('public-limits')
  async getPublicLimits() {
    return this.settingsService.getUploadLimits();
  }
}
