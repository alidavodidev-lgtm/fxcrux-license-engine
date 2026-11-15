"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3, TrendingUp, RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle, Download,
  ChevronLeft, ChevronRight, Eye,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart as RBarChart, Bar, Cell,
} from "recharts";
import { ReportsTabs } from "@/components/reports-tabs";
import { SortableTh } from "@/components/ui/sortable-th";
import { useSortableData } from "@/hooks/useSortableData";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Same validated palette as the main dashboard (admin-dashboard-client.tsx) -
// kept identical so a revenue color always means the same thing across pages.
const REVENUE_COLOR = "#3987e5";
const STATUS_COLORS = { approved: "#0ca30c", pending: "#fab219", rejected: "#d03b3b" };

interface Tier { id: string; label: string; }
interface Product { id: string; name: string; tiers?: Tier[]; }
interface Category { id: string; name: string; }

interface FinancialReport {
  buckets: { date: string; amount: number; count: number }[];
  statusBreakdown: { approved: number; pending: number; rejected: number };
  totalAmount: number;
}

interface TierBreakdownRow { tierId: string; label: string; amount: number; count: number; }

interface Transaction {
  id: string;
  created_at: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  tx_id: string;
  rejection_reason: string | null;
  product: { id: string; name: string } | null;
  tier: { id: string; label: string; duration_days: number } | null;
  buyer: { id: string; username: string } | null;
  wallet: { id: string; network: string; address: string } | null;
  orderId: string | null;
}

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <div className="text-muted-foreground mb-1" suppressHydrationWarning>{new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
      <div className="font-semibold text-foreground">${payload[0].value.toLocaleString()} USDT</div>
      <div className="text-muted-foreground mt-0.5">{payload[0].payload.count} transaction{payload[0].payload.count === 1 ? '' : 's'}</div>
    </div>
  );
}

function TxStatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> Approved</span>;
  if (status === 'PENDING') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20"><AlertTriangle className="w-3.5 h-3.5" /> Pending</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20"><XCircle className="w-3.5 h-3.5" /> Rejected</span>;
}

export function ReportsFinancialClient({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [productId, setProductId] = useState("ALL");
  const [categoryId, setCategoryId] = useState("ALL");
  const [tierId, setTierId] = useState("ALL");
  const [status, setStatus] = useState("APPROVED");
  const [txBuyerUsername, setTxBuyerUsername] = useState("");

  const [byTier, setByTier] = useState<TierBreakdownRow[]>([]);

  // Daily Summary pagination (7 rows/page) + per-day transactions drill-down
  const [bucketPage, setBucketPage] = useState(1);
  const BUCKETS_PER_PAGE = 7;
  const [viewingDay, setViewingDay] = useState<string | null>(null);
  const [dayTransactions, setDayTransactions] = useState<Transaction[]>([]);
  const [dayTxLoading, setDayTxLoading] = useState(false);

  // Transaction drill-down (paginated + server-sorted, 50/page)
  const [txRows, setTxRows] = useState<Transaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txLimit] = useState(50);
  const [txLoading, setTxLoading] = useState(true);
  const [txSortBy, setTxSortBy] = useState("created_at");
  const [txSortDir, setTxSortDir] = useState<"ASC" | "DESC">("DESC");
  const [viewingTx, setViewingTx] = useState<Transaction | null>(null);

  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (productId !== "ALL") params.set("productId", productId);
    if (categoryId !== "ALL") params.set("categoryId", categoryId);
    if (tierId !== "ALL") params.set("tierId", tierId);
    params.set("status", status);
    return params;
  }, [from, to, productId, categoryId, tierId, status]);

  const load = useCallback(() => {
    const params = filterParams();
    params.set("groupBy", groupBy);
    fetch(`/api/analytics/financial?${params.toString()}`).then((r) => r.ok ? r.json() : null).then((data) => {
      setReport(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filterParams, groupBy]);

  const loadByTier = useCallback(() => {
    if (productId === "ALL") { setByTier([]); return; }
    const params = filterParams();
    fetch(`/api/analytics/financial/by-tier?${params.toString()}`).then((r) => r.ok ? r.json() : []).then(setByTier).catch(() => setByTier([]));
  }, [filterParams, productId]);

  const loadTransactions = useCallback(() => {
    setTxLoading(true);
    const params = filterParams();
    if (txBuyerUsername) params.set("buyerUsername", txBuyerUsername);
    params.set("page", String(txPage));
    params.set("limit", String(txLimit));
    params.set("sortBy", txSortBy);
    params.set("sortDir", txSortDir);
    fetch(`/api/analytics/financial/transactions?${params.toString()}`).then((r) => r.ok ? r.json() : null).then((data) => {
      if (data) { setTxRows(data.rows || []); setTxTotal(data.total || 0); }
      setTxLoading(false);
    }).catch(() => setTxLoading(false));
  }, [filterParams, txBuyerUsername, txPage, txLimit, txSortBy, txSortDir]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadByTier(); }, [loadByTier]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    load(); loadByTier(); loadTransactions();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const resetFilters = () => {
    setFrom(""); setTo(""); setGroupBy("day"); setProductId("ALL"); setCategoryId("ALL"); setTierId("ALL"); setStatus("APPROVED"); setTxPage(1); setTxBuyerUsername("");
  };

  const handleTxSort = (key: string) => {
    if (txSortBy === key) setTxSortDir((d) => (d === "ASC" ? "DESC" : "ASC"));
    else { setTxSortBy(key); setTxSortDir("ASC"); }
    setTxPage(1);
  };

  // A day-bucket's own transactions - scoped to just that one period (not
  // the page-level date range, which the bucket is already inside of),
  // otherwise reusing the same product/category/status filters.
  const viewDayTransactions = (bucketDate: string) => {
    setViewingDay(bucketDate);
    setDayTxLoading(true);
    const dayStart = new Date(bucketDate);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const params = new URLSearchParams();
    if (productId !== "ALL") params.set("productId", productId);
    if (categoryId !== "ALL") params.set("categoryId", categoryId);
    params.set("status", status);
    params.set("from", dayStart.toISOString().slice(0, 10));
    params.set("to", dayEnd.toISOString().slice(0, 10));
    params.set("limit", "200");
    params.set("sortBy", "created_at");
    params.set("sortDir", "ASC");

    fetch(`/api/analytics/financial/transactions?${params.toString()}`).then((r) => r.ok ? r.json() : null).then((data) => {
      setDayTransactions(data?.rows || []);
      setDayTxLoading(false);
    }).catch(() => setDayTxLoading(false));
  };

  const {
    sorted: sortedBuckets, sortKey: bucketSortKey, sortDir: bucketSortDir, requestSort: requestBucketSort,
  } = useSortableData(
    report?.buckets ?? [],
    (row, key) => (key === "date" ? row.date : key === "count" ? row.count : row.amount),
    "date", "desc",
  );

  const bucketTotalPages = Math.max(1, Math.ceil(sortedBuckets.length / BUCKETS_PER_PAGE));
  const pagedBuckets = sortedBuckets.slice((bucketPage - 1) * BUCKETS_PER_PAGE, bucketPage * BUCKETS_PER_PAGE);

  // Reload happened (new filters/sort) - the old page number may no longer
  // exist, so snap back to page 1 rather than showing an empty page.
  useEffect(() => { setBucketPage(1); }, [report, bucketSortKey, bucketSortDir]);

  const exportUrl = `/api/analytics/financial/export?${filterParams().toString()}`;

  const statusTotal = report ? report.statusBreakdown.approved + report.statusBreakdown.pending + report.statusBreakdown.rejected : 0;
  const statusBars = report
    ? [
        { name: "Approved", value: report.statusBreakdown.approved, color: STATUS_COLORS.approved },
        { name: "Pending", value: report.statusBreakdown.pending, color: STATUS_COLORS.pending },
        { name: "Rejected", value: report.statusBreakdown.rejected, color: STATUS_COLORS.rejected },
      ]
    : [];

  const txTotalPages = Math.max(1, Math.ceil(txTotal / txLimit));

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            Reports
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">Financial reporting and full user profiles.</p>
        </div>
        <a
          href={exportUrl}
          className="h-11 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" /> Export to Excel
        </a>
      </div>

      <ReportsTabs />

      <div className="flex flex-col md:flex-row flex-wrap gap-4 bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
        <input
          type="date" title="From date"
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-40"
          value={from} onChange={(e) => { setFrom(e.target.value); setTxPage(1); }}
        />
        <input
          type="date" title="To date"
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-40"
          value={to} onChange={(e) => { setTo(e.target.value); setTxPage(1); }}
        />
        <select
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-36 appearance-none cursor-pointer"
          value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)}
        >
          <option value="day">By Day</option>
          <option value="week">By Week</option>
          <option value="month">By Month</option>
        </select>
        <select
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-44 appearance-none cursor-pointer"
          value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setTxPage(1); }}
        >
          <option value="ALL">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-48 appearance-none cursor-pointer"
          value={productId} onChange={(e) => { setProductId(e.target.value); setTierId("ALL"); setTxPage(1); }}
        >
          <option value="ALL">All Products</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {productId !== "ALL" && (
          <select
            className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-44 appearance-none cursor-pointer"
            value={tierId} onChange={(e) => { setTierId(e.target.value); setTxPage(1); }}
          >
            <option value="ALL">All Plans</option>
            {(products.find((p) => p.id === productId)?.tiers || []).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        )}
        <select
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-40 appearance-none cursor-pointer"
          value={status} onChange={(e) => { setStatus(e.target.value); setTxPage(1); }}
        >
          <option value="APPROVED">Approved Only</option>
          <option value="PENDING">Pending Only</option>
          <option value="REJECTED">Rejected Only</option>
          <option value="ALL">All Statuses</option>
        </select>
        <button onClick={resetFilters} className="h-11 px-4 rounded-xl border border-border/50 text-sm font-medium text-muted-foreground hover:bg-muted transition-all whitespace-nowrap">
          Clear
        </button>
        <button onClick={handleRefresh} className="h-11 px-4 bg-card border border-border/50 text-foreground rounded-xl text-sm font-medium hover:bg-muted transition-all flex items-center gap-2 shadow-sm whitespace-nowrap">
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : !report ? (
        <div className="bg-card border border-border/50 rounded-2xl p-12 text-center text-muted-foreground">Failed to load report.</div>
      ) : (
        <>
          <div className="bg-card border border-border/50 rounded-2xl p-6">
            <p className="text-muted-foreground text-sm font-medium">Total (filtered)</p>
            <h3 className="text-3xl font-bold text-foreground mt-2 tabular-nums">${report.totalAmount.toLocaleString()}</h3>
            <p className="text-xs text-muted-foreground mt-1">USDT, approved payments matching the current filters</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6">
              <p className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Revenue over time</p>
              <div className="h-64">
                {report.buckets.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data for these filters.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report.buckets} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="reportsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={REVENUE_COLOR} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={REVENUE_COLOR} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                        axisLine={{ stroke: 'var(--border)' }}
                        tickLine={false}
                      />
                      <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip content={<RevenueTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                      <Area type="monotone" dataKey="amount" stroke={REVENUE_COLOR} strokeWidth={2} fill="url(#reportsRevenueFill)" dot={false} activeDot={{ r: 4, fill: REVENUE_COLOR }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl p-6">
              <p className="text-sm font-semibold text-foreground mb-4">Transactions by Status</p>
              <div className="h-40 mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RBarChart data={statusBars} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip
                      cursor={{ fill: 'var(--muted)' }}
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs font-medium text-foreground">
                            {payload[0].payload.name}: {payload[0].value}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22}>
                      {statusBars.map((s) => <Cell key={s.name} fill={s.color} />)}
                    </Bar>
                  </RBarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><CheckCircle2 className="w-3.5 h-3.5" style={{ color: STATUS_COLORS.approved }} /> Approved</span>
                  <span className="font-semibold text-foreground tabular-nums">{report.statusBreakdown.approved}{statusTotal > 0 ? ` (${Math.round(report.statusBreakdown.approved / statusTotal * 100)}%)` : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><AlertTriangle className="w-3.5 h-3.5" style={{ color: STATUS_COLORS.pending }} /> Pending</span>
                  <span className="font-semibold text-foreground tabular-nums">{report.statusBreakdown.pending}{statusTotal > 0 ? ` (${Math.round(report.statusBreakdown.pending / statusTotal * 100)}%)` : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><XCircle className="w-3.5 h-3.5" style={{ color: STATUS_COLORS.rejected }} /> Rejected</span>
                  <span className="font-semibold text-foreground tabular-nums">{report.statusBreakdown.rejected}{statusTotal > 0 ? ` (${Math.round(report.statusBreakdown.rejected / statusTotal * 100)}%)` : ''}</span>
                </div>
              </div>
            </div>
          </div>

          {productId !== "ALL" && tierId === "ALL" && byTier.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-4">Breakdown by Plan — {products.find((p) => p.id === productId)?.name}</p>

              <div className="hidden md:block bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
                      <tr>
                        <th className="px-6 py-4 font-medium">Plan</th>
                        <th className="px-6 py-4 font-medium">Transactions</th>
                        <th className="px-6 py-4 font-medium">Amount (USDT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {byTier.map((t) => (
                        <tr key={t.tierId} className="hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-4 text-foreground">{t.label}</td>
                          <td className="px-6 py-4 text-muted-foreground">{t.count}</td>
                          <td className="px-6 py-4 font-semibold text-foreground tabular-nums">${t.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="md:hidden space-y-3">
                {byTier.map((t) => (
                  <div key={t.tierId} className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground text-sm">{t.label}</span>
                      <span className="font-semibold text-foreground tabular-nums text-sm">${t.amount.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{t.count} transaction{t.count === 1 ? '' : 's'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-foreground mb-4">Daily Summary</p>

            <div className="hidden md:block bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
                    <tr>
                      <SortableTh label="Period" sortKey="date" activeSortKey={bucketSortKey} sortDir={bucketSortDir} onSort={requestBucketSort} />
                      <SortableTh label="Transactions" sortKey="count" activeSortKey={bucketSortKey} sortDir={bucketSortDir} onSort={requestBucketSort} />
                      <SortableTh label="Amount (USDT)" sortKey="amount" activeSortKey={bucketSortKey} sortDir={bucketSortDir} onSort={requestBucketSort} />
                      <th className="px-6 py-4 font-medium text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {pagedBuckets.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No data for these filters.</td></tr>
                    ) : (
                      pagedBuckets.map((b) => (
                        <tr key={b.date} className="hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-4 text-foreground" suppressHydrationWarning>{new Date(b.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                          <td className="px-6 py-4 text-muted-foreground">{b.count}</td>
                          <td className="px-6 py-4 font-semibold text-foreground tabular-nums">${b.amount.toLocaleString()}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => viewDayTransactions(b.date)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="md:hidden space-y-3">
              {pagedBuckets.length === 0 ? (
                <div className="bg-card border border-border/50 rounded-2xl p-10 text-center text-muted-foreground">No data for these filters.</div>
              ) : (
                pagedBuckets.map((b) => (
                  <button key={b.date} onClick={() => viewDayTransactions(b.date)} className="w-full text-left bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground text-sm" suppressHydrationWarning>{new Date(b.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      <span className="font-semibold text-foreground tabular-nums text-sm">${b.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
                      <span>{b.count} transaction{b.count === 1 ? '' : 's'}</span>
                      <span className="inline-flex items-center gap-1 text-primary font-semibold"><Eye className="w-3.5 h-3.5" /> View</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {sortedBuckets.length > BUCKETS_PER_PAGE && (
              <div className="flex items-center justify-between gap-4 flex-wrap mt-4">
                <p className="text-xs text-muted-foreground">{sortedBuckets.length} period{sortedBuckets.length === 1 ? '' : 's'} total</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBucketPage((p) => Math.max(1, p - 1))}
                    disabled={bucketPage <= 1}
                    className="p-2 rounded-lg border border-border/50 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-muted-foreground">Page {bucketPage} of {bucketTotalPages}</span>
                  <button
                    onClick={() => setBucketPage((p) => Math.min(bucketTotalPages, p + 1))}
                    disabled={bucketPage >= bucketTotalPages}
                    className="p-2 rounded-lg border border-border/50 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Per-transaction drill-down */}
          <div>
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <p className="text-sm font-semibold text-foreground">Transactions</p>
              <input
                type="text" placeholder="Filter by buyer username..."
                className="h-10 px-3 rounded-xl border border-border/80 bg-background text-sm w-full sm:w-56"
                value={txBuyerUsername} onChange={(e) => { setTxBuyerUsername(e.target.value); setTxPage(1); }}
              />
            </div>
            {txLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : (
              <>
                <div className="hidden md:block bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
                        <tr>
                          <SortableTh label="Date" sortKey="created_at" activeSortKey={txSortBy} sortDir={txSortDir === "ASC" ? "asc" : "desc"} onSort={handleTxSort} />
                          <SortableTh label="Product" sortKey="product" activeSortKey={txSortBy} sortDir={txSortDir === "ASC" ? "asc" : "desc"} onSort={handleTxSort} />
                          <th className="px-6 py-4 font-medium">Plan</th>
                          <SortableTh label="Price" sortKey="amount" activeSortKey={txSortBy} sortDir={txSortDir === "ASC" ? "asc" : "desc"} onSort={handleTxSort} />
                          <SortableTh label="Buyer" sortKey="buyer" activeSortKey={txSortBy} sortDir={txSortDir === "ASC" ? "asc" : "desc"} onSort={handleTxSort} />
                          <SortableTh label="Status" sortKey="status" activeSortKey={txSortBy} sortDir={txSortDir === "ASC" ? "asc" : "desc"} onSort={handleTxSort} />
                          <th className="px-6 py-4 font-medium text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {txRows.length === 0 ? (
                          <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No transactions for these filters.</td></tr>
                        ) : (
                          txRows.map((tx) => (
                            <tr key={tx.id} className="hover:bg-muted/10 transition-colors">
                              <td className="px-6 py-4 text-muted-foreground" suppressHydrationWarning>{new Date(tx.created_at).toLocaleDateString()}</td>
                              <td className="px-6 py-4 text-foreground">{tx.product?.name || '—'}</td>
                              <td className="px-6 py-4 text-muted-foreground">{tx.tier?.label || '—'}</td>
                              <td className="px-6 py-4 font-semibold text-foreground tabular-nums">${Number(tx.amount).toLocaleString()}</td>
                              <td className="px-6 py-4 text-muted-foreground">{tx.buyer?.username || '—'}</td>
                              <td className="px-6 py-4"><TxStatusBadge status={tx.status} /></td>
                              <td className="px-6 py-4 text-right">
                                <button onClick={() => setViewingTx(tx)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                                  <Eye className="w-3.5 h-3.5" /> View
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile card fallback */}
                <div className="md:hidden space-y-3">
                  {txRows.length === 0 ? (
                    <div className="bg-card border border-border/50 rounded-2xl p-10 text-center text-muted-foreground">No transactions for these filters.</div>
                  ) : (
                    txRows.map((tx) => (
                      <button key={tx.id} onClick={() => setViewingTx(tx)} className="w-full text-left bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-semibold text-foreground text-sm">{tx.product?.name || '—'}</span>
                          <TxStatusBadge status={tx.status} />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{tx.buyer?.username || '—'} · {tx.tier?.label || '—'}</span>
                          <span className="font-semibold text-foreground tabular-nums">${Number(tx.amount).toLocaleString()}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap mt-4">
                  <p className="text-xs text-muted-foreground">{txTotal} transaction{txTotal === 1 ? '' : 's'} total</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                      disabled={txPage <= 1}
                      className="p-2 rounded-lg border border-border/50 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-muted-foreground">Page {txPage} of {txTotalPages}</span>
                    <button
                      onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                      disabled={txPage >= txTotalPages}
                      className="p-2 rounded-lg border border-border/50 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <Dialog open={!!viewingTx} onOpenChange={(o) => !o && setViewingTx(null)}>
        <DialogContent className="sm:max-w-[480px] border-border bg-card shadow-2xl rounded-2xl">
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>Full record for this purchase.</DialogDescription>
          </DialogHeader>
          {viewingTx && (
            <div className="grid gap-3 py-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Product</span><span className="font-medium text-foreground">{viewingTx.product?.name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-medium text-foreground">{viewingTx.tier?.label || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium text-foreground tabular-nums">${Number(viewingTx.amount).toLocaleString()} USDT</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Buyer</span><span className="font-medium text-foreground">{viewingTx.buyer?.username || '—'}</span></div>
              <div className="flex justify-between items-center"><span className="text-muted-foreground">Status</span><TxStatusBadge status={viewingTx.status} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium text-foreground" suppressHydrationWarning>{new Date(viewingTx.created_at).toLocaleString()}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">TX ID</span><span className="font-mono text-xs text-foreground break-all text-right">{viewingTx.tx_id}</span></div>
              {viewingTx.wallet && (
                <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Wallet</span><span className="font-mono text-xs text-foreground break-all text-right">{viewingTx.wallet.network} — {viewingTx.wallet.address}</span></div>
              )}
              {viewingTx.orderId && (
                <div className="flex justify-between"><span className="text-muted-foreground">Cart Order</span><span className="font-mono text-xs text-foreground">{viewingTx.orderId}</span></div>
              )}
              {viewingTx.status === 'REJECTED' && viewingTx.rejection_reason && (
                <div className="pt-2 border-t border-border/50">
                  <span className="text-muted-foreground text-xs">Rejection Reason</span>
                  <p className="text-rose-500 text-sm mt-1">{viewingTx.rejection_reason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingDay} onOpenChange={(o) => !o && setViewingDay(null)}>
        <DialogContent className="sm:max-w-[560px] border-border bg-card shadow-2xl rounded-2xl">
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle>Transactions — {viewingDay ? new Date(viewingDay).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</DialogTitle>
            <DialogDescription>Every transaction from this period matching the current product/category/status filters.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
            {dayTxLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : dayTransactions.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-10">No transactions found for this period.</div>
            ) : (
              <div className="space-y-2 py-2">
                {dayTransactions.map((tx) => (
                  <button
                    key={tx.id}
                    onClick={() => { setViewingTx(tx); setViewingDay(null); }}
                    className="w-full text-left bg-slate-900/50 border border-border/50 rounded-xl p-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground text-sm truncate">{tx.product?.name || '—'}</span>
                      <TxStatusBadge status={tx.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      <span>{tx.buyer?.username || '—'} · {tx.tier?.label || '—'}</span>
                      <span className="font-semibold text-foreground tabular-nums">${Number(tx.amount).toLocaleString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
