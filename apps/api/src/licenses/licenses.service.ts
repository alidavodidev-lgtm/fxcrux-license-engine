import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { License } from './license.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { LicenseLog } from './license-log.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { LicenseSigningService } from '../common/crypto/license-signing.service';
import * as crypto from 'crypto';

interface ActingAdmin {
  id: string;
  username: string;
}

@Injectable()
export class LicensesService {
  constructor(
    @InjectRepository(License) private licensesRepository: Repository<License>,
    @InjectRepository(LicenseLog) private licenseLogsRepository: Repository<LicenseLog>,
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    private readonly auditLogService: AuditLogService,
    private readonly licenseSigningService: LicenseSigningService,
  ) {}

  // Issues a new license, or — if the user already holds one for this product —
  // extends its expiry instead of creating a duplicate license row. Wrapped in a
  // transaction with a row lock (SELECT ... FOR UPDATE) so two near-simultaneous
  // approvals for the same user+product can't both see "no existing row" and
  // insert two - the DB-level unique index (user_id, product_id) is the backstop
  // if that ever happens anyway.
  async issueOrExtendLicense(user: User, product: Product, daysValid: number, paidAmount: number = 0, isManual: boolean = false): Promise<License> {
    return this.licensesRepository.manager.transaction(async (manager) => {
      const existing = await manager.findOne(License, {
        where: { user: { id: user.id }, product: { id: product.id } },
        lock: { mode: 'pessimistic_write' },
      });

      if (existing) {
        const base = existing.expires_at > new Date() ? existing.expires_at : new Date();
        const newExpiresAt = new Date(base);
        newExpiresAt.setDate(newExpiresAt.getDate() + daysValid);

        existing.expires_at = newExpiresAt;
        existing.is_active = true;
        existing.status = 'active';
        existing.paid_amount = Number(existing.paid_amount) + Number(paidAmount);

        return manager.save(existing);
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + daysValid);

      const licenseKey = `LE-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;

      const newLicense = manager.create(License, {
        license_key: licenseKey,
        user: user,
        product: product,
        expires_at: expiresAt,
        paid_amount: paidAmount,
        is_manual: isManual,
      });

      return manager.save(newLicense);
    });
  }

  async issueManualLicense(userId: string, productId: string, daysValid: number, paidAmount: number, actingAdmin: ActingAdmin) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    const product = await this.productsRepository.findOne({ where: { id: productId } });

    if (!user || !product) {
      throw new NotFoundException('User or Product not found');
    }

    const license = await this.issueOrExtendLicense(user, product, daysValid, paidAmount, true);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'LICENSE_ISSUED_MANUAL', targetType: 'License', targetId: license.id, targetLabel: `${user.username} / ${product.name}`,
      metadata: { daysValid, paidAmount },
    });

    return license;
  }

async getUserLicenses(userId: string) {
    return this.licensesRepository.find({
      where: { user: { id: userId } },
      relations: { product: true },
      order: { created_at: 'DESC' }
    });
  }

  async updateLicenseDate(licenseId: string, expiresAt: string, actingAdmin: ActingAdmin) {
    const license = await this.licensesRepository.findOne({ where: { id: licenseId }, relations: { user: true, product: true } });
    if (!license) throw new NotFoundException('License not found');

    license.expires_at = new Date(expiresAt);
    // Distinct from is_manual (which only reflects how the row was originally
    // created, never touched again by stacking/date-edits either way) - this
    // flags any license, purchase-originated or not, that an admin has since
    // hand-edited the expiry of, so the "manually adjusted" indicator on the
    // user report is accurate regardless of how the license started out.
    license.date_manually_adjusted = true;
    const saved = await this.licensesRepository.save(license);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'LICENSE_DATE_UPDATED', targetType: 'License', targetId: saved.id,
      targetLabel: `${license.user?.username} / ${license.product?.name}`,
      metadata: { expires_at: saved.expires_at },
    });

    return saved;
  }

  async validateLicense(licenseKey: string, machineId: string, _ipAddress: string, productId?: string) {
    const license = await this.licensesRepository.findOne({ where: { license_key: licenseKey }, relations: { product: true, user: true } });
    if (!license) throw new NotFoundException('Invalid license key');
    if (productId !== undefined && productId !== license.product.id) {
      throw new ForbiddenException('License does not cover this product');
    }
    if (!license.is_active) throw new ForbiddenException('This license has been disabled');
    if (new Date() > license.expires_at) throw new ForbiddenException('This license has expired');
    const user = license.user;
    if (user.status === 'BANNED') throw new ForbiddenException('Your account has been banned');

    if (!user.machine_id) {
      const binding = await this.usersRepository.update(
        { id: user.id, machine_id: IsNull() },
        { machine_id: machineId },
      );
      if (binding.affected) {
        this.auditLogService.record({
          actorType: 'USER', actorId: user.id, actorLabel: user.username,
          action: 'USER_HARDWARE_BOUND', targetType: 'User', targetId: user.id, targetLabel: user.username,
          metadata: { old_machine_id: null, new_machine_id: machineId },
        });
      } else {
        const currentUser = await this.usersRepository.findOneBy({ id: user.id });
        if (currentUser?.machine_id !== machineId) {
          throw new ForbiddenException('Hardware mismatch');
        }
      }
    } else if (user.machine_id !== machineId) {
      throw new ForbiddenException('Hardware mismatch');
    }
    return { status: 'success', product: license.product.name, user: user.username, expires_at: license.expires_at };
  }

  async resetMachineId(userId: string, actingAdmin: ActingAdmin) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const previousMachineId = user.machine_id;
    user.machine_id = null;
    await this.usersRepository.save(user);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'USER_HARDWARE_RESET', targetType: 'User', targetId: user.id, targetLabel: user.username,
      metadata: { old_machine_id: previousMachineId, new_machine_id: null },
    });

    return { status: 'success' };
  }

  // Called by the Engine (on behalf of a trading terminal) to check whether the
  // machine currently bound to a user has an active license for a given product.
  // Deliberately collapses every failure case (no such machine, no such license,
  // expired, disabled, banned user) to the same { active: false } shape.
  async checkActiveLicenseByMachine(machineId: string, productName: string) {
    const user = await this.usersRepository.findOne({ where: { machine_id: machineId } });
    if (!user || user.status === 'BANNED') {
      return { active: false, product: productName };
    }

    const license = await this.licensesRepository.findOne({
      where: { user: { id: user.id }, product: { name: productName } },
      relations: { product: true },
      order: { created_at: 'DESC' },
    });

    if (!license || !license.is_active || new Date() > license.expires_at) {
      return { active: false, product: productName };
    }

    // Clients need the same timestamp strings in the signature and response
    // so they can reconstruct the signed certificate.
    const issuedAt = new Date().toISOString();
    const expiresAtIso = license.expires_at.toISOString();
    const { signature } = this.licenseSigningService.sign(user.id, productName, issuedAt, expiresAtIso);

    return {
      active: true,
      product: productName,
      expiresAt: expiresAtIso,
      issuedAt,
      userId: user.id,
      signature,
    };
  }

  // Same trust model as checkActiveLicenseByMachine, but returns every
  // currently active license for the machine's bound user instead of a
  // single product - powers the Engine's App Hub list and heartbeat.
  // No such machine / banned user / zero active licenses all just return
  // an empty array, never an error - same "don't leak which case" convention.
  async listActiveLicensesByMachine(machineId: string) {
    const user = await this.usersRepository.findOne({ where: { machine_id: machineId } });
    if (!user || user.status === 'BANNED') {
      return [];
    }

    const licenses = await this.licensesRepository.find({
      where: { user: { id: user.id }, is_active: true },
      relations: { product: true },
      order: { created_at: 'DESC' },
    });

    const now = new Date();
    return licenses
      .filter((license) => license.product && license.expires_at > now)
      .map((license) => ({ product: license.product.name, expiresAt: license.expires_at }));
  }

  async toggleLicenseStatus(licenseId: string, actingAdmin: ActingAdmin) {
    const license = await this.licensesRepository.findOne({ where: { id: licenseId }, relations: { user: true, product: true } });
    if (!license) throw new NotFoundException('License not found');
    license.is_active = !license.is_active;
    // status must stay in sync with is_active - the admin UI reads status to
    // decide Active/Revoked, while validateLicense()/checkActiveLicenseByMachine()
    // enforce is_active. Previously only is_active was updated here, so the admin
    // panel never reflected a revoke even though it was enforced correctly.
    license.status = license.is_active ? 'active' : 'revoked';
    const saved = await this.licensesRepository.save(license);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'LICENSE_STATUS_CHANGED', targetType: 'License', targetId: saved.id,
      targetLabel: `${license.user?.username} / ${license.product?.name}`,
      metadata: { is_active: saved.is_active, status: saved.status },
    });

    return saved;
  }

  async getRecentLogs() {
    return this.licenseLogsRepository.find({
      order: { created_at: 'DESC' },
      take: 100 // Fetching the last 100 logs for performance
    });
  }
  async getAllLicenses() {
    return this.licensesRepository.find({ relations: { user: true, product: true }, order: { created_at: 'DESC' } });
  }
}
