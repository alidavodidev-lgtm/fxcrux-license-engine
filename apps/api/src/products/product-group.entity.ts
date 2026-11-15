import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

// Admin-defined categories (e.g. "Developer Tools", "Creative Tools") a product can be
// filed under, so the store page can offer a filter - separate from
// TicketGroup, which categorizes support tickets, not products.
@Entity('product_groups')
export class ProductGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}
