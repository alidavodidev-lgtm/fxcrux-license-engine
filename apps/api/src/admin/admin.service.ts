import { Injectable, OnModuleInit, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Admin, AdminPermissions, NO_ADMIN_PERMISSIONS } from './admin.entity';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminPermissionsDto } from './dto/update-admin-permissions.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import * as bcrypt from 'bcrypt';

interface ActingAdmin {
  id: string;
  username: string;
}

const FULL_ADMIN_PERMISSIONS: AdminPermissions = {
  purchases: true,
  products: true,
  users: true,
  licenses: true,
  wallets: true,
  logs: true,
  tickets: true,
  reports: true,
  ticketGroupIds: null,
};

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    private readonly jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // Bootstrap a single empty installation. Existing administrators are
  // managed through the authenticated admin API.
  async onModuleInit() {
    const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!username && !password) return;
    if (!username || !password || password.length < 16 || Buffer.byteLength(password) > 72) {
      throw new Error('Set a bootstrap username and a password of at least 16 characters and at most 72 bytes.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.adminRepository.manager.transaction(async (manager) => {
      await manager.query('LOCK TABLE admins IN SHARE ROW EXCLUSIVE MODE');
      const admins = manager.getRepository(Admin);
      if (await admins.count()) return;
      await admins.save(admins.create({
        username,
        password_hash: passwordHash,
        is_super_admin: true,
        permissions: FULL_ADMIN_PERMISSIONS,
      }));
    });
  }

  async login(username: string, pass: string, ipAddress?: string) {
    const admin = await this.adminRepository.findOne({ where: { username } });
    if (!admin) throw new UnauthorizedException('Invalid credentials');
    if (!admin.is_active) throw new UnauthorizedException('This admin account has been disabled');

    const isMatch = await bcrypt.compare(pass, admin.password_hash);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    // Bump session_version so any previously-issued token for this account is
    // invalidated on its next request - enforces a single active admin session.
    admin.session_version = (admin.session_version ?? 1) + 1;
    await this.adminRepository.save(admin);

    // Deliberately minimal payload - identity only. Permissions are always
    // re-checked fresh from the DB on every request (see AdminAuthGuard), never
    // trusted from the token, so a revoked permission takes effect immediately.
    const access_token = this.jwtService.sign({
      sub: admin.id,
      username: admin.username,
      role: 'admin',
      sv: admin.session_version,
    });

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: admin.id, actorLabel: admin.username,
      action: 'ADMIN_LOGIN', ipAddress,
    });

    return { success: true, username: admin.username, access_token };
  }

  async changePassword(adminId: string, oldPass: string, newPass: string) {
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) throw new UnauthorizedException('Admin not found');

    const isMatch = await bcrypt.compare(oldPass, admin.password_hash);
    if (!isMatch) throw new UnauthorizedException('Old password incorrect');

    admin.password_hash = await bcrypt.hash(newPass, 10);
    await this.adminRepository.save(admin);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: admin.id, actorLabel: admin.username,
      action: 'ADMIN_PASSWORD_CHANGED',
    });

    return { success: true, message: 'Password changed successfully' };
  }

  // Returns the caller's own identity/permissions - used by the admin panel to
  // decide which nav sections/pages to render. Never exposes password_hash.
  async getSelf(adminId: string) {
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');
    return {
      id: admin.id,
      username: admin.username,
      is_super_admin: admin.is_super_admin,
      permissions: admin.permissions,
    };
  }

  async listAdmins() {
    const admins = await this.adminRepository.find({ order: { created_at: 'ASC' } });
    return admins.map(({ password_hash, ...rest }) => rest);
  }

  async createAdmin(dto: CreateAdminDto, actingAdmin: ActingAdmin) {
    const existing = await this.adminRepository.findOne({ where: { username: dto.username } });
    if (existing) throw new ConflictException('Username already exists');

    const permissions: AdminPermissions = {
      ...NO_ADMIN_PERMISSIONS,
      purchases: !!dto.purchases,
      products: !!dto.products,
      users: !!dto.users,
      licenses: !!dto.licenses,
      wallets: !!dto.wallets,
      logs: !!dto.logs,
      tickets: !!dto.tickets,
    };

    const hash = await bcrypt.hash(dto.password, 10);
    const admin = this.adminRepository.create({
      username: dto.username,
      password_hash: hash,
      is_super_admin: false,
      is_active: true,
      permissions,
    });
    const saved = await this.adminRepository.save(admin);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'ADMIN_CREATED', targetType: 'Admin', targetId: saved.id, targetLabel: saved.username,
    });

    const { password_hash, ...rest } = saved;
    return rest;
  }

  async updatePermissions(dto: UpdateAdminPermissionsDto, actingAdmin: ActingAdmin) {
    const admin = await this.adminRepository.findOne({ where: { id: dto.adminId } });
    if (!admin) throw new NotFoundException('Admin not found');
    if (admin.is_super_admin) throw new BadRequestException("Super admin's access can't be restricted");

    admin.permissions = {
      purchases: dto.purchases ?? admin.permissions.purchases,
      products: dto.products ?? admin.permissions.products,
      users: dto.users ?? admin.permissions.users,
      licenses: dto.licenses ?? admin.permissions.licenses,
      wallets: dto.wallets ?? admin.permissions.wallets,
      logs: dto.logs ?? admin.permissions.logs,
      tickets: dto.tickets ?? admin.permissions.tickets,
      reports: dto.reports ?? admin.permissions.reports,
      ticketGroupIds: dto.ticketGroupIds ?? admin.permissions.ticketGroupIds,
    };
    const saved = await this.adminRepository.save(admin);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'ADMIN_PERMISSIONS_UPDATED', targetType: 'Admin', targetId: saved.id, targetLabel: saved.username,
      metadata: { permissions: saved.permissions },
    });

    const { password_hash, ...rest } = saved;
    return rest;
  }

  async toggleAdminActive(adminId: string, actingAdminId: string, actingAdminUsername: string) {
    if (adminId === actingAdminId) {
      throw new BadRequestException("You can't deactivate your own account");
    }
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');
    if (admin.is_super_admin) throw new BadRequestException("Super admin can't be deactivated");

    admin.is_active = !admin.is_active;
    const saved = await this.adminRepository.save(admin);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdminId, actorLabel: actingAdminUsername,
      action: 'ADMIN_STATUS_CHANGED', targetType: 'Admin', targetId: saved.id, targetLabel: saved.username,
      metadata: { is_active: saved.is_active },
    });

    const { password_hash, ...rest } = saved;
    return rest;
  }

  // Username/password edit - separate from permissions, mirrors the Users
  // page's edit dialog. Password only changes if a new one was actually sent.
  async updateAdmin(adminId: string, updates: { username?: string; password?: string }, actingAdmin: ActingAdmin) {
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');

    if (updates.username && updates.username !== admin.username) {
      const existing = await this.adminRepository.findOne({ where: { username: updates.username } });
      if (existing) throw new ConflictException('Username already exists');
      admin.username = updates.username;
    }
    if (updates.password) {
      admin.password_hash = await bcrypt.hash(updates.password, 10);
    }

    const saved = await this.adminRepository.save(admin);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'ADMIN_UPDATED', targetType: 'Admin', targetId: saved.id, targetLabel: saved.username,
      metadata: { username_changed: !!updates.username, password_changed: !!updates.password },
    });

    const { password_hash, ...rest } = saved;
    return rest;
  }

  async promoteToSuperAdmin(adminId: string, actingAdmin: ActingAdmin) {
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');

    admin.is_super_admin = true;
    admin.permissions = FULL_ADMIN_PERMISSIONS;
    const saved = await this.adminRepository.save(admin);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'ADMIN_PROMOTED', targetType: 'Admin', targetId: saved.id, targetLabel: saved.username,
    });

    const { password_hash, ...rest } = saved;
    return rest;
  }

  async demoteFromSuperAdmin(adminId: string, actingAdmin: ActingAdmin) {
    if (adminId === actingAdmin.id) {
      throw new BadRequestException("You can't demote your own account");
    }
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');
    if (!admin.is_super_admin) throw new BadRequestException('This admin is not a super admin');

    const superAdminCount = await this.adminRepository.count({ where: { is_super_admin: true } });
    if (superAdminCount <= 1) {
      throw new BadRequestException('At least one super admin must remain');
    }

    admin.is_super_admin = false;
    admin.permissions = NO_ADMIN_PERMISSIONS;
    const saved = await this.adminRepository.save(admin);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'ADMIN_DEMOTED', targetType: 'Admin', targetId: saved.id, targetLabel: saved.username,
    });

    const { password_hash, ...rest } = saved;
    return rest;
  }
}
