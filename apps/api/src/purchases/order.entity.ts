import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Wallet } from './wallet.entity';
import { Purchase } from './purchase.entity';

// Only crypto+manual-review exists today, but this is deliberately a string
// column (not a fixed DB enum) so a future payment integration (PayPal,
// card processor) can be added as a new value without a migration.
export const PAYMENT_METHODS = ['CRYPTO_MANUAL'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// One checkout, possibly covering several cart items (Purchases) paid for
// together with a single shared txid - the thing an admin actually
// approves/rejects. Each line item still carries its own product/duration/
// amount on Purchase for the license-issuing logic already built around it.
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Wallet, { nullable: true })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet | null;

  @Column({ default: 'CRYPTO_MANUAL' })
  payment_method: string;

  // The real uniqueness boundary for "has this txid already been used" -
  // Purchase.tx_id is no longer unique on its own since every item in one
  // order legitimately shares the same on-chain payment.
  @Column({ unique: true })
  tx_id: string;

  @Column({ type: 'enum', enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' })
  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_amount: number;

  @OneToMany(() => Purchase, (purchase) => purchase.order)
  purchases: Purchase[];

  @CreateDateColumn()
  created_at: Date;
}
