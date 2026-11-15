import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// Fan-out at creation: a "broadcast to every admin with permission X" notify
// still creates one row per admin, so each admin's read/unread state is its
// own column on its own row - no separate read-receipts join table needed.
export const NOTIFICATION_TYPES = [
  'TICKET_CREATED', 'TICKET_REPLY',
  'PURCHASE_SUBMITTED', 'PURCHASE_APPROVED', 'PURCHASE_REJECTED',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'enum', enum: ['ADMIN', 'USER'] })
  recipient_type: 'ADMIN' | 'USER';

  @Index()
  @Column({ type: 'uuid' })
  recipient_id: string;

  @Column()
  type: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  // Frontend route to open when the notification is clicked, e.g. /tickets/:id.
  @Column({ type: 'varchar', nullable: true })
  link: string | null;

  // What this notification is actually about (e.g. 'Order'/<order id>,
  // 'Ticket'/<ticket id>) - lets the backend auto-mark it read the moment
  // that thing gets resolved some other way (an order approved/rejected from
  // the Payments page, say), not only when the notification itself is clicked.
  @Column({ type: 'varchar', nullable: true })
  related_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  related_id: string | null;

  @Index()
  @Column({ default: false })
  is_read: boolean;

  @CreateDateColumn()
  created_at: Date;
}
