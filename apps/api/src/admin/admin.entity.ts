import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export interface AdminPermissions {
  purchases: boolean;
  products: boolean;
  users: boolean;
  licenses: boolean;
  wallets: boolean;
  logs: boolean;
  tickets: boolean;
  reports: boolean;
  // Only meaningful when tickets=true. null/empty = every group; otherwise the
  // admin only sees tickets whose group id is in this list.
  ticketGroupIds: string[] | null;
}

export const NO_ADMIN_PERMISSIONS: AdminPermissions = {
  purchases: false,
  products: false,
  users: false,
  licenses: false,
  wallets: false,
  logs: false,
  tickets: false,
  reports: false,
  ticketGroupIds: null,
};

@Entity('admins')
export class Admin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password_hash: string;

  // Super admins bypass per-section permission checks entirely and are the
  // only accounts allowed to create/manage other admins.
  @Column({ default: false })
  is_super_admin: boolean;

  // A deactivated admin's existing JWT stops working immediately - AdminAuthGuard
  // re-checks this from the DB on every request, it's never trusted from the token.
  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'jsonb', default: () => `'${JSON.stringify(NO_ADMIN_PERMISSIONS)}'` })
  permissions: AdminPermissions;

  // Bumped on every successful login and embedded in the JWT as `sv`. AdminAuthGuard
  // compares the token's `sv` against this on every request - a mismatch means the
  // token belongs to a session superseded by a later login, so it's rejected. This
  // enforces "only one active admin session per account" without a server-side token store.
  @Column({ default: 1 })
  session_version: number;

  @CreateDateColumn()
  created_at: Date;
}