import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Ticket } from './ticket.entity';

@Entity('ticket_messages')
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @Column({ type: 'enum', enum: ['USER', 'ADMIN'] })
  sender_type: 'USER' | 'ADMIN';

  // Either a users.id or an admins.id depending on sender_type - kept as a plain
  // uuid column (not a FK) since it points at one of two different tables.
  @Column()
  sender_id: string;

  @Column()
  sender_name: string;

  @Column({ type: 'text' })
  message: string;

  // Deleted (file + this reference) 5 days after the parent ticket closes -
  // see TicketsCleanupService. Never re-populated once cleared.
  @Column({ type: 'varchar', nullable: true })
  image_url: string | null;

  @CreateDateColumn()
  created_at: Date;
}
