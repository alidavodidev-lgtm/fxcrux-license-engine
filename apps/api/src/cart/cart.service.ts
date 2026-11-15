import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from './cart-item.entity';
import { ProductPricingTier } from '../products/product-pricing-tier.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem) private cartRepository: Repository<CartItem>,
    @InjectRepository(ProductPricingTier) private tiersRepository: Repository<ProductPricingTier>,
  ) {}

  // Validates every item against live data as a side effect of reading the
  // cart - a tier that's been deactivated/deleted, a product that's been
  // deactivated, or a price that's drifted since it was added all silently
  // drop the item (never re-price it out from under the user).
  async getCart(userId: string) {
    const items = await this.cartRepository.find({
      where: { user: { id: userId } },
      relations: { tier: { product: true } },
      order: { created_at: 'ASC' },
    });

    const valid: CartItem[] = [];
    const staleIds: string[] = [];

    for (const item of items) {
      const tier = item.tier;
      const stillValid = !!tier && !tier.is_deleted && tier.is_active
        && !!tier.product && tier.product.is_active
        && Number(tier.price) === Number(item.price_at_add);
      if (stillValid) valid.push(item);
      else staleIds.push(item.id);
    }

    if (staleIds.length > 0) {
      await this.cartRepository.delete(staleIds);
    }

    return valid.map((item) => ({
      id: item.id,
      tier: { id: item.tier.id, label: item.tier.label, duration_days: item.tier.duration_days, price: item.tier.price },
      product: { id: item.tier.product.id, name: item.tier.product.name, image_url: item.tier.product.image_url },
    }));
  }

  async addItem(userId: string, tierId: string) {
    const tier = await this.tiersRepository.findOne({ where: { id: tierId }, relations: { product: true } });
    if (!tier || tier.is_deleted || !tier.is_active || !tier.product || !tier.product.is_active) {
      throw new NotFoundException('Selected pricing tier is not available');
    }

    // Replace any existing selection for the same product rather than
    // stacking two entries for it - one plan per product in the cart.
    const existingForProduct = await this.cartRepository.find({
      where: { user: { id: userId } },
      relations: { tier: { product: true } },
    });
    const toRemove = existingForProduct.filter((item) => item.tier?.product?.id === tier.product.id);
    if (toRemove.length > 0) {
      await this.cartRepository.delete(toRemove.map((item) => item.id));
    }

    const cartItem = this.cartRepository.create({
      user: { id: userId } as any,
      tier,
      price_at_add: tier.price,
    });
    await this.cartRepository.save(cartItem);

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.cartRepository.findOne({ where: { id: itemId }, relations: { user: true } });
    if (!item) throw new NotFoundException('Cart item not found');
    if (item.user.id !== userId) throw new ForbiddenException('Not your cart item');

    await this.cartRepository.delete(itemId);
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    await this.cartRepository.delete({ user: { id: userId } as any });
  }
}
