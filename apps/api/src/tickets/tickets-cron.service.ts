import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Not, IsNull, Repository } from 'typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Ticket } from './ticket.entity';
import { TicketMessage } from './ticket-message.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { localUploadPath } from '../common/upload/upload-url.util';

const AUTO_CLOSE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const ATTACHMENT_CLEANUP_AFTER_MS = 5 * 24 * 60 * 60 * 1000;

@Injectable()
export class TicketsCronService {
  private readonly logger = new Logger(TicketsCronService.name);

  constructor(
    @InjectRepository(Ticket) private ticketsRepository: Repository<Ticket>,
    @InjectRepository(TicketMessage) private messagesRepository: Repository<TicketMessage>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // A ticket nobody has touched (either side) in 3 days closes itself, so
  // stale threads don't sit open forever waiting on a reply that isn't coming.
  @Cron(CronExpression.EVERY_HOUR)
  async autoCloseIdleTickets() {
    const cutoff = new Date(Date.now() - AUTO_CLOSE_AFTER_MS);
    const stale = await this.ticketsRepository.find({
      where: { status: 'OPEN', updated_at: LessThan(cutoff) },
      relations: { user: true, group: true },
    });

    for (const ticket of stale) {
      ticket.status = 'CLOSED';
      ticket.closed_by = 'SYSTEM';
      ticket.closed_at = new Date();
      await this.ticketsRepository.save(ticket);

      this.notificationsService.notifyUser(
        ticket.user.id, 'TICKET_REPLY', 'Ticket auto-closed',
        `"${ticket.subject}" was closed automatically after 3 days of inactivity.`, `/tickets/${ticket.id}`,
      );
      this.notificationsService.notifyAdmins(
        { permission: 'tickets', groupId: ticket.group.id },
        'TICKET_REPLY', 'Ticket auto-closed',
        `"${ticket.subject}" (${ticket.user.username}) was closed automatically after 3 days of inactivity.`, `/tickets/${ticket.id}`,
      );
    }

    if (stale.length > 0) this.logger.log(`Auto-closed ${stale.length} idle ticket(s)`);
  }

  // Attachments only stick around for 5 days after a ticket closes - the
  // message text itself is untouched, only the image (file + reference).
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldAttachments() {
    const cutoff = new Date(Date.now() - ATTACHMENT_CLEANUP_AFTER_MS);
    const closedTickets = await this.ticketsRepository.find({
      where: { status: 'CLOSED', closed_at: LessThan(cutoff) },
    });
    if (closedTickets.length === 0) return;

    const messages = await this.messagesRepository.find({
      where: { ticket: { id: In(closedTickets.map((t) => t.id)) }, image_url: Not(IsNull()) },
      relations: { ticket: true },
    });

    for (const message of messages) {
      const localPath = localUploadPath(message.image_url);
      if (localPath) {
        await unlink(join(process.cwd(), localPath)).catch(() => {});
      }
      message.image_url = null;
      await this.messagesRepository.save(message);
    }

    if (messages.length > 0) this.logger.log(`Cleaned up ${messages.length} old ticket attachment(s)`);
  }
}
