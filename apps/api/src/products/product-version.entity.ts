import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';

// A single installable build of a product's app, gated independently of the
// product's own single-file download (Product.file_original_name/file_stored_name,
// left untouched - see ProductVersionsService for why this is a parallel system).
// access_mode + ProductVersionAccess together enforce two invariants at the
// service layer: only one version per product can be ALL_USERS at a time, and
// a user can never have SPECIFIC access to more than one version of the same
// product (see ProductVersionsService.setAllUsersAccess/assignSpecificUsers).
@Entity('product_versions')
export class ProductVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  version: string;

  // Free text, same convention as ProductGroup.name - no fixed platform list
  // exists anywhere in this codebase.
  @Column({ type: 'varchar', nullable: true })
  platform: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Public URL, same image_url/publicUploadUrl() pattern as Product.
  @Column({ type: 'varchar', nullable: true })
  icon_url: string | null;

  // Same split as Product.file_original_name/file_stored_name: display name
  // is safe to expose, the on-disk name is select:false and never statically
  // served - only reachable via the token-gated download endpoint.
  @Column({ type: 'varchar', nullable: true })
  installer_original_name: string | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  installer_stored_name: string | null;

  @Column({ type: 'enum', enum: ['ALL_USERS', 'SPECIFIC'], default: 'SPECIFIC' })
  access_mode: 'ALL_USERS' | 'SPECIFIC';

  // A deactivated version is excluded from access-resolution (nobody gets
  // pointed to it by checkVersionForUser) without deleting its history/access rows.
  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}
