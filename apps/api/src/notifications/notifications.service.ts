import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';
import { Admin, AdminPermissions } from '../admin/admin.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notificationsRepository: Repository<Notification>,
    @InjectRepository(Admin) private adminsRepository: Repository<Admin>,
  ) {}

  async notifyUser(
    userId: string, type: NotificationType, title: string, message: string, link?: string,
    related?: { type: string; id: string },
  ) {
    const notification = this.notificationsRepository.create({
      recipient_type: 'USER', recipient_id: userId, type, title, message, link: link ?? null,
      related_type: related?.type ?? null, related_id: related?.id ?? null,
    });
    await this.notificationsRepository.save(notification).catch((err) => console.error('Notification write failed:', err.message));
  }

  // Fans out to every active admin who can act on it - super admins always,
  // everyone else only if they hold the given permission. `groupIds` further
  // narrows ticket-related notices to admins actually scoped to that category
  // (mirrors TicketsService.groupIdsVisibleTo's null/empty-means-all rule).
  async notifyAdmins(
    opts: { permission: keyof AdminPermissions; groupId?: string },
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
    related?: { type: string; id: string },
  ) {
    const admins = await this.adminsRepository.find({ where: { is_active: true } });
    const targets = admins.filter((a) => {
      if (a.is_super_admin) return true;
      if (!a.permissions?.[opts.permission]) return false;
      if (opts.groupId && opts.permission === 'tickets') {
        const ids = a.permissions.ticketGroupIds;
        if (ids && ids.length > 0 && !ids.includes(opts.groupId)) return false;
      }
      return true;
    });

    for (const admin of targets) {
      const notification = this.notificationsRepository.create({
        recipient_type: 'ADMIN', recipient_id: admin.id, type, title, message, link: link ?? null,
        related_type: related?.type ?? null, related_id: related?.id ?? null,
      });
      await this.notificationsRepository.save(notification).catch((err) => console.error('Notification write failed:', err.message));
    }
  }

  // Called once the thing a notification pointed at has actually been
  // handled (e.g. an Order got approved/rejected) so it stops showing up as
  // outstanding work for whoever hasn't clicked into it yet.
  async resolveByRelated(relatedType: string, relatedId: string) {
    await this.notificationsRepository.update(
      { related_type: relatedType, related_id: relatedId, is_read: false },
      { is_read: true },
    );
  }

  async getMyNotifications(recipientType: 'ADMIN' | 'USER', recipientId: string, limit = 30) {
    return this.notificationsRepository.find({
      where: { recipient_type: recipientType, recipient_id: recipientId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async getUnreadCount(recipientType: 'ADMIN' | 'USER', recipientId: string) {
    const count = await this.notificationsRepository.count({
      where: { recipient_type: recipientType, recipient_id: recipientId, is_read: false },
    });
    return { count };
  }

  async markRead(notificationId: string, recipientType: 'ADMIN' | 'USER', recipientId: string) {
    const notification = await this.notificationsRepository.findOne({ where: { id: notificationId } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.recipient_type !== recipientType || notification.recipient_id !== recipientId) {
      throw new ForbiddenException('Not your notification');
    }
    notification.is_read = true;
    return this.notificationsRepository.save(notification);
  }

  async markAllRead(recipientType: 'ADMIN' | 'USER', recipientId: string) {
    await this.notificationsRepository.update(
      { recipient_type: recipientType, recipient_id: recipientId, is_read: false },
      { is_read: true },
    );
    return { success: true };
  }
}
