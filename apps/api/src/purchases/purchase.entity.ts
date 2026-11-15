import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { Wallet } from './wallet.entity';
import { Order } from './order.entity';
import { ProductPricingTier } from '../products/product-pricing-tier.entity';

@Entity('purchases')
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  // Nullable - only set for line items created through the cart checkout.
  // Older/legacy standalone purchases (pre-cart) have no parent order.
  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  // Tracks which exact tier this purchase used, purely so one-time-use tiers
  // can be enforced ("has this user already bought this tier"). Price/duration
  // above stay copied at submission time regardless - this FK is never read
  // to derive them, so a later tier edit/delete can't retroactively change a
  // past purchase's price.
  @ManyToOne(() => ProductPricingTier, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tier_id' })
  tier: ProductPricingTier | null;

  // No longer unique here - every item in one cart order legitimately shares
  // the same on-chain txid. Order.tx_id is the real uniqueness boundary now.
  @Column()
  tx_id: string;

  @Column({ type: 'enum', enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' })
  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  @Column()
  duration_days: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: number;

  // Set only when an admin rejects this transaction - shown to the user in
  // their billing history so they know what to fix before resubmitting.
  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @CreateDateColumn()
  created_at: Date;
}