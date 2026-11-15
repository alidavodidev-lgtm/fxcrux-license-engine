import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

// Admin-defined categories a user must pick from when opening a ticket. Also
// what an admin's `permissions.ticketGroupIds` scopes them to (see Admin entity).
@Entity('ticket_groups')
export class TicketGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}
