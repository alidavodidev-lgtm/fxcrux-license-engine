import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Admin } from '../admin/admin.entity';
import { TicketGroup } from './ticket-group.entity';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => TicketGroup)
  @JoinColumn({ name: 'group_id' })
  group: TicketGroup;

  @Column()
  subject: string;

  @Column({ type: 'enum', enum: ['OPEN', 'CLOSED'], default: 'OPEN' })
  status: 'OPEN' | 'CLOSED';

  // The most recent admin to reply - credited with the rating below, and how
  // an admin's average rating is computed (see AdminService/tickets stats).
  @ManyToOne(() => Admin, { nullable: true })
  @JoinColumn({ name: 'last_responder_admin_id' })
  lastResponderAdmin: Admin | null;

  @Column({ type: 'enum', enum: ['USER', 'ADMIN', 'SYSTEM'], nullable: true })
  closed_by: 'USER' | 'ADMIN' | 'SYSTEM' | null;

  // 1-5, set only when the user closes+rates. Nullable because an admin-closed
  // ticket (or one the user never rated) simply has no rating.
  @Column({ type: 'int', nullable: true })
  rating: number | null;

  // Set whenever status flips to CLOSED, cleared on reopen - `updated_at`
  // isn't reliable for "how long has this been closed" since other things
  // could in principle touch the row. Drives the 5-day attachment cleanup
  // and is a cleaner signal than reusing updated_at.
  @Column({ type: 'timestamp', nullable: true })
  closed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
