import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { ProductPricingTier } from '../products/product-pricing-tier.entity';

// Persisted server-side (not localStorage) so a user's cart survives a
// refresh AND a logout/login, on any device, without ever leaking into a
// different user's browser session.
@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => ProductPricingTier)
  @JoinColumn({ name: 'tier_id' })
  tier: ProductPricingTier;

  // Snapshot at add-time - if the tier's live price ever drifts from this,
  // the item is dropped rather than silently re-priced (see CartService.getCart).
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_at_add: number;

  @CreateDateColumn()
  created_at: Date;
}
