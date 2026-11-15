import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Ticket } from './ticket.entity';
import { TicketMessage } from './ticket-message.entity';
import { TicketGroup } from './ticket-group.entity';
import { User } from '../users/user.entity';
import { Admin } from '../admin/admin.entity';
import { CreateTicketGroupDto } from './dto/create-ticket-group.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';

interface AdminIdentity {
  id: string;
  username: string;
  is_super_admin: boolean;
  permissions: { tickets: boolean; ticketGroupIds: string[] | null };
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private ticketsRepository: Repository<Ticket>,
    @InjectRepository(TicketMessage) private messagesRepository: Repository<TicketMessage>,
    @InjectRepository(TicketGroup) private groupsRepository: Repository<TicketGroup>,
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(Admin) private adminsRepository: Repository<Admin>,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // --- Groups ---

  async getActiveGroups() {
    return this.groupsRepository.find({ where: { is_active: true }, order: { name: 'ASC' } });
  }

  async getAllGroups() {
    return this.groupsRepository.find({ order: { created_at: 'DESC' } });
  }

  async createGroup(dto: CreateTicketGroupDto, actingAdmin: AdminIdentity) {
    const group = this.groupsRepository.create({ name: dto.name, description: dto.description });
    const saved = await this.groupsRepository.save(group);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'TICKET_GROUP_CREATED', targetType: 'TicketGroup', targetId: saved.id, targetLabel: saved.name,
    });

    return saved;
  }

  async toggleGroupActive(groupId: string, actingAdmin: AdminIdentity) {
    const group = await this.groupsRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    group.is_active = !group.is_active;
    const saved = await this.groupsRepository.save(group);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'TICKET_GROUP_STATUS_CHANGED', targetType: 'TicketGroup', targetId: saved.id, targetLabel: saved.name,
      metadata: { is_active: saved.is_active },
    });

    return saved;
  }

  // Admins with tickets:true, excluding super admins (they always have full
  // access and aren't individually scoped). hasAccess mirrors groupIdsVisibleTo's
  // null/empty-means-all rule so the UI reflects exactly what's enforced.
  async getGroupAdminAccess(groupId: string) {
    const admins = await this.adminsRepository.find({ where: { is_super_admin: false }, order: { username: 'ASC' } });
    return admins
      .filter((a) => a.permissions?.tickets)
      .map((a) => {
        const ids = a.permissions.ticketGroupIds;
        const hasAccess = !ids || ids.length === 0 ? true : ids.includes(groupId);
        return { id: a.id, username: a.username, hasAccess };
      });
  }

  // Sets which admins can see this group, from the group's own perspective.
  // Writes through to each admin's permissions.ticketGroupIds - the same field
  // the per-admin UI edits - so both views of the same data always agree.
  async setGroupAdminAccess(groupId: string, adminIds: string[], actingAdmin: AdminIdentity) {
    const group = await this.groupsRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const allGroups = await this.groupsRepository.find();
    const allGroupIds = allGroups.map((g) => g.id);
    const admins = await this.adminsRepository.find({ where: { is_super_admin: false } });
    const ticketAdmins = admins.filter((a) => a.permissions?.tickets);

    for (const admin of ticketAdmins) {
      const currentIds = admin.permissions.ticketGroupIds;
      const currentlyHasAccess = !currentIds || currentIds.length === 0 ? true : currentIds.includes(groupId);
      const shouldHaveAccess = adminIds.includes(admin.id);
      if (shouldHaveAccess === currentlyHasAccess) continue;

      const baseIds = currentIds && currentIds.length > 0 ? currentIds : allGroupIds;
      const nextIds = shouldHaveAccess ? [...new Set([...baseIds, groupId])] : baseIds.filter((id) => id !== groupId);
      admin.permissions = { ...admin.permissions, ticketGroupIds: nextIds };
      await this.adminsRepository.save(admin);
    }

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'TICKET_GROUP_ACCESS_UPDATED', targetType: 'TicketGroup', targetId: group.id, targetLabel: group.name,
      metadata: { adminIds },
    });

    return { success: true };
  }

  // A group an admin's own ticketGroupIds no longer includes shouldn't silently
  // keep working for them - this is what an admin is allowed to see/act on.
  private groupIdsVisibleTo(admin: AdminIdentity): string[] | null {
    if (admin.is_super_admin) return null; // null = no restriction
    const ids = admin.permissions?.ticketGroupIds;
    return ids && ids.length > 0 ? ids : null;
  }

  // --- User-facing ---

  async createTicket(userId: string, groupId: string, subject: string, message: string, imageUrl?: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const group = await this.groupsRepository.findOne({ where: { id: groupId, is_active: true } });
    if (!group) throw new NotFoundException('Selected category is not available');

    const ticket = this.ticketsRepository.create({ user, group, subject, status: 'OPEN' });
    const saved = await this.ticketsRepository.save(ticket);

    await this.messagesRepository.save(
      this.messagesRepository.create({
        ticket: saved,
        sender_type: 'USER',
        sender_id: user.id,
        sender_name: user.username,
        message,
        image_url: imageUrl || null,
      }),
    );

    this.notificationsService.notifyAdmins(
      { permission: 'tickets', groupId: group.id },
      'TICKET_CREATED', 'New support ticket', `${user.username} opened "${subject}" in ${group.name}`, `/tickets/${saved.id}`,
      { type: 'Ticket', id: saved.id },
    );

    return saved;
  }

  async getUserTickets(userId: string) {
    const tickets = await this.ticketsRepository.find({
      where: { user: { id: userId } },
      relations: { group: true, lastResponderAdmin: true },
      order: { updated_at: 'DESC' },
    });
    // Map to a safe shape - lastResponderAdmin is a full Admin entity
    // (password_hash included) via the relation and must never reach the client raw.
    return tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      rating: t.rating,
      closed_by: t.closed_by,
      closed_at: t.closed_at,
      created_at: t.created_at,
      updated_at: t.updated_at,
      group: t.group,
      lastResponderAdmin: t.lastResponderAdmin ? { id: t.lastResponderAdmin.id, username: t.lastResponderAdmin.username } : null,
    }));
  }

  async getTicketThread(ticketId: string, requester: { type: 'USER' | 'ADMIN'; id: string; admin?: AdminIdentity }) {
    const ticket = await this.ticketsRepository.findOne({
      where: { id: ticketId },
      relations: { user: true, group: true, lastResponderAdmin: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (requester.type === 'USER' && ticket.user.id !== requester.id) {
      throw new ForbiddenException('Not your ticket');
    }
    if (requester.type === 'ADMIN' && requester.admin) {
      const visibleGroupIds = this.groupIdsVisibleTo(requester.admin);
      if (visibleGroupIds && !visibleGroupIds.includes(ticket.group.id)) {
        throw new ForbiddenException("You don't have access to this ticket's category");
      }
    }

    const messages = await this.messagesRepository.find({
      where: { ticket: { id: ticketId } },
      order: { created_at: 'ASC' },
    });

    return { ticket, messages };
  }

  async replyToTicket(ticketId: string, message: string, sender: { type: 'USER' | 'ADMIN'; id: string; name?: string; admin?: AdminIdentity }, imageUrl?: string) {
    const ticket = await this.ticketsRepository.findOne({ where: { id: ticketId }, relations: { user: true, group: true } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (sender.type === 'USER' && ticket.user.id !== sender.id) {
      throw new ForbiddenException('Not your ticket');
    }
    if (sender.type === 'ADMIN' && sender.admin) {
      const visibleGroupIds = this.groupIdsVisibleTo(sender.admin);
      if (visibleGroupIds && !visibleGroupIds.includes(ticket.group.id)) {
        throw new ForbiddenException("You don't have access to this ticket's category");
      }
    }

    // The user JWT doesn't carry a username, so it's never trusted from the
    // caller for the USER case - look up the real one from the DB instead.
    const senderName = sender.type === 'USER' ? ticket.user.username : sender.name || 'Admin';

    await this.messagesRepository.save(
      this.messagesRepository.create({
        ticket,
        sender_type: sender.type,
        sender_id: sender.id,
        sender_name: senderName,
        message,
        image_url: imageUrl || null,
      }),
    );

    // A user replying to a closed ticket reopens it; an admin only replies to
    // open ones anyway (the UI won't offer it), but stays defensive here too.
    if (sender.type === 'USER' && ticket.status === 'CLOSED') {
      ticket.status = 'OPEN';
      ticket.closed_by = null;
      ticket.closed_at = null;
    }
    if (sender.type === 'ADMIN' && sender.admin) {
      const admin = await this.adminsRepository.findOne({ where: { id: sender.admin.id } });
      if (admin) ticket.lastResponderAdmin = admin;
    }
    await this.ticketsRepository.save(ticket);

    if (sender.type === 'ADMIN') {
      this.notificationsService.notifyUser(
        ticket.user.id, 'TICKET_REPLY', 'New reply on your ticket',
        `${senderName} replied to "${ticket.subject}"`, `/tickets/${ticket.id}`,
        { type: 'Ticket', id: ticket.id },
      );
    } else {
      this.notificationsService.notifyAdmins(
        { permission: 'tickets', groupId: ticket.group.id },
        'TICKET_REPLY', 'New ticket reply', `${senderName} replied to "${ticket.subject}"`, `/tickets/${ticket.id}`,
        { type: 'Ticket', id: ticket.id },
      );
    }

    return { success: true };
  }

  async closeTicket(ticketId: string, closedBy: 'USER' | 'ADMIN', requesterId: string, rating?: number) {
    const ticket = await this.ticketsRepository.findOne({ where: { id: ticketId }, relations: { user: true } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (closedBy === 'USER' && ticket.user.id !== requesterId) {
      throw new ForbiddenException('Not your ticket');
    }

    if (rating !== undefined && closedBy !== 'USER') {
      throw new BadRequestException('Only the ticket owner can rate it');
    }

    ticket.status = 'CLOSED';
    ticket.closed_by = closedBy;
    ticket.closed_at = new Date();
    if (rating !== undefined) ticket.rating = rating;

    const saved = await this.ticketsRepository.save(ticket);
    this.notificationsService.resolveByRelated('Ticket', ticket.id);
    return saved;
  }

  // --- Admin-facing ---

  // Lets an admin move a misfiled ticket into the correct category. The
  // destination is only checked for existing+active; the acting admin still
  // needs visibility into the ticket's *current* group (enforced below) - once
  // moved, it simply leaves their queue if the new group isn't theirs.
  async reassignTicketGroup(ticketId: string, newGroupId: string, admin: AdminIdentity) {
    const ticket = await this.ticketsRepository.findOne({ where: { id: ticketId }, relations: { group: true } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const visibleGroupIds = this.groupIdsVisibleTo(admin);
    if (visibleGroupIds && !visibleGroupIds.includes(ticket.group.id)) {
      throw new ForbiddenException("You don't have access to this ticket's category");
    }

    const newGroup = await this.groupsRepository.findOne({ where: { id: newGroupId, is_active: true } });
    if (!newGroup) throw new NotFoundException('Target category not found or inactive');

    ticket.group = newGroup;
    return this.ticketsRepository.save(ticket);
  }

  async getAdminTickets(admin: AdminIdentity) {
    const visibleGroupIds = this.groupIdsVisibleTo(admin);
    return this.ticketsRepository.find({
      where: visibleGroupIds ? { group: { id: In(visibleGroupIds) } } : {},
      relations: { user: true, group: true, lastResponderAdmin: true },
      order: { updated_at: 'DESC' },
    });
  }

  // Average rating per admin, for the super admin's Admins page - "the admin
  // receives the rating" from the user's spec.
  async getAdminRatingStats() {
    const rows: { adminId: string; avg: string; count: string }[] = await this.ticketsRepository
      .createQueryBuilder('ticket')
      .select('ticket.last_responder_admin_id', 'adminId')
      .addSelect('AVG(ticket.rating)', 'avg')
      .addSelect('COUNT(ticket.rating)', 'count')
      .where('ticket.rating IS NOT NULL')
      .groupBy('ticket.last_responder_admin_id')
      .getRawMany();

    return rows
      .filter((r) => r.adminId)
      .map((r) => ({ adminId: r.adminId, averageRating: Math.round(Number(r.avg) * 10) / 10, ratingCount: Number(r.count) }));
  }
}
