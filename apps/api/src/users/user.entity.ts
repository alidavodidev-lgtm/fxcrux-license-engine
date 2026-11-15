import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  machine_id: string | null;

  @Column({ type: 'enum', enum: ['PENDING', 'ACTIVE', 'BANNED'], default: 'ACTIVE' })
  status: 'PENDING' | 'ACTIVE' | 'BANNED';

  // Bumped on every successful login and embedded in the JWT as `sv`. JwtStrategy
  // compares the token's `sv` against this on every request - a mismatch means the
  // token belongs to a session superseded by a later login, so it's rejected. This
  // enforces "only one active session per account" without a server-side token store.
  @Column({ default: 1 })
  session_version: number;

  // Per-account secret used to authenticate the local TerminalGateway
  // (Engine <-> MT4/MT5/NinjaTrader) handshake. Minted once on first
  // hardware-login, never shipped as a global constant - a leaked value
  // only ever affects the one account it belongs to. select: false keeps
  // it out of any default query result (defense in depth, same convention
  // as Product.file_stored_name).
  @Column({ type: 'varchar', nullable: true, select: false })
  terminal_pairing_secret: string | null;

  @CreateDateColumn()
  created_at: Date;
}