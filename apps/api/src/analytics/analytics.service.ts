import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Purchase } from '../purchases/purchase.entity';
import { User } from '../users/user.entity';
import { License } from '../licenses/license.entity';
import { Ticket } from '../tickets/ticket.entity';
import { TicketGroup } from '../tickets/ticket-group.entity';
import { AuditLog } from '../audit-log/audit-log.entity';

interface FinancialFilters {
  from?: string;
  to?: string;
  groupBy?: string;
  productId?: string;
  categoryId?: string;
  status?: string;
  tierId?: string;
}

interface TransactionsFilters extends FinancialFilters {
  buyerUsername?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: string;
}

interface UsersFilters {
  status?: string;
  hasMachineId?: string;
  registeredFrom?: string;
  registeredTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: string;
}

interface TicketsFilters {
  from?: string;
  to?: string;
  groupBy?: string;
  status?: string;
  groupId?: string;
  adminId?: string;
  userSearch?: string;
}

interface TicketsListFilters extends TicketsFilters {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: string;
}

const TRANSACTION_SORT_COLUMNS: Record<string, string> = {
  created_at: 'p.created_at',
  amount: 'p.amount',
  status: 'p.status',
  product: 'product.name',
  buyer: 'user.username',
};

const USER_SORT_COLUMNS: Record<string, string> = {
  username: 'u.username',
  email: 'u.email',
  status: 'u.status',
  created_at: 'u.created_at',
  activeLicenseCount: 'active_license_count',
  totalPurchaseCount: 'total_purchase_count',
};

const TICKET_SORT_COLUMNS: Record<string, string> = {
  created_at: 't.created_at',
  updated_at: 't.updated_at',
  status: 't.status',
  rating: 't.rating',
  subject: 't.subject',
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Purchase) private purchasesRepository: Repository<Purchase>,
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(License) private licensesRepository: Repository<License>,
    @InjectRepository(Ticket) private ticketsRepository: Repository<Ticket>,
    @InjectRepository(TicketGroup) private ticketGroupRepository: Repository<TicketGroup>,
    @InjectRepository(AuditLog) private auditLogRepository: Repository<AuditLog>,
  ) {}

  // Shared date/product/category/tier scope for every financial query below -
  // a fresh builder per call since TypeORM query builders are consumed by
  // their terminal call (getRawMany/getCount/etc).
  private scopedPurchases(filters: FinancialFilters) {
    const qb = this.purchasesRepository.createQueryBuilder('p')
      .leftJoin('p.product', 'product')
      .leftJoin('product.group', 'category')
      .leftJoin('p.tier', 'tier');
    if (filters.from) qb.andWhere('p.created_at >= :from', { from: new Date(filters.from) });
    if (filters.to) qb.andWhere('p.created_at <= :to', { to: new Date(filters.to) });
    if (filters.productId) qb.andWhere('product.id = :productId', { productId: filters.productId });
    if (filters.categoryId) qb.andWhere('category.id = :categoryId', { categoryId: filters.categoryId });
    if (filters.tierId) qb.andWhere('tier.id = :tierId', { tierId: filters.tierId });
    return qb;
  }

  // Filterable, bucketed revenue report - a superset of PurchasesService's
  // getRevenueStats() (used by the dashboard widget), which stays untouched
  // since it's fine at current volume for its fixed "last 30 days" view.
  // This one supports arbitrary ranges/filters via a real SQL GROUP BY
  // instead of loading every approved purchase into memory.
  async getFinancialReport(filters: FinancialFilters) {
    const truncUnit = ['day', 'week', 'month'].includes(filters.groupBy || '') ? filters.groupBy! : 'day';

    const bucketsQb = this.scopedPurchases(filters)
      .select(`DATE_TRUNC('${truncUnit}', p.created_at)`, 'bucket')
      .addSelect('SUM(p.amount)', 'amount')
      .addSelect('COUNT(*)', 'count')
      .groupBy('bucket')
      .orderBy('bucket', 'ASC');

    this.applyStatusFilter(bucketsQb, filters.status);

    const [buckets, pendingCount, rejectedCount, approvedCount, totalAmountRow] = await Promise.all([
      bucketsQb.getRawMany(),
      this.scopedPurchases(filters).andWhere('p.status = :status', { status: 'PENDING' }).getCount(),
      this.scopedPurchases(filters).andWhere('p.status = :status', { status: 'REJECTED' }).getCount(),
      this.scopedPurchases(filters).andWhere('p.status = :status', { status: 'APPROVED' }).getCount(),
      this.scopedPurchases(filters).andWhere('p.status = :status', { status: 'APPROVED' }).select('SUM(p.amount)', 'sum').getRawOne(),
    ]);

    return {
      buckets: buckets.map((b) => ({
        date: b.bucket,
        amount: Math.round(Number(b.amount) * 100) / 100,
        count: Number(b.count),
      })),
      statusBreakdown: { approved: approvedCount, pending: pendingCount, rejected: rejectedCount },
      totalAmount: Math.round(Number(totalAmountRow?.sum || 0) * 100) / 100,
    };
  }

  private applyStatusFilter(qb: ReturnType<Repository<Purchase>['createQueryBuilder']>, status?: string) {
    if (status && status !== 'ALL') {
      qb.andWhere('p.status = :status', { status });
    } else if (!status) {
      // Default matches the dashboard's existing "only APPROVED = revenue"
      // semantics - status=ALL opts into seeing pending/rejected too.
      qb.andWhere('p.status = :status', { status: 'APPROVED' });
    }
  }

  // Per-transaction detail behind the bucketed summary - one row per real
  // Purchase, for the "what exactly sold, to whom" drill-down.
  async getFinancialTransactions(filters: TransactionsFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 50));

    const qb = this.scopedPurchases(filters)
      .leftJoin('p.user', 'user')
      .leftJoin('p.wallet', 'wallet')
      .leftJoin('p.order', 'order')
      .addSelect([
        'product.id', 'product.name',
        'tier.id', 'tier.label', 'tier.duration_days',
        'user.id', 'user.username',
        'wallet.id', 'wallet.network', 'wallet.address',
        'order.id',
      ]);

    this.applyStatusFilter(qb, filters.status);
    if (filters.buyerUsername) qb.andWhere('user.username ILIKE :bu', { bu: `%${filters.buyerUsername}%` });

    const sortColumn = TRANSACTION_SORT_COLUMNS[filters.sortBy || ''] || 'p.created_at';
    const sortDir = filters.sortDir === 'ASC' ? 'ASC' : 'DESC';

    const total = await qb.getCount();
    const rows = await qb.orderBy(sortColumn, sortDir).skip((page - 1) * limit).take(limit).getMany();

    return {
      rows: rows.map((p) => this.serializeTransaction(p)),
      total, page, limit,
    };
  }

  private serializeTransaction(p: Purchase) {
    return {
      id: p.id,
      created_at: p.created_at,
      amount: p.amount,
      status: p.status,
      tx_id: p.tx_id,
      rejection_reason: p.rejection_reason,
      product: p.product ? { id: p.product.id, name: p.product.name } : null,
      tier: p.tier ? { id: p.tier.id, label: p.tier.label, duration_days: p.tier.duration_days } : null,
      buyer: p.user ? { id: p.user.id, username: p.user.username } : null,
      wallet: p.wallet ? { id: p.wallet.id, network: p.wallet.network, address: p.wallet.address } : null,
      orderId: p.order?.id ?? null,
    };
  }

  // Per-tier breakdown for a specific product - shown in the UI only once a
  // single product is selected (a global "all products" breakdown by tier
  // label would just be noise, since tier labels aren't unique across products).
  async getFinancialByTier(filters: FinancialFilters) {
    if (!filters.productId) return [];

    const qb = this.scopedPurchases(filters)
      .select('tier.id', 'tierId')
      .addSelect('tier.label', 'label')
      .addSelect('SUM(p.amount)', 'amount')
      .addSelect('COUNT(*)', 'count')
      .andWhere('tier.id IS NOT NULL')
      .groupBy('tier.id')
      .addGroupBy('tier.label')
      .orderBy('amount', 'DESC');

    this.applyStatusFilter(qb, filters.status);
    const rows = await qb.getRawMany();

    return rows.map((r) => ({
      tierId: r.tierId,
      label: r.label,
      amount: Math.round(Number(r.amount) * 100) / 100,
      count: Number(r.count),
    }));
  }

  // Paginated, filterable user list with a couple of light per-row aggregates
  // (correlated subqueries, not N+1 - one query total regardless of page size).
  async getUsersReport(filters: UsersFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));

    const qb = this.usersRepository.createQueryBuilder('u')
      .addSelect((sub) => sub
        .select('COUNT(*)', 'count')
        .from(License, 'l')
        .where('l.user_id = u.id AND l.is_active = true AND l.expires_at > NOW()'), 'active_license_count')
      .addSelect((sub) => sub
        .select('COUNT(*)', 'count')
        .from(Purchase, 'p')
        .where('p.user_id = u.id'), 'total_purchase_count');

    if (filters.status && filters.status !== 'ALL') {
      qb.andWhere('u.status = :status', { status: filters.status });
    }
    if (filters.hasMachineId === 'true') qb.andWhere('u.machine_id IS NOT NULL');
    if (filters.hasMachineId === 'false') qb.andWhere('u.machine_id IS NULL');
    if (filters.registeredFrom) qb.andWhere('u.created_at >= :rf', { rf: new Date(filters.registeredFrom) });
    if (filters.registeredTo) qb.andWhere('u.created_at <= :rt', { rt: new Date(filters.registeredTo) });
    if (filters.search) {
      qb.andWhere('(u.username ILIKE :s OR u.email ILIKE :s OR u.machine_id ILIKE :s)', { s: `%${filters.search}%` });
    }

    const sortColumn = USER_SORT_COLUMNS[filters.sortBy || ''] || 'u.created_at';
    const sortDir = filters.sortDir === 'ASC' ? 'ASC' : 'DESC';

    const total = await qb.getCount();
    const { entities, raw } = await qb
      .orderBy(sortColumn, sortDir)
      .skip((page - 1) * limit)
      .take(limit)
      .getRawAndEntities();

    const rows = entities.map((u, i) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      machine_id: u.machine_id,
      status: u.status,
      created_at: u.created_at,
      activeLicenseCount: Number(raw[i]?.active_license_count ?? 0),
      totalPurchaseCount: Number(raw[i]?.total_purchase_count ?? 0),
    }));

    return { rows, total, page, limit };
  }

  // Every USER_HARDWARE_BOUND/USER_HARDWARE_RESET audit entry for this user,
  // oldest-value/newest-value pairs pulled straight from each entry's
  // metadata - the concrete "identify suspicious users cycling machines" feature.
  private async getMachineIdHistory(userId: string) {
    const entries = await this.auditLogRepository.find({
      where: { target_type: 'User', target_id: userId, action: In(['USER_HARDWARE_BOUND', 'USER_HARDWARE_RESET']) },
      order: { created_at: 'DESC' },
    });

    const history = entries.map((e) => ({
      action: e.action,
      changedBy: e.actor_type,
      actorLabel: e.actor_label,
      oldMachineId: e.metadata?.old_machine_id ?? null,
      newMachineId: e.metadata?.new_machine_id ?? null,
      createdAt: e.created_at,
    }));

    // Only resets/rebinds count as a "change" for the suspicion signal - the
    // very first bind on a brand-new account isn't suspicious on its own.
    const changeCount = history.filter((h) => h.action === 'USER_HARDWARE_RESET').length;

    return { changeCount, history };
  }

  // Full per-user profile for the "complete user profile" report: account info,
  // every license, every purchase (with tier/rejection reason), ticket stats,
  // and machine-id change history.
  async getUserDetail(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [licenses, purchases, ticketStats, machineIdHistory] = await Promise.all([
      this.licensesRepository.find({
        where: { user: { id: userId } },
        relations: { product: true },
        order: { created_at: 'DESC' },
      }),
      this.purchasesRepository.find({
        where: { user: { id: userId } },
        relations: { product: true, tier: true, order: true },
        order: { created_at: 'DESC' },
      }),
      this.ticketsRepository.createQueryBuilder('t')
        .select('COUNT(*)', 'total')
        .addSelect(`COUNT(*) FILTER (WHERE t.status = 'OPEN')`, 'open')
        .addSelect(`COUNT(*) FILTER (WHERE t.status = 'CLOSED')`, 'closed')
        .addSelect('AVG(t.rating)', 'avgRatingGiven')
        .where('t.user_id = :userId', { userId })
        .getRawOne(),
      this.getMachineIdHistory(userId),
    ]);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        machine_id: user.machine_id,
        status: user.status,
        created_at: user.created_at,
      },
      licenses,
      purchases,
      tickets: {
        total: Number(ticketStats?.total ?? 0),
        open: Number(ticketStats?.open ?? 0),
        closed: Number(ticketStats?.closed ?? 0),
        avgRatingGiven: ticketStats?.avgRatingGiven ? Math.round(Number(ticketStats.avgRatingGiven) * 10) / 10 : null,
      },
      machineIdHistory,
    };
  }

  // --- Tickets report ---

  // Shared date/status/group/responder-admin/opened-by-user scope for every
  // ticket-report query below - a fresh builder per call, same convention as
  // scopedPurchases(). groupId/adminId/userSearch used to be applied ad-hoc
  // only inside getTicketsList(), which meant the top-level chart/byAdmin
  // panel silently ignored them; moving them here makes every ticket-report
  // query (chart, day-buckets, day-detail, list) respect the full filter set.
  private scopedTickets(filters: TicketsFilters) {
    const qb = this.ticketsRepository.createQueryBuilder('t')
      .leftJoin('t.user', 'user')
      .leftJoin('t.group', 'group')
      .leftJoin('t.lastResponderAdmin', 'admin');
    if (filters.from) qb.andWhere('t.created_at >= :from', { from: new Date(filters.from) });
    if (filters.to) qb.andWhere('t.created_at <= :to', { to: new Date(filters.to) });
    if (filters.status && filters.status !== 'ALL') qb.andWhere('t.status = :status', { status: filters.status });
    if (filters.groupId) qb.andWhere('group.id = :groupId', { groupId: filters.groupId });
    if (filters.adminId) qb.andWhere('admin.id = :adminId', { adminId: filters.adminId });
    if (filters.userSearch) qb.andWhere('user.username ILIKE :us', { us: `%${filters.userSearch}%` });
    return qb;
  }

  async getTicketsReport(filters: TicketsFilters) {
    const truncUnit = ['day', 'week', 'month'].includes(filters.groupBy || '') ? filters.groupBy! : 'day';

    const bucketsQb = this.scopedTickets(filters)
      .select(`DATE_TRUNC('${truncUnit}', t.created_at)`, 'bucket')
      .addSelect('COUNT(*)', 'count')
      .groupBy('bucket')
      .orderBy('bucket', 'ASC');

    const [buckets, openCount, closedCount, byAdmin] = await Promise.all([
      bucketsQb.getRawMany(),
      this.scopedTickets(filters).andWhere('t.status = :s', { s: 'OPEN' }).getCount(),
      this.scopedTickets(filters).andWhere('t.status = :s', { s: 'CLOSED' }).getCount(),
      this.scopedTickets(filters)
        .select('admin.id', 'adminId')
        .addSelect('admin.username', 'adminUsername')
        .addSelect('COUNT(*)', 'ticketCount')
        .addSelect('AVG(t.rating)', 'avgRating')
        .andWhere('admin.id IS NOT NULL')
        .groupBy('admin.id')
        .addGroupBy('admin.username')
        .orderBy('"ticketCount"', 'DESC')
        .getRawMany(),
    ]);

    return {
      buckets: buckets.map((b) => ({ date: b.bucket, count: Number(b.count) })),
      statusBreakdown: { open: openCount, closed: closedCount },
      byAdmin: byAdmin.map((a) => ({
        adminId: a.adminId,
        adminUsername: a.adminUsername,
        ticketCount: Number(a.ticketCount),
        avgRating: a.avgRating ? Math.round(Number(a.avgRating) * 10) / 10 : null,
      })),
    };
  }

  // One row per calendar day (ticket count + distinct opener count) - the
  // default view for Reports > Tickets, replacing what used to be a flat
  // per-ticket table.
  async getTicketsByDay(filters: TicketsFilters) {
    const rows = await this.scopedTickets(filters)
      .select(`DATE_TRUNC('day', t.created_at)`, 'bucket')
      .addSelect('COUNT(*)', 'ticketCount')
      .addSelect('COUNT(DISTINCT t.user_id)', 'distinctUserCount')
      .groupBy('bucket')
      .orderBy('bucket', 'DESC')
      .getRawMany();

    return rows.map((r) => ({
      date: r.bucket,
      ticketCount: Number(r.ticketCount),
      distinctUserCount: Number(r.distinctUserCount),
    }));
  }

  // Drill-down for a single day: that day's full ticket list plus stats
  // scoped to just that day. byAdmin here is scoped by closed_at (not
  // created_at) since a rating belongs to whichever admin closed the ticket
  // that day, which can differ from the day it was opened.
  async getTicketsDayDetail(date: string, filters: TicketsFilters) {
    const dayStart = new Date(date);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const dayFilters: TicketsFilters = { ...filters, from: dayStart.toISOString(), to: dayEnd.toISOString() };

    const [{ rows: tickets }, byGroup, byAdmin, distinctUsersRow, totalTickets] = await Promise.all([
      this.getTicketsList({ ...dayFilters, page: 1, limit: 1000 }),
      this.scopedTickets(dayFilters)
        .select('group.id', 'groupId')
        .addSelect('group.name', 'groupName')
        .addSelect('COUNT(*)', 'ticketCount')
        .andWhere('group.id IS NOT NULL')
        .groupBy('group.id')
        .addGroupBy('group.name')
        .orderBy('"ticketCount"', 'DESC')
        .getRawMany(),
      this.scopedTickets({ ...filters, from: undefined, to: undefined })
        .andWhere('t.closed_at >= :cf AND t.closed_at < :ct', { cf: dayStart, ct: dayEnd })
        .select('admin.id', 'adminId')
        .addSelect('admin.username', 'adminUsername')
        .addSelect('COUNT(*)', 'ticketCount')
        .addSelect('AVG(t.rating)', 'avgRating')
        .andWhere('admin.id IS NOT NULL')
        .groupBy('admin.id')
        .addGroupBy('admin.username')
        .orderBy('"ticketCount"', 'DESC')
        .getRawMany(),
      this.scopedTickets(dayFilters).select('COUNT(DISTINCT t.user_id)', 'count').getRawOne(),
      this.scopedTickets(dayFilters).getCount(),
    ]);

    return {
      tickets,
      stats: {
        byGroup: byGroup.map((g) => ({ groupId: g.groupId, groupName: g.groupName, ticketCount: Number(g.ticketCount) })),
        byAdmin: byAdmin.map((a) => ({
          adminId: a.adminId,
          adminUsername: a.adminUsername,
          ticketCount: Number(a.ticketCount),
          avgRating: a.avgRating ? Math.round(Number(a.avgRating) * 10) / 10 : null,
        })),
        distinctUserCount: Number(distinctUsersRow?.count ?? 0),
        totalTickets,
      },
    };
  }

  // Thin lookups for the Reports > Tickets filter dropdowns - kept under the
  // reports-gated controller so a reports-only admin doesn't need the
  // tickets-gated /tickets/admin/groups or the super-admin-only /admin/admins/list.
  async getTicketFilterGroups() {
    return this.ticketGroupRepository.find({ select: { id: true, name: true }, order: { name: 'ASC' } });
  }

  async getTicketFilterAdmins() {
    return this.ticketsRepository.createQueryBuilder('t')
      .leftJoin('t.lastResponderAdmin', 'admin')
      .select('admin.id', 'id')
      .addSelect('admin.username', 'username')
      .where('admin.id IS NOT NULL')
      .distinct(true)
      .orderBy('admin.username', 'ASC')
      .getRawMany();
  }

  async getTicketsList(filters: TicketsListFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 50));

    const qb = this.scopedTickets(filters)
      .addSelect(['user.id', 'user.username', 'group.id', 'group.name', 'admin.id', 'admin.username']);

    if (filters.search) qb.andWhere('t.subject ILIKE :s', { s: `%${filters.search}%` });

    const sortColumn = TICKET_SORT_COLUMNS[filters.sortBy || ''] || 't.created_at';
    const sortDir = filters.sortDir === 'ASC' ? 'ASC' : 'DESC';

    const total = await qb.getCount();
    const rows = await qb.orderBy(sortColumn, sortDir).skip((page - 1) * limit).take(limit).getMany();

    return {
      rows: rows.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        rating: t.rating,
        created_at: t.created_at,
        updated_at: t.updated_at,
        closed_at: t.closed_at,
        user: t.user ? { id: t.user.id, username: t.user.username } : null,
        group: t.group ? { id: t.group.id, name: t.group.name } : null,
        lastResponderAdmin: t.lastResponderAdmin ? { id: t.lastResponderAdmin.id, username: t.lastResponderAdmin.username } : null,
      })),
      total, page, limit,
    };
  }

  // --- Excel exports (full filtered dataset, not the paginated view) ---

  async exportFinancial(filters: FinancialFilters): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const txQb = this.scopedPurchases(filters)
      .leftJoinAndSelect('p.tier', 'tier')
      .leftJoin('p.user', 'user')
      .addSelect(['product.id', 'product.name', 'user.id', 'user.username']);
    this.applyStatusFilter(txQb, filters.status);
    const transactions = await txQb.orderBy('p.created_at', 'DESC').getMany();

    const txSheet = workbook.addWorksheet('Transactions');
    txSheet.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Product', key: 'product', width: 25 },
      { header: 'Plan', key: 'plan', width: 20 },
      { header: 'Price (USDT)', key: 'price', width: 15 },
      { header: 'Buyer', key: 'buyer', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'TX ID', key: 'txId', width: 30 },
      { header: 'Rejection Reason', key: 'reason', width: 30 },
    ];
    for (const p of transactions) {
      txSheet.addRow({
        date: p.created_at, product: p.product?.name || '', plan: p.tier?.label || '',
        price: Number(p.amount), buyer: p.user?.username || '', status: p.status,
        txId: p.tx_id, reason: p.rejection_reason || '',
      });
    }

    const { buckets } = await this.getFinancialReport(filters);
    const summarySheet = workbook.addWorksheet('Daily Summary');
    summarySheet.columns = [
      { header: 'Period', key: 'date', width: 20 },
      { header: 'Transactions', key: 'count', width: 15 },
      { header: 'Amount (USDT)', key: 'amount', width: 15 },
    ];
    for (const b of buckets) summarySheet.addRow(b);

    return workbook.xlsx.writeBuffer() as Promise<any> as Promise<Buffer>;
  }

  async exportUsers(filters: UsersFilters): Promise<Buffer> {
    const { rows } = await this.getUsersReport({ ...filters, page: 1, limit: 100000 });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Users');
    sheet.columns = [
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Machine ID', key: 'machine_id', width: 30 },
      { header: 'Active Licenses', key: 'activeLicenseCount', width: 15 },
      { header: 'Total Purchases', key: 'totalPurchaseCount', width: 15 },
      { header: 'Registered', key: 'created_at', width: 20 },
    ];
    for (const r of rows) sheet.addRow(r);
    return workbook.xlsx.writeBuffer() as Promise<any> as Promise<Buffer>;
  }

  async exportUserDetail(userId: string): Promise<Buffer> {
    const detail = await this.getUserDetail(userId);
    const workbook = new ExcelJS.Workbook();

    const infoSheet = workbook.addWorksheet('Account');
    infoSheet.columns = [{ header: 'Field', key: 'field', width: 20 }, { header: 'Value', key: 'value', width: 40 }];
    infoSheet.addRows([
      { field: 'Username', value: detail.user.username },
      { field: 'Email', value: detail.user.email },
      { field: 'Status', value: detail.user.status },
      { field: 'Machine ID', value: detail.user.machine_id || '' },
      { field: 'Registered', value: detail.user.created_at },
      { field: 'Total Tickets', value: detail.tickets.total },
      { field: 'Open Tickets', value: detail.tickets.open },
      { field: 'Avg Rating Given', value: detail.tickets.avgRatingGiven ?? '' },
      { field: 'Machine ID Changes', value: detail.machineIdHistory.changeCount },
    ]);

    const licensesSheet = workbook.addWorksheet('Licenses');
    licensesSheet.columns = [
      { header: 'Product', key: 'product', width: 25 },
      { header: 'License Key', key: 'key', width: 25 },
      { header: 'Active', key: 'active', width: 10 },
      { header: 'Expires', key: 'expires', width: 20 },
      { header: 'Manual', key: 'manual', width: 10 },
      { header: 'Date Adjusted', key: 'adjusted', width: 15 },
    ];
    for (const l of detail.licenses) {
      licensesSheet.addRow({
        product: l.product?.name || '', key: l.license_key, active: l.is_active,
        expires: l.expires_at, manual: l.is_manual, adjusted: l.date_manually_adjusted,
      });
    }

    const purchasesSheet = workbook.addWorksheet('Purchases');
    purchasesSheet.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Product', key: 'product', width: 25 },
      { header: 'Plan', key: 'plan', width: 20 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Rejection Reason', key: 'reason', width: 30 },
    ];
    for (const p of detail.purchases) {
      purchasesSheet.addRow({
        date: p.created_at, product: p.product?.name || '', plan: p.tier?.label || '',
        amount: Number(p.amount), status: p.status, reason: p.rejection_reason || '',
      });
    }

    const historySheet = workbook.addWorksheet('Machine ID History');
    historySheet.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Changed By', key: 'by', width: 12 },
      { header: 'Old Machine ID', key: 'old', width: 30 },
      { header: 'New Machine ID', key: 'new', width: 30 },
    ];
    for (const h of detail.machineIdHistory.history) {
      historySheet.addRow({ date: h.createdAt, by: h.changedBy, old: h.oldMachineId || '', new: h.newMachineId || '' });
    }

    return workbook.xlsx.writeBuffer() as Promise<any> as Promise<Buffer>;
  }

  async exportTickets(filters: TicketsListFilters): Promise<Buffer> {
    const { rows } = await this.getTicketsList({ ...filters, page: 1, limit: 100000 });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tickets');
    sheet.columns = [
      { header: 'Subject', key: 'subject', width: 30 },
      { header: 'Category', key: 'group', width: 20 },
      { header: 'Opened By', key: 'user', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Responder', key: 'admin', width: 20 },
      { header: 'Rating', key: 'rating', width: 10 },
      { header: 'Created', key: 'created_at', width: 20 },
      { header: 'Closed', key: 'closed_at', width: 20 },
    ];
    for (const t of rows) {
      sheet.addRow({
        subject: t.subject, group: t.group?.name || '', user: t.user?.username || '',
        status: t.status, admin: t.lastResponderAdmin?.username || '', rating: t.rating ?? '',
        created_at: t.created_at, closed_at: t.closed_at || '',
      });
    }
    return workbook.xlsx.writeBuffer() as Promise<any> as Promise<Buffer>;
  }
}
