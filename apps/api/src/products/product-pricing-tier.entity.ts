import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity('product_pricing_tiers')
export class ProductPricingTier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  label: string;

  // Days of validity granted by this tier. Lifetime uses the same 36500-day
  // sentinel already used by the admin's manual license-issue flow.
  @Column({ type: 'int' })
  duration_days: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ default: true })
  is_active: boolean;

  // When true, a single user may only ever hold one PENDING/APPROVED purchase
  // of this exact tier (e.g. a one-time free trial plan) - enforced in
  // PurchasesService.submitPurchase()/submitCart().
  @Column({ default: false })
  is_one_time: boolean;

  // Soft-delete only - Purchase rows copy product/duration/amount at
  // submission time rather than referencing a tier by FK, so there's no
  // integrity risk in a hard delete, but keeping history around (just
  // hidden from the admin list) is the safer default and matches what a
  // "delete" button should feel like without actually destroying data.
  @Column({ default: false })
  is_deleted: boolean;

  @CreateDateColumn()
  created_at: Date;
}
