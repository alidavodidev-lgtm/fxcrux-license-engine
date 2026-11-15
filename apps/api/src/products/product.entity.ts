import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { ProductPricingTier } from './product-pricing-tier.entity';
import { ProductGroup } from './product-group.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToMany(() => ProductPricingTier, (tier) => tier.product)
  tiers: ProductPricingTier[];

  // Nullable - a product doesn't have to belong to a category; the store's
  // group filter just won't match it against anything but "All".
  @ManyToOne(() => ProductGroup, { nullable: true })
  @JoinColumn({ name: 'group_id' })
  group: ProductGroup | null;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  version: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  // Shown on the store's product card - a URL, not an uploaded file (no
  // upload/storage pipeline exists yet). Null/empty means no image, same as
  // the current card layout without one.
  @Column({ type: 'varchar', nullable: true })
  image_url: string | null;

  // Downloadable deliverable, gated
  // behind an active license - see ProductsService.getDownloadInfo() and
  // GET /products/:id/download. Deliberately NOT served from the public
  // uploads/ static tree (unlike image_url); stored under a separate,
  // never-statically-served directory instead. Display name only - safe to
  // expose alongside the rest of the public product listing.
  @Column({ type: 'varchar', nullable: true })
  file_original_name: string | null;

  // The actual on-disk filename (randomUUID + ext). select: false keeps it
  // out of default queries (including the public product listing) as a
  // second line of defense on top of not being statically served at all -
  // only getDownloadInfo() explicitly selects it.
  @Column({ type: 'varchar', nullable: true, select: false })
  file_stored_name: string | null;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}
