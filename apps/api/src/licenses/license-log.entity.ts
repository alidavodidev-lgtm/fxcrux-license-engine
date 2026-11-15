import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('license_logs')
export class LicenseLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  license_key: string;

  @Column({ type: 'varchar', nullable: true })
  machine_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  ip_address: string | null;

  @Column()
  status: 'SUCCESS' | 'FAILED';

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn()
  created_at: Date;
}