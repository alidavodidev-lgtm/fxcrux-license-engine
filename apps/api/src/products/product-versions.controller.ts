import {
  Controller, Post, Delete, Body, Get, Param, Query, ValidationPipe, UseGuards, Request,
  UseInterceptors, UploadedFile, BadRequestException, UnauthorizedException, Res, StreamableFile,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { ProductVersionsService } from './product-versions.service';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateVersionDto } from './dto/update-version.dto';
import { AssignVersionUsersDto } from './dto/assign-version-users.dto';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { imageUploadOptions } from '../common/upload/image-upload.options';
import { fileUploadOptions } from '../common/upload/file-upload.options';
import { publicUploadUrl } from '../common/upload/upload-url.util';
import { SettingsService } from '../settings/settings.service';
import { RsaHybridService } from '../common/crypto/rsa-hybrid.service';

// Same hard ceilings as ProductsController - the live, admin-configurable
// limits are the same product image/file settings, reused here rather than
// adding a second, near-duplicate settings pair.
const VERSION_ICON_HARD_CAP_BYTES = 5 * 1024 * 1024;
const VERSION_INSTALLER_HARD_CAP_BYTES = 500 * 1024 * 1024;

@Controller('products')
export class ProductVersionsController {
  constructor(
    private readonly versionsService: ProductVersionsService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly rsaHybrid: RsaHybridService,
  ) {}

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Get(':id/versions')
  async listVersions(@Param('id') id: string) {
    return this.versionsService.listVersions(id);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post(':id/versions/create')
  async createVersion(@Request() req, @Param('id') id: string, @Body(ValidationPipe) dto: CreateVersionDto) {
    return this.versionsService.createVersion(id, dto, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post('versions/update')
  async updateVersion(@Request() req, @Body(ValidationPipe) dto: UpdateVersionDto) {
    const { id, ...rest } = dto;
    return this.versionsService.updateVersion(id, rest, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Delete('versions/:versionId')
  async deleteVersion(@Request() req, @Param('versionId') versionId: string) {
    return this.versionsService.deleteVersion(versionId, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post('versions/:versionId/installer')
  @UseInterceptors(FileInterceptor('installer', fileUploadOptions('product-version-files', VERSION_INSTALLER_HARD_CAP_BYTES)))
  async uploadInstaller(@Request() req, @UploadedFile() file: Express.Multer.File, @Param('versionId') versionId: string) {
    if (!file) throw new BadRequestException('Installer file is required');

    const { productFileMaxBytes } = await this.settingsService.getUploadLimits();
    if (file.size > productFileMaxBytes) {
      await unlink(file.path).catch(() => {});
      throw new BadRequestException(`File must be under ${Math.floor(productFileMaxBytes / (1024 * 1024))}MB`);
    }

    return this.versionsService.setInstaller(versionId, file.originalname, file.filename, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Delete('versions/:versionId/installer')
  async removeInstaller(@Request() req, @Param('versionId') versionId: string) {
    return this.versionsService.removeInstaller(versionId, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post('versions/:versionId/icon')
  @UseInterceptors(FileInterceptor('icon', imageUploadOptions('product-version-icons', VERSION_ICON_HARD_CAP_BYTES)))
  async uploadIcon(@Request() req, @UploadedFile() file: Express.Multer.File, @Param('versionId') versionId: string) {
    if (!file) throw new BadRequestException('Icon file is required');

    const { productImageMaxBytes } = await this.settingsService.getUploadLimits();
    if (file.size > productImageMaxBytes) {
      await unlink(file.path).catch(() => {});
      throw new BadRequestException(`Image must be under ${Math.floor(productImageMaxBytes / 1024)}KB`);
    }

    return this.versionsService.setIcon(versionId, publicUploadUrl(this.configService, 'product-version-icons', file.filename), req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Delete('versions/:versionId/icon')
  async removeIcon(@Request() req, @Param('versionId') versionId: string) {
    return this.versionsService.removeIcon(versionId, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Get('versions/:versionId/users')
  async getUsersForAccessPicker(@Param('versionId') versionId: string) {
    return this.versionsService.getUsersForAccessPicker(versionId);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post('versions/:versionId/set-all-users')
  async setAllUsersAccess(@Request() req, @Param('versionId') versionId: string) {
    return this.versionsService.setAllUsersAccess(versionId, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post('versions/:versionId/assign-users')
  async assignSpecificUsers(@Request() req, @Param('versionId') versionId: string, @Body(ValidationPipe) dto: AssignVersionUsersDto) {
    return this.versionsService.assignSpecificUsers(versionId, dto.userIds, req.admin);
  }

  // --- Engine-facing (machine-id auth, no admin/user JWT) ---

  // Called by the Engine on behalf of a trading terminal - same RSA+AES
  // envelope as /licenses/check-by-machine, no DTO since the body is opaque ciphertext.
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('versions/check-by-machine')
  async checkVersionByMachine(
    @Body('payload') payload: string,
    @Body('key') key: string,
    @Body('iv') iv: string,
  ) {
    if (!payload || !key || !iv) throw new UnauthorizedException('Missing secure payload');

    const { data } = this.rsaHybrid.decryptPayload(payload, key, iv);
    const { MachineID, ProductName, Timestamp } = data;

    if (!MachineID || !ProductName || !Timestamp) throw new UnauthorizedException('Invalid payload structure');

    this.rsaHybrid.validateTimestamp(Timestamp);

    return this.versionsService.checkVersionByMachine(MachineID, ProductName);
  }

  // Short-lived signed token from checkVersionByMachine() gates this - the
  // actual bytes stream over plain HTTPS rather than through the AES
  // envelope, which isn't designed for multi-hundred-MB payloads.
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('versions/download')
  async downloadVersion(@Query('token') token: string, @Res({ passthrough: true }) res: Response) {
    if (!token) throw new UnauthorizedException('Missing download token');
    const { filePath, filename } = await this.versionsService.getDownloadInfoByToken(token);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    return new StreamableFile(createReadStream(filePath));
  }
}
