import { Injectable, ConflictException, InternalServerErrorException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { Product } from './product.entity';
import { ProductPricingTier } from './product-pricing-tier.entity';
import { ProductGroup } from './product-group.entity';
import { License } from '../licenses/license.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateTierDto } from './dto/create-tier.dto';
import { UpdateTierDto } from './dto/update-tier.dto';
import { CreateProductGroupDto } from './dto/create-product-group.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { localUploadPath } from '../common/upload/upload-url.util';

interface ActingAdmin {
  id: string;
  username: string;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(ProductPricingTier)
    private tiersRepository: Repository<ProductPricingTier>,
    @InjectRepository(ProductGroup)
    private groupsRepository: Repository<ProductGroup>,
    @InjectRepository(License)
    private licensesRepository: Repository<License>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createProduct(createProductDto: CreateProductDto, actingAdmin: ActingAdmin) {
    let group: ProductGroup | null = null;
    if (createProductDto.groupId) {
      group = await this.groupsRepository.findOne({ where: { id: createProductDto.groupId } });
      if (!group) throw new NotFoundException('Product category not found');
    }

    const product = this.productsRepository.create({
      name: createProductDto.name,
      description: createProductDto.description,
      version: createProductDto.version || '1.0.0',
      price: createProductDto.price || 0,
      image_url: createProductDto.image_url || null,
      group,
    });

    let saved: Product;
    try {
      saved = await this.productsRepository.save(product);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Product with this name already exists');
      }
      throw new InternalServerErrorException('Error creating product');
    }

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'PRODUCT_CREATED', targetType: 'Product', targetId: saved.id, targetLabel: saved.name,
    });

    return saved;
  }

  // New method for updating product details and status
  async updateProduct(id: string, updateData: Partial<CreateProductDto> & { is_active?: boolean }, actingAdmin: ActingAdmin) {
    const product = await this.productsRepository.findOne({ where: { id }, relations: { group: true } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const { groupId, ...rest } = updateData;
    Object.assign(product, rest);

    // Empty string clears the category; undefined leaves it untouched.
    if (groupId !== undefined) {
      if (!groupId) {
        product.group = null;
      } else {
        const group = await this.groupsRepository.findOne({ where: { id: groupId } });
        if (!group) throw new NotFoundException('Product category not found');
        product.group = group;
      }
    }

    let saved: Product;
    try {
      saved = await this.productsRepository.save(product);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Product name already exists');
      }
      throw new InternalServerErrorException('Error updating product');
    }

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'PRODUCT_UPDATED', targetType: 'Product', targetId: saved.id, targetLabel: saved.name,
      metadata: updateData,
    });

    return saved;
  }

  // Uploaded file replaces whatever was there before (URL or a prior
  // upload) - the old *uploaded* file is deleted so they don't pile up
  // forever; a previously pasted external URL is just discarded, nothing to
  // delete for that case.
  async setProductImage(productId: string, imageUrl: string, actingAdmin: ActingAdmin) {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const previousUrl = product.image_url;
    product.image_url = imageUrl;
    const saved = await this.productsRepository.save(product);

    const previousLocalPath = localUploadPath(previousUrl);
    if (previousLocalPath) {
      unlink(join(process.cwd(), previousLocalPath)).catch(() => {});
    }

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'PRODUCT_UPDATED', targetType: 'Product', targetId: saved.id, targetLabel: saved.name,
      metadata: { image_url: imageUrl },
    });

    return saved;
  }

  // file_stored_name is select:false, so a plain findOne() (used below,
  // same as setProductImage()) never loads it - fetch it separately with an
  // explicit addSelect just to know what to unlink from disk on replace/remove.
  private async getStoredFileName(productId: string): Promise<string | null> {
    const row = await this.productsRepository
      .createQueryBuilder('product')
      .select('product.file_stored_name', 'file_stored_name')
      .where('product.id = :productId', { productId })
      .getRawOne();
    return row?.file_stored_name ?? null;
  }

  // Attaches (or replaces) the downloadable deliverable for a product. Unlike
  // setProductImage(), the stored file lives outside the public uploads/
  // tree - see file-upload.options.ts - so there's no localUploadPath()-style
  // URL to parse, just the previous stored filename to remove from disk.
  async setProductFile(productId: string, originalName: string, storedName: string, actingAdmin: ActingAdmin) {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const previousStoredName = await this.getStoredFileName(productId);
    product.file_original_name = originalName;
    product.file_stored_name = storedName;
    const saved = await this.productsRepository.save(product);

    if (previousStoredName) {
      unlink(join(process.cwd(), 'product-files', previousStoredName)).catch(() => {});
    }

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'PRODUCT_UPDATED', targetType: 'Product', targetId: saved.id, targetLabel: saved.name,
      metadata: { file_original_name: originalName },
    });

    const { file_stored_name, ...rest } = saved;
    return rest;
  }

  async removeProductFile(productId: string, actingAdmin: ActingAdmin) {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const previousStoredName = await this.getStoredFileName(productId);
    product.file_original_name = null;
    product.file_stored_name = null;
    const saved = await this.productsRepository.save(product);

    if (previousStoredName) {
      unlink(join(process.cwd(), 'product-files', previousStoredName)).catch(() => {});
    }

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'PRODUCT_UPDATED', targetType: 'Product', targetId: saved.id, targetLabel: saved.name,
      metadata: { file_original_name: null },
    });

    const { file_stored_name, ...rest } = saved;
    return rest;
  }

  // Gate: the requesting user must hold a currently-active license for this
  // product before the actual bytes are handed over - this is the real
  // enforcement point, since the file is never reachable via a public URL.
  async getDownloadInfo(productId: string, userId: string) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
      select: { id: true, name: true, file_original_name: true, file_stored_name: true },
    });
    if (!product || !product.file_stored_name) {
      throw new NotFoundException('No downloadable file is attached to this product');
    }

    const license = await this.licensesRepository.findOne({
      where: { user: { id: userId }, product: { id: productId } },
    });
    if (!license || !license.is_active || license.expires_at < new Date()) {
      throw new ForbiddenException('An active license for this product is required to download this file');
    }

    const filePath = join(process.cwd(), 'product-files', product.file_stored_name);
    if (!existsSync(filePath)) throw new NotFoundException('File not found on server');

    return { filePath, filename: product.file_original_name || product.file_stored_name };
  }

  async findAll() {
    const products = await this.productsRepository.find({
      relations: { tiers: true, group: true },
      order: { created_at: 'DESC' }
    });

    // The tiers relation has no ORDER BY of its own, so Postgres doesn't
    // guarantee the same row order between requests - after an UPDATE this
    // could reshuffle the list, making a toggle on one tier look like it
    // changed a *different* tier's row instead (the id moved, the visual
    // position didn't). Sort deterministically so a tier always renders in
    // the same place regardless of what else changed.
    for (const product of products) {
      product.tiers = (product.tiers || [])
        .filter((t) => !t.is_deleted)
        .sort((a, b) => a.duration_days - b.duration_days || a.created_at.getTime() - b.created_at.getTime());
    }

    return products;
  }

  // --- Product groups (categories) ---

  async getActiveGroups() {
    return this.groupsRepository.find({ where: { is_active: true }, order: { name: 'ASC' } });
  }

  async getAllGroups() {
    return this.groupsRepository.find({ order: { created_at: 'DESC' } });
  }

  async createGroup(dto: CreateProductGroupDto, actingAdmin: ActingAdmin) {
    const group = this.groupsRepository.create({ name: dto.name, description: dto.description });
    const saved = await this.groupsRepository.save(group);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'PRODUCT_GROUP_CREATED', targetType: 'ProductGroup', targetId: saved.id, targetLabel: saved.name,
    });

    return saved;
  }

  async toggleGroupActive(groupId: string, actingAdmin: ActingAdmin) {
    const group = await this.groupsRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Product category not found');
    group.is_active = !group.is_active;
    const saved = await this.groupsRepository.save(group);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'PRODUCT_GROUP_STATUS_CHANGED', targetType: 'ProductGroup', targetId: saved.id, targetLabel: saved.name,
      metadata: { is_active: saved.is_active },
    });

    return saved;
  }

  async createTier(dto: CreateTierDto, actingAdmin: ActingAdmin) {
    const product = await this.productsRepository.findOne({ where: { id: dto.productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const tier = this.tiersRepository.create({
      product,
      label: dto.label,
      duration_days: dto.duration_days,
      price: dto.price,
      is_one_time: dto.is_one_time ?? false,
    });

    const saved = await this.tiersRepository.save(tier);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'TIER_CREATED', targetType: 'ProductPricingTier', targetId: saved.id, targetLabel: `${product.name} / ${saved.label}`,
    });

    return saved;
  }

  async updateTier(dto: UpdateTierDto, actingAdmin: ActingAdmin) {
    const tier = await this.tiersRepository.findOne({ where: { id: dto.id }, relations: { product: true } });
    if (!tier) {
      throw new NotFoundException('Tier not found');
    }

    const { id, ...updateData } = dto;
    Object.assign(tier, updateData);

    const saved = await this.tiersRepository.save(tier);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'TIER_UPDATED', targetType: 'ProductPricingTier', targetId: saved.id, targetLabel: `${tier.product?.name} / ${saved.label}`,
      metadata: updateData,
    });

    return saved;
  }

  // Soft-delete - see the entity comment on is_deleted for why this never
  // does a hard DELETE.
  async deleteTier(tierId: string, actingAdmin: ActingAdmin) {
    const tier = await this.tiersRepository.findOne({ where: { id: tierId }, relations: { product: true } });
    if (!tier) throw new NotFoundException('Tier not found');

    tier.is_deleted = true;
    const saved = await this.tiersRepository.save(tier);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'TIER_DELETED', targetType: 'ProductPricingTier', targetId: saved.id, targetLabel: `${tier.product?.name} / ${saved.label}`,
    });

    return { success: true };
  }
}