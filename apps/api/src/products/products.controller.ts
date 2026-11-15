import { Controller, Post, Delete, Body, Get, Param, ValidationPipe, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException, Res, StreamableFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateTierDto } from './dto/create-tier.dto';
import { UpdateTierDto } from './dto/update-tier.dto';
import { CreateProductGroupDto } from './dto/create-product-group.dto';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { imageUploadOptions } from '../common/upload/image-upload.options';
import { fileUploadOptions } from '../common/upload/file-upload.options';
import { publicUploadUrl } from '../common/upload/upload-url.util';
import { SettingsService } from '../settings/settings.service';

// Generous hard ceilings for multer itself - the real, admin-configurable
// limits are enforced after upload via SettingsService (see uploadImage()/
// uploadFile()), since FileInterceptor's own limits.fileSize is fixed at
// decoration time and can't read a live DB value per request.
const PRODUCT_IMAGE_HARD_CAP_BYTES = 5 * 1024 * 1024;
const PRODUCT_FILE_HARD_CAP_BYTES = 500 * 1024 * 1024;

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post('create')
  async createProduct(@Request() req, @Body(ValidationPipe) createProductDto: CreateProductDto) {
    return this.productsService.createProduct(createProductDto, req.admin);
  }

  // New endpoint to handle updates
  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post('update')
  async updateProduct(@Request() req, @Body() body: UpdateProductDto) {
    const { id, ...updateData } = body;
    return this.productsService.updateProduct(id, updateData, req.admin);
  }

  @Get()
  async findAll() {
    return this.productsService.findAll();
  }

  @Get('list')
  async getAllProducts() {
    return this.productsService.findAll();
  }

  @Get('groups')
  async getActiveGroups() {
    return this.productsService.getActiveGroups();
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Get('groups/all')
  async getAllGroups() {
    return this.productsService.getAllGroups();
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post('groups/create')
  async createGroup(@Request() req, @Body() body: CreateProductGroupDto) {
    return this.productsService.createGroup(body, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post('groups/toggle')
  async toggleGroup(@Request() req, @Body('groupId') groupId: string) {
    return this.productsService.toggleGroupActive(groupId, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post('tiers/create')
  async createTier(@Request() req, @Body() body: CreateTierDto) {
    return this.productsService.createTier(body, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post('tiers/update')
  async updateTier(@Request() req, @Body() body: UpdateTierDto) {
    return this.productsService.updateTier(body, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post('tiers/delete')
  async deleteTier(@Request() req, @Body('id') id: string) {
    return this.productsService.deleteTier(id, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('image', imageUploadOptions('products', PRODUCT_IMAGE_HARD_CAP_BYTES)))
  async uploadImage(@Request() req, @UploadedFile() file: Express.Multer.File, @Param('id') id: string) {
    if (!file) throw new BadRequestException('Image file is required');

    const { productImageMaxBytes } = await this.settingsService.getUploadLimits();
    if (file.size > productImageMaxBytes) {
      await unlink(file.path).catch(() => {});
      throw new BadRequestException(`Image must be under ${Math.floor(productImageMaxBytes / 1024)}KB`);
    }

    return this.productsService.setProductImage(id, publicUploadUrl(this.configService, 'products', file.filename), req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Post(':id/file')
  @UseInterceptors(FileInterceptor('file', fileUploadOptions('product-files', PRODUCT_FILE_HARD_CAP_BYTES)))
  async uploadFile(@Request() req, @UploadedFile() file: Express.Multer.File, @Param('id') id: string) {
    if (!file) throw new BadRequestException('File is required');

    const { productFileMaxBytes } = await this.settingsService.getUploadLimits();
    if (file.size > productFileMaxBytes) {
      await unlink(file.path).catch(() => {});
      throw new BadRequestException(`File must be under ${Math.floor(productFileMaxBytes / (1024 * 1024))}MB`);
    }

    return this.productsService.setProductFile(id, file.originalname, file.filename, req.admin);
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermission('products')
  @Delete(':id/file')
  async removeFile(@Request() req, @Param('id') id: string) {
    return this.productsService.removeProductFile(id, req.admin);
  }

  // User-facing, license-gated download - deliberately not a static URL (see
  // Product entity / file-upload.options.ts comments).
  @UseGuards(AuthGuard('jwt'))
  @Get(':id/download')
  async downloadFile(@Request() req, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { filePath, filename } = await this.productsService.getDownloadInfo(id, req.user.userId);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    return new StreamableFile(createReadStream(filePath));
  }
}