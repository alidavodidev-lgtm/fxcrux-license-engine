import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { ProductVersion } from './product-version.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';

// A SPECIFIC-access grant: this user can see/download this version of this
// product. `product` is denormalized from `version.product` purely so the
// (user, product) unique constraint below is enforceable at the DB level -
// same reasoning as the real unique constraint on License(user, product).
// That constraint is what makes "a user can't have more than one active
// version of a product" a hard guarantee, not just an app-layer convention:
// ProductVersionsService.assignSpecificUsers() upserts on this exact
// conflict target, so re-granting a user a different version of the same
// product atomically moves their single row instead of creating a second one.
@Entity('product_version_access')
@Unique(['user', 'product'])
export class ProductVersionAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProductVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'version_id' })
  version: ProductVersion;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @CreateDateColumn()
  created_at: Date;
}
