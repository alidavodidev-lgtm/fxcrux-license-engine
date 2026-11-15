import { Injectable, NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { ProductVersion } from './product-version.entity';
import { ProductVersionAccess } from './product-version-access.entity';
import { Product } from './product.entity';
import { User } from '../users/user.entity';
import { License } from '../licenses/license.entity';
import { CreateVersionDto } from './dto/create-version.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { localUploadPath } from '../common/upload/upload-url.util';

interface ActingAdmin {
  id: string;
  username: string;
}

@Injectable()
export class ProductVersionsService {
  constructor(
    @InjectRepository(ProductVersion) private versionsRepository: Repository<ProductVersion>,
    @InjectRepository(ProductVersionAccess) private accessRepository: Repository<ProductVersionAccess>,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(License) private licensesRepository: Repository<License>,
    private readonly jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // --- Admin CRUD ---

  async listVersions(productId: string) {
    const versions = await this.versionsRepository.find({
      where: { product: { id: productId } },
      order: { created_at: 'DESC' },
    });

    const counts = await this.accessRepository
      .createQueryBuilder('a')
      .select('a.version_id', 'versionId')
      .addSelect('COUNT(*)', 'count')
      .where('a.product_id = :productId', { productId })
      .groupBy('a.version_id')
      .getRawMany();
    const countMap = new Map(counts.map((c) => [c.versionId, Number(c.count)]));

    return versions.map((v) => ({ ...v, specificUserCount: countMap.get(v.id) ?? 0 }));
  }

  async createVersion(productId: string, dto: CreateVersionDto, actingAdmin: ActingAdmin) {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const version = this.versionsRepository.create({
      product,
      version: dto.version,
      platform: dto.platform || null,
      description: dto.description || null,
    });
    const saved = await this.versionsRepository.save(version);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'APP_VERSION_CREATED', targetType: 'ProductVersion', targetId: saved.id, targetLabel: `${product.name} / ${saved.version}`,
    });

    return saved;
  }

  async updateVersion(versionId: string, dto: { version?: string; platform?: string; description?: string }, actingAdmin: ActingAdmin) {
    const version = await this.versionsRepository.findOne({ where: { id: versionId }, relations: { product: true } });
    if (!version) throw new NotFoundException('Version not found');

    Object.assign(version, dto);
    const saved = await this.versionsRepository.save(version);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'APP_VERSION_UPDATED', targetType: 'ProductVersion', targetId: saved.id, targetLabel: `${version.product.name} / ${saved.version}`,
      metadata: dto,
    });

    return saved;
  }

  async deleteVersion(versionId: string, actingAdmin: ActingAdmin) {
    const version = await this.versionsRepository.findOne({ where: { id: versionId }, relations: { product: true } });
    if (!version) throw new NotFoundException('Version not found');

    const storedInstallerName = await this.getStoredInstallerName(versionId);
    const iconUrl = version.icon_url;
    const label = `${version.product.name} / ${version.version}`;

    // FK onDelete: 'CASCADE' on ProductVersionAccess.version removes access rows automatically.
    await this.versionsRepository.remove(version);

    if (storedInstallerName) unlink(join(process.cwd(), 'product-version-files', storedInstallerName)).catch(() => {});
    const localIconPath = localUploadPath(iconUrl);
    if (localIconPath) unlink(join(process.cwd(), localIconPath)).catch(() => {});

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'APP_VERSION_DELETED', targetType: 'ProductVersion', targetId: versionId, targetLabel: label,
    });

    return { success: true };
  }

  // installer_stored_name is select:false - a plain findOne() never loads it,
  // fetch it separately with an explicit addSelect just to know what to
  // unlink from disk on replace/remove (same pattern as ProductsService.getStoredFileName).
  private async getStoredInstallerName(versionId: string): Promise<string | null> {
    const row = await this.versionsRepository
      .createQueryBuilder('v')
      .select('v.installer_stored_name', 'installer_stored_name')
      .where('v.id = :versionId', { versionId })
      .getRawOne();
    return row?.installer_stored_name ?? null;
  }

  async setInstaller(versionId: string, originalName: string, storedName: string, actingAdmin: ActingAdmin) {
    const version = await this.versionsRepository.findOne({ where: { id: versionId }, relations: { product: true } });
    if (!version) throw new NotFoundException('Version not found');

    const previousStoredName = await this.getStoredInstallerName(versionId);
    version.installer_original_name = originalName;
    version.installer_stored_name = storedName;
    const saved = await this.versionsRepository.save(version);

    if (previousStoredName) unlink(join(process.cwd(), 'product-version-files', previousStoredName)).catch(() => {});

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'APP_VERSION_UPDATED', targetType: 'ProductVersion', targetId: saved.id, targetLabel: `${version.product.name} / ${saved.version}`,
      metadata: { installer_original_name: originalName },
    });

    const { installer_stored_name, ...rest } = saved;
    return rest;
  }

  async removeInstaller(versionId: string, actingAdmin: ActingAdmin) {
    const version = await this.versionsRepository.findOne({ where: { id: versionId }, relations: { product: true } });
    if (!version) throw new NotFoundException('Version not found');

    const previousStoredName = await this.getStoredInstallerName(versionId);
    version.installer_original_name = null;
    version.installer_stored_name = null;
    const saved = await this.versionsRepository.save(version);

    if (previousStoredName) unlink(join(process.cwd(), 'product-version-files', previousStoredName)).catch(() => {});

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'APP_VERSION_UPDATED', targetType: 'ProductVersion', targetId: saved.id, targetLabel: `${version.product.name} / ${saved.version}`,
      metadata: { installer_original_name: null },
    });

    const { installer_stored_name, ...rest } = saved;
    return rest;
  }

  async setIcon(versionId: string, iconUrl: string, actingAdmin: ActingAdmin) {
    const version = await this.versionsRepository.findOne({ where: { id: versionId }, relations: { product: true } });
    if (!version) throw new NotFoundException('Version not found');

    const previousUrl = version.icon_url;
    version.icon_url = iconUrl;
    const saved = await this.versionsRepository.save(version);

    const previousLocalPath = localUploadPath(previousUrl);
    if (previousLocalPath) unlink(join(process.cwd(), previousLocalPath)).catch(() => {});

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'APP_VERSION_UPDATED', targetType: 'ProductVersion', targetId: saved.id, targetLabel: `${version.product.name} / ${saved.version}`,
      metadata: { icon_url: iconUrl },
    });

    return saved;
  }

  async removeIcon(versionId: string, actingAdmin: ActingAdmin) {
    const version = await this.versionsRepository.findOne({ where: { id: versionId }, relations: { product: true } });
    if (!version) throw new NotFoundException('Version not found');

    const previousUrl = version.icon_url;
    version.icon_url = null;
    const saved = await this.versionsRepository.save(version);

    const previousLocalPath = localUploadPath(previousUrl);
    if (previousLocalPath) unlink(join(process.cwd(), previousLocalPath)).catch(() => {});

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'APP_VERSION_UPDATED', targetType: 'ProductVersion', targetId: saved.id, targetLabel: `${version.product.name} / ${saved.version}`,
      metadata: { icon_url: null },
    });

    return saved;
  }

  // --- Access control ---

  // Every user (all statuses - admin sees the full picture) plus whether they
  // already have access to THIS version, or a *different* version of the same
  // product (so the admin UI can show "will move this user from vX").
  async getUsersForAccessPicker(versionId: string) {
    const version = await this.versionsRepository.findOne({ where: { id: versionId }, relations: { product: true } });
    if (!version) throw new NotFoundException('Version not found');

    const [users, accessRows] = await Promise.all([
      this.usersRepository.find({ order: { username: 'ASC' } }),
      this.accessRepository.find({ where: { product: { id: version.product.id } }, relations: { version: true, user: true } }),
    ]);

    const accessMap = new Map(accessRows.map((a) => [a.user.id, a]));

    return users.map((u) => {
      const access = accessMap.get(u.id);
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        hasAccess: access?.version.id === versionId,
        currentVersionLabel: access && access.version.id !== versionId ? access.version.version : null,
      };
    });
  }

  // Sets this version to ALL_USERS: any other version of the same product
  // currently ALL_USERS reverts to SPECIFIC, and every individual grant for
  // the product is cleared (redundant once one version covers everyone) -
  // this is what enforces "only one ALL_USERS version per product."
  async setAllUsersAccess(versionId: string, actingAdmin: ActingAdmin) {
    const result = await this.versionsRepository.manager.transaction(async (manager) => {
      const version = await manager.findOne(ProductVersion, { where: { id: versionId }, relations: { product: true } });
      if (!version) throw new NotFoundException('Version not found');

      version.access_mode = 'ALL_USERS';
      await manager.save(version);

      await manager
        .createQueryBuilder()
        .update(ProductVersion)
        .set({ access_mode: 'SPECIFIC' })
        .where('product_id = :productId AND id != :versionId AND access_mode = :mode', {
          productId: version.product.id, versionId, mode: 'ALL_USERS',
        })
        .execute();

      await manager
        .createQueryBuilder()
        .delete()
        .from(ProductVersionAccess)
        .where('product_id = :productId', { productId: version.product.id })
        .execute();

      return version;
    });

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'APP_VERSION_ACCESS_ALL_USERS', targetType: 'ProductVersion', targetId: result.id, targetLabel: `${result.product.name} / ${result.version}`,
    });

    return result;
  }

  // Sets this version to SPECIFIC and replaces its user list with exactly
  // `userIds`. Row-locked per user (mirrors LicensesService.issueOrExtendLicense)
  // so re-granting a user a different version of the same product atomically
  // moves their single access row instead of creating a second one - this is
  // what enforces "a user can't have more than one active version per product."
  async assignSpecificUsers(versionId: string, userIds: string[], actingAdmin: ActingAdmin) {
    const result = await this.versionsRepository.manager.transaction(async (manager) => {
      const version = await manager.findOne(ProductVersion, { where: { id: versionId }, relations: { product: true } });
      if (!version) throw new NotFoundException('Version not found');

      version.access_mode = 'SPECIFIC';
      await manager.save(version);

      const removeQb = manager
        .createQueryBuilder()
        .delete()
        .from(ProductVersionAccess)
        .where('version_id = :versionId', { versionId });
      if (userIds.length > 0) removeQb.andWhere('user_id NOT IN (:...userIds)', { userIds });
      await removeQb.execute();

      for (const userId of userIds) {
        const existing = await manager.findOne(ProductVersionAccess, {
          where: { user: { id: userId }, product: { id: version.product.id } },
          lock: { mode: 'pessimistic_write' },
        });
        if (existing) {
          existing.version = version;
          await manager.save(existing);
        } else {
          await manager.save(manager.create(ProductVersionAccess, { version, user: { id: userId } as User, product: version.product }));
        }
      }

      return version;
    });

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'APP_VERSION_ACCESS_ASSIGNED', targetType: 'ProductVersion', targetId: result.id, targetLabel: `${result.product.name} / ${result.version}`,
      metadata: { userCount: userIds.length },
    });

    return result;
  }

  // The single version (if any) a given user currently resolves to for a
  // product: an active ALL_USERS version always wins; otherwise their own
  // SPECIFIC grant, if its version is still active.
  async checkVersionForUser(userId: string, productId: string): Promise<ProductVersion | null> {
    const allUsersVersion = await this.versionsRepository.findOne({
      where: { product: { id: productId }, access_mode: 'ALL_USERS', is_active: true },
    });
    if (allUsersVersion) return allUsersVersion;

    const access = await this.accessRepository.findOne({
      where: { user: { id: userId }, product: { id: productId } },
      relations: { version: true },
    });
    if (access && access.version.is_active) return access.version;

    return null;
  }

  // --- Engine-facing (machine-id auth) ---

  async checkVersionByMachine(machineId: string, productName: string) {
    const user = await this.usersRepository.findOne({ where: { machine_id: machineId } });
    if (!user || user.status === 'BANNED') return { hasAccess: false };

    const product = await this.productsRepository.findOne({ where: { name: productName } });
    if (!product) return { hasAccess: false };

    const license = await this.licensesRepository.findOne({ where: { user: { id: user.id }, product: { id: product.id } } });
    if (!license || !license.is_active || license.expires_at < new Date()) return { hasAccess: false };

    const version = await this.checkVersionForUser(user.id, product.id);
    if (!version) return { hasAccess: false };

    const downloadToken = this.jwtService.sign(
      { versionId: version.id, userId: user.id, purpose: 'version-download' },
      { expiresIn: '5m' },
    );

    return {
      hasAccess: true,
      version: version.version,
      platform: version.platform,
      description: version.description,
      iconUrl: version.icon_url,
      downloadToken,
    };
  }

  // Re-checks access at download time (closes the small window between check
  // and download where a grant could be revoked) before streaming the file -
  // the token alone proves "you passed the check a few minutes ago," not
  // "you still have access right now."
  async getDownloadInfoByToken(token: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired download token');
    }
    if (payload.purpose !== 'version-download') throw new UnauthorizedException('Invalid token');

    const version = await this.versionsRepository.findOne({ where: { id: payload.versionId }, relations: { product: true } });
    if (!version || !version.is_active) throw new NotFoundException('Version not found');

    const license = await this.licensesRepository.findOne({ where: { user: { id: payload.userId }, product: { id: version.product.id } } });
    if (!license || !license.is_active || license.expires_at < new Date()) {
      throw new ForbiddenException('An active license is required to download this file');
    }

    const resolvedVersion = await this.checkVersionForUser(payload.userId, version.product.id);
    if (!resolvedVersion || resolvedVersion.id !== version.id) {
      throw new ForbiddenException('You no longer have access to this version');
    }

    const storedName = await this.getStoredInstallerName(version.id);
    if (!storedName) throw new NotFoundException('No installer file attached to this version');

    const filePath = join(process.cwd(), 'product-version-files', storedName);
    if (!existsSync(filePath)) throw new NotFoundException('File not found on server');

    return { filePath, filename: version.installer_original_name || storedName };
  }
}
