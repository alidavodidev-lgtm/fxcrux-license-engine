import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';

// One license row per (user, product) - issueOrExtendLicense relies on this to
// stack repeat purchases onto the same row instead of creating duplicates; the
// constraint is the real enforcement (checked-then-insert alone can race).
@Entity('licenses')
@Index('uq_licenses_user_product', ['user', 'product'], { unique: true })
export class License {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  license_key: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  expires_at: Date;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  paid_amount: number;

  @Column({ default: false })
  is_manual: boolean;

@Column({ default: 'active' })
  status: string;

  // Distinct from is_manual (creation-time only) - set whenever an admin edits
  // this license's expiry directly via updateLicenseDate(), regardless of
  // whether the license itself was purchase-originated or manually issued.
  @Column({ default: false })
  date_manually_adjusted: boolean;

}