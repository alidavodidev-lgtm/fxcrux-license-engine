import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// The fixed, deliberately-bounded set of "important" events an admin can
// audit - not every request (e.g. no per-tick license validation, no every
// ticket message). Keep this list and the frontend's ACTION_LABELS in sync.
export const AUDIT_ACTIONS = [
  'ADMIN_LOGIN', 'ADMIN_PASSWORD_CHANGED', 'ADMIN_CREATED', 'ADMIN_UPDATED',
  'ADMIN_PROMOTED', 'ADMIN_DEMOTED', 'ADMIN_STATUS_CHANGED', 'ADMIN_PERMISSIONS_UPDATED',
  'USER_REGISTERED', 'USER_LOGIN', 'USER_PASSWORD_CHANGED', 'USER_STATUS_CHANGED',
  'USER_HARDWARE_RESET', 'USER_HARDWARE_BOUND', 'USER_UPDATED',
  'PURCHASE_SUBMITTED', 'PURCHASE_APPROVED', 'PURCHASE_REJECTED',
  'LICENSE_ISSUED_MANUAL', 'LICENSE_DATE_UPDATED', 'LICENSE_STATUS_CHANGED',
  'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'TIER_CREATED', 'TIER_UPDATED', 'TIER_DELETED',
  'PRODUCT_GROUP_CREATED', 'PRODUCT_GROUP_STATUS_CHANGED',
  'APP_VERSION_CREATED', 'APP_VERSION_UPDATED', 'APP_VERSION_DELETED',
  'APP_VERSION_ACCESS_ALL_USERS', 'APP_VERSION_ACCESS_ASSIGNED',
  'WALLET_CREATED', 'WALLET_UPDATED',
  'TICKET_GROUP_CREATED', 'TICKET_GROUP_STATUS_CHANGED', 'TICKET_GROUP_ACCESS_UPDATED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'enum', enum: ['ADMIN', 'USER', 'SYSTEM'] })
  actor_type: 'ADMIN' | 'USER' | 'SYSTEM';

  @Column({ type: 'uuid', nullable: true })
  actor_id: string | null;

  // Denormalized so the log stays readable even if the actor is later
  // renamed, deleted, or demoted - it's a record of what happened, not a live join.
  @Column({ type: 'varchar', nullable: true })
  actor_label: string | null;

  @Index()
  @Column()
  action: string;

  @Column({ type: 'varchar', nullable: true })
  target_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  target_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  target_label: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'varchar', nullable: true })
  ip_address: string | null;

  @Index()
  @CreateDateColumn()
  created_at: Date;
}
