import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { Wallet } from './wallet.entity';
import { Purchase } from './purchase.entity';
import { Order } from './order.entity';
import { User } from '../users/user.entity';
import { ProductPricingTier } from '../products/product-pricing-tier.entity';
import { LicensesService } from '../licenses/licenses.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CartService } from '../cart/cart.service';
import { SubmitCartDto } from './dto/submit-cart.dto';

interface ActingAdmin {
  id: string;
  username: string;
}

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Wallet)
    private walletsRepository: Repository<Wallet>,

    @InjectRepository(Purchase)
    private purchasesRepository: Repository<Purchase>,

    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,

    @InjectRepository(ProductPricingTier)
    private tiersRepository: Repository<ProductPricingTier>,

    private readonly licensesService: LicensesService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
    private readonly cartService: CartService,
  ) {}

  // Retrieve active wallets for the frontend
  async getActiveWallets() {
    return this.walletsRepository.find({ where: { is_active: true } });
  }

  // Create a new purchase record. Price and duration come only from the
  // authoritative tier record server-side — never from client input.
  async submitPurchase(userOrId: any, tierId: string, walletId: string, txId: string) {
    const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;

    const tier = await this.tiersRepository.findOne({
      where: { id: tierId },
      relations: { product: true },
    });

    if (!tier || !tier.is_active || !tier.product || !tier.product.is_active) {
      throw new NotFoundException('Selected pricing tier is not available');
    }

    if (tier.is_one_time) {
      const alreadyPurchased = await this.purchasesRepository.findOne({
        where: { user: { id: userId }, tier: { id: tier.id }, status: In(['PENDING', 'APPROVED']) },
      });
      if (alreadyPurchased) {
        throw new BadRequestException('This plan can only be purchased once per user, and you have already purchased it.');
      }
    }

    try {
      const purchase = this.purchasesRepository.create({
        user: { id: userId },
        product: { id: tier.product.id },
        wallet: { id: walletId },
        tier: { id: tier.id },
        tx_id: txId,
        duration_days: tier.duration_days,
        amount: tier.price,
        status: 'PENDING',
      });

      const saved = await this.purchasesRepository.save(purchase);

      this.auditLogService.record({
        actorType: 'USER', actorId: userId,
        action: 'PURCHASE_SUBMITTED', targetType: 'Purchase', targetId: saved.id, targetLabel: tier.product.name,
        metadata: { amount: tier.price, duration_days: tier.duration_days, tx_id: txId },
      });

      this.notificationsService.notifyAdmins(
        { permission: 'purchases' },
        'PURCHASE_SUBMITTED', 'New transaction submitted',
        `A customer submitted a TXID for ${tier.product.name} ($${tier.price}) - awaiting review.`, '/purchases',
        { type: 'Purchase', id: saved.id },
      );

      return saved;

    } catch (error: any) {
      // Catch unique constraint violation (duplicate TXID)
      if (error.code === '23505' || error.message.includes('unique constraint')) {
        throw new ConflictException('This TXID has already been submitted and is currently under review.');
      }
      // Re-throw other unexpected database errors
      console.error('Purchase Submission Error:', error.message);
      throw error;
    }
  }

  // Cart checkout: one shared txid/payment covering N line items. Each item
  // still becomes its own Purchase row (so per-item license issuance and the
  // existing revenue-stats queries keep working unchanged) grouped under one
  // new Order, which is what an admin actually approves/rejects as a whole.
  async submitCart(userId: string, dto: SubmitCartDto) {
    const tiers = await Promise.all(
      dto.items.map((item) => this.tiersRepository.findOne({ where: { id: item.tierId }, relations: { product: true } })),
    );

    for (const tier of tiers) {
      if (!tier || !tier.is_active || !tier.product || !tier.product.is_active) {
        throw new NotFoundException('One or more selected pricing tiers are not available');
      }
    }

    const validTiers = tiers as ProductPricingTier[];
    const totalAmount = validTiers.reduce((sum, t) => sum + Number(t.price), 0);

    const oneTimeTierIds = validTiers.filter((t) => t.is_one_time).map((t) => t.id);
    if (oneTimeTierIds.length > 0) {
      const alreadyPurchased = await this.purchasesRepository.find({
        where: { user: { id: userId }, tier: { id: In(oneTimeTierIds) }, status: In(['PENDING', 'APPROVED']) },
        relations: { tier: true },
      });
      if (alreadyPurchased.length > 0) {
        const labels = alreadyPurchased.map((p) => p.tier?.label).filter(Boolean).join(', ');
        throw new BadRequestException(`The following plans can only be purchased once and have already been purchased by you: ${labels}`);
      }
    }

    try {
      const order = this.ordersRepository.create({
        user: { id: userId },
        wallet: { id: dto.walletId },
        payment_method: dto.paymentMethod || 'CRYPTO_MANUAL',
        tx_id: dto.txId,
        total_amount: totalAmount,
        status: 'PENDING',
      });
      const savedOrder = await this.ordersRepository.save(order);

      for (const tier of validTiers) {
        const purchase = this.purchasesRepository.create({
          user: { id: userId },
          product: { id: tier.product.id },
          wallet: { id: dto.walletId },
          order: savedOrder,
          tier: { id: tier.id },
          tx_id: dto.txId,
          duration_days: tier.duration_days,
          amount: tier.price,
          status: 'PENDING',
        });
        await this.purchasesRepository.save(purchase);
      }

      const productNames = validTiers.map((t) => t.product.name).join(', ');

      this.auditLogService.record({
        actorType: 'USER', actorId: userId,
        action: 'PURCHASE_SUBMITTED', targetType: 'Order', targetId: savedOrder.id, targetLabel: productNames,
        metadata: { amount: totalAmount, itemCount: validTiers.length, tx_id: dto.txId },
      });

      this.notificationsService.notifyAdmins(
        { permission: 'purchases' },
        'PURCHASE_SUBMITTED', 'New transaction submitted',
        `A customer submitted a TXID for ${productNames} ($${totalAmount}) - awaiting review.`, '/purchases',
        { type: 'Order', id: savedOrder.id },
      );

      // The items just checked out no longer belong in the cart.
      await this.cartService.clearCart(userId);

      return savedOrder;
    } catch (error: any) {
      if (error.code === '23505' || error.message?.includes('unique constraint')) {
        throw new ConflictException('This TXID has already been submitted and is currently under review.');
      }
      console.error('Cart Submission Error:', error.message);
      throw error;
    }
  }

  // Retrieve purchases for a specific user
  async getUserPurchases(userId: string) {
    return this.purchasesRepository.find({
      where: { user: { id: userId } },
      relations: { product: true, tier: true },
      order: { created_at: 'DESC' }
    });
  }

  // Retrieve all pending purchases for the admin panel. Unifies cart-based
  // Orders and any pre-cart standalone Purchase rows into one "order" shape
  // (a single item is just an order of size one) so the admin UI only has to
  // render one thing.
  async getPendingPurchases() {
    const orders = await this.ordersRepository.find({
      where: { status: 'PENDING' },
      relations: { user: true, wallet: true, purchases: { product: true } },
      order: { created_at: 'DESC' },
    });

    const legacyPurchases = await this.purchasesRepository.find({
      where: { status: 'PENDING', order: IsNull() },
      relations: { user: true, product: true, wallet: true },
      order: { created_at: 'DESC' },
    });

    const fromOrders = orders.map((o) => ({
      id: o.id,
      user: o.user,
      wallet: o.wallet,
      tx_id: o.tx_id,
      payment_method: o.payment_method,
      status: o.status,
      total_amount: o.total_amount,
      created_at: o.created_at,
      items: o.purchases.map((p) => ({ id: p.id, product: p.product, duration_days: p.duration_days, amount: p.amount })),
    }));

    const fromLegacy = legacyPurchases.map((p) => ({
      id: p.id,
      user: p.user,
      wallet: p.wallet,
      tx_id: p.tx_id,
      payment_method: 'CRYPTO_MANUAL',
      status: p.status,
      total_amount: p.amount,
      created_at: p.created_at,
      items: [{ id: p.id, product: p.product, duration_days: p.duration_days, amount: p.amount }],
    }));

    return [...fromOrders, ...fromLegacy].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  // Update wallet details
  async updateWallet(id: string, updateData: { network?: string; address?: string; description?: string; is_active?: boolean }, actingAdmin: ActingAdmin) {
    const wallet = await this.walletsRepository.findOne({ where: { id } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    Object.assign(wallet, updateData);
    const saved = await this.walletsRepository.save(wallet);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'WALLET_UPDATED', targetType: 'Wallet', targetId: saved.id, targetLabel: saved.network,
    });

    return saved;
  }

  // Add a new crypto wallet
  async addWallet(network: string, address: string, description: string, actingAdmin: ActingAdmin) {
    const wallet = this.walletsRepository.create({
      network,
      address,
      description,
      is_active: true,
    });
    const saved = await this.walletsRepository.save(wallet);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'WALLET_CREATED', targetType: 'Wallet', targetId: saved.id, targetLabel: saved.network,
    });

    return saved;
  }

  // Admin action: Approve purchase and issue (or extend) the license
  async approvePurchase(purchaseId: string, actingAdmin: ActingAdmin) {
    const purchase = await this.purchasesRepository.findOne({
      where: { id: purchaseId },
      relations: { user: true, product: true }
    });

    if (!purchase) throw new NotFoundException('Purchase not found');

    purchase.status = 'APPROVED';
    await this.purchasesRepository.save(purchase);
    this.notificationsService.resolveByRelated('Purchase', purchase.id);

    const license = await this.licensesService.issueOrExtendLicense(
      purchase.user,
      purchase.product,
      purchase.duration_days || 30,
      purchase.amount,
      false,
    );

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'PURCHASE_APPROVED', targetType: 'Purchase', targetId: purchase.id,
      targetLabel: `${purchase.user?.username} / ${purchase.product?.name}`,
      metadata: { amount: purchase.amount },
    });

    this.notificationsService.notifyUser(
      purchase.user.id, 'PURCHASE_APPROVED', 'Purchase approved',
      `Your purchase of ${purchase.product?.name} was approved - your license is active.`, '/licenses',
    );

    return license;
  }

  // Admin action: Reject an invalid transaction
  async rejectPurchase(purchaseId: string, actingAdmin: ActingAdmin, reason?: string) {
    const purchase = await this.purchasesRepository.findOne({ where: { id: purchaseId }, relations: { user: true, product: true } });
    if (!purchase) throw new Error('Purchase not found');

    purchase.status = 'REJECTED';
    purchase.rejection_reason = reason?.trim() || null;
    const saved = await this.purchasesRepository.save(purchase);
    this.notificationsService.resolveByRelated('Purchase', saved.id);

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'PURCHASE_REJECTED', targetType: 'Purchase', targetId: saved.id,
      targetLabel: `${purchase.user?.username} / ${purchase.product?.name}`,
      metadata: reason ? { reason } : null,
    });

    this.notificationsService.notifyUser(
      purchase.user.id, 'PURCHASE_REJECTED', 'Purchase rejected',
      reason
        ? `Your purchase of ${purchase.product?.name} was rejected: ${reason}`
        : `Your purchase of ${purchase.product?.name} was rejected. See Billing for details.`,
      '/billing',
    );

    return saved;
  }

  // Admin action: approve every item in a cart order at once, issuing/extending
  // a license per item, with a single audit entry + notification for the order.
  async approveOrder(orderId: string, actingAdmin: ActingAdmin) {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: { user: true, purchases: { product: true } },
    });
    if (!order) throw new NotFoundException('Order not found');

    order.status = 'APPROVED';
    await this.ordersRepository.save(order);
    this.notificationsService.resolveByRelated('Order', order.id);

    for (const item of order.purchases) {
      item.status = 'APPROVED';
      await this.purchasesRepository.save(item);
      await this.licensesService.issueOrExtendLicense(order.user, item.product, item.duration_days || 30, item.amount, false);
    }

    const productNames = order.purchases.map((p) => p.product.name).join(', ');

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'PURCHASE_APPROVED', targetType: 'Order', targetId: order.id,
      targetLabel: `${order.user?.username} / ${productNames}`,
      metadata: { amount: order.total_amount, itemCount: order.purchases.length },
    });

    this.notificationsService.notifyUser(
      order.user.id, 'PURCHASE_APPROVED', 'Purchase approved',
      `Your purchase of ${productNames} was approved - your license${order.purchases.length > 1 ? 's are' : ' is'} active.`, '/licenses',
    );

    return { success: true };
  }

  // Admin action: reject every item in a cart order at once, with one shared reason.
  async rejectOrder(orderId: string, actingAdmin: ActingAdmin, reason?: string) {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: { user: true, purchases: { product: true } },
    });
    if (!order) throw new NotFoundException('Order not found');

    order.status = 'REJECTED';
    order.rejection_reason = reason?.trim() || null;
    const saved = await this.ordersRepository.save(order);
    this.notificationsService.resolveByRelated('Order', saved.id);

    for (const item of order.purchases) {
      item.status = 'REJECTED';
      item.rejection_reason = saved.rejection_reason;
      await this.purchasesRepository.save(item);
    }

    const productNames = order.purchases.map((p) => p.product.name).join(', ');

    this.auditLogService.record({
      actorType: 'ADMIN', actorId: actingAdmin.id, actorLabel: actingAdmin.username,
      action: 'PURCHASE_REJECTED', targetType: 'Order', targetId: saved.id,
      targetLabel: `${order.user?.username} / ${productNames}`,
      metadata: reason ? { reason } : null,
    });

    this.notificationsService.notifyUser(
      order.user.id, 'PURCHASE_REJECTED', 'Purchase rejected',
      reason
        ? `Your purchase of ${productNames} was rejected: ${reason}`
        : `Your purchase of ${productNames} was rejected. See Billing for details.`,
      '/billing',
    );

    return saved;
  }

  // Single entry point the admin UI calls - the id could be a cart Order or a
  // pre-cart standalone Purchase, and the UI shouldn't need to know which.
  async approveTransaction(id: string, actingAdmin: ActingAdmin) {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (order) return this.approveOrder(id, actingAdmin);
    return this.approvePurchase(id, actingAdmin);
  }

  async rejectTransaction(id: string, actingAdmin: ActingAdmin, reason?: string) {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (order) return this.rejectOrder(id, actingAdmin, reason);
    return this.rejectPurchase(id, actingAdmin, reason);
  }

  // Revenue + volume stats for the admin dashboard. Only counts APPROVED
  // purchases as revenue - pending/rejected never happened financially.
  async getRevenueStats() {
    const approved = await this.purchasesRepository.find({
      where: { status: 'APPROVED' },
      select: { amount: true, created_at: true },
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const daily = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - i);
      daily.set(d.toISOString().slice(0, 10), 0);
    }

    let last7Days = 0;
    let currentMonth = 0;
    let allTime = 0;

    for (const p of approved) {
      const amount = Number(p.amount);
      allTime += amount;
      if (p.created_at >= startOfMonth) currentMonth += amount;

      const sevenDaysAgo = new Date(startOfToday);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      if (p.created_at >= sevenDaysAgo) last7Days += amount;

      const key = p.created_at.toISOString().slice(0, 10);
      if (daily.has(key)) daily.set(key, (daily.get(key) || 0) + amount);
    }

    const [pendingCount, rejectedCount, approvedCount] = await Promise.all([
      this.purchasesRepository.count({ where: { status: 'PENDING' } }),
      this.purchasesRepository.count({ where: { status: 'REJECTED' } }),
      this.purchasesRepository.count({ where: { status: 'APPROVED' } }),
    ]);

    return {
      totals: {
        last7Days: Math.round(last7Days * 100) / 100,
        currentMonth: Math.round(currentMonth * 100) / 100,
        allTime: Math.round(allTime * 100) / 100,
      },
      daily: Array.from(daily.entries()).map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 })),
      statusBreakdown: { approved: approvedCount, pending: pendingCount, rejected: rejectedCount },
    };
  }
}