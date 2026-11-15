import { Entity, Column, PrimaryColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Admin } from '../admin/admin.entity';

// Single-row table (id is always 1) - lazily created on first read by
// SettingsService rather than seeded by a migration, since this repo has no
// migration runner (synchronize: true).
@Entity('system_settings')
export class SystemSettings {
  @PrimaryColumn({ default: 1 })
  id: number;

  @Column({ type: 'int', default: 100 })
  product_image_max_kb: number;

  @Column({ type: 'int', default: 250 })
  ticket_attachment_max_kb: number;

  @Column({ type: 'int', default: 50 })
  product_file_max_mb: number;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Admin, { nullable: true })
  @JoinColumn({ name: 'updated_by_admin_id' })
  updated_by: Admin | null;
}
