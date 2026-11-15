"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users, Key, CreditCard, Box, ShieldCheck, Clock, ArrowRight, Activity, Wallet, ScrollText, UserCog,
  TrendingUp, CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from "recharts";
import { usePolling } from "@/hooks/usePolling";

// Sequential blue (single series) - dataviz skill reference palette, dark-surface step.
const REVENUE_COLOR = "#3987e5";
// Status palette (fixed, never themed) - approved=good, pending=warning, rejected=critical.
const STATUS_COLORS = { approved: "#0ca30c", pending: "#fab219", rejected: "#d03b3b" };

interface Me {
  username: string;
  is_super_admin: boolean;
  permissions: Record<string, boolean>;
}

interface Stats {
  totalUsers: number;
  activeLicenses: number;
  pendingPurchases: number;
  totalProducts: number;
}

interface Revenue {
  totals: { last7Days: number; currentMonth: number; allTime: number };
  daily: { date: string; amount: number }[];
  statusBreakdown: { approved: number; pending: number; rejected: number };
}

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <div className="text-muted-foreground mb-1">{new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
      <div className="font-semibold text-foreground">${payload[0].value.toLocaleString()} USDT</div>
    </div>
  );
}

export function AdminDashboardClient({ me, stats, revenue }: { me: Me | null; stats: Stats; revenue: Revenue | null }) {
  const router = useRouter();
  usePolling(() => router.refresh(), 20000);

  const can = (section: string) => !!me && (me.is_super_admin || me.permissions?.[section]);

  const statCards = [
    can("users") && { title: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", link: "/users" },
    can("licenses") && { title: "Active Licenses", value: stats.activeLicenses, icon: Key, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20", link: "/licenses" },
    can("purchases") && { title: "Pending Approvals", value: stats.pendingPurchases, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", link: "/purchases" },
    can("products") && { title: "Listed Products", value: stats.totalProducts, icon: Box, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20", link: "/products" },
  ].filter(Boolean) as any[];

  const quickAccess = [
    can("purchases") && { title: "Transactions", desc: "Review pending crypto payments", icon: CreditCard, color: "text-amber-500", bg: "bg-amber-500/10", link: "/purchases" },
    can("products") && { title: "Products", desc: "Catalog, versions and pricing", icon: Box, color: "text-purple-500", bg: "bg-purple-500/10", link: "/products" },
    can("users") && { title: "Users", desc: "Customer accounts and device bindings", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", link: "/users" },
    can("licenses") && { title: "Licenses", desc: "Issued keys and expirations", icon: Key, color: "text-emerald-500", bg: "bg-emerald-500/10", link: "/licenses" },
    can("wallets") && { title: "Wallets", desc: "Payment addresses", icon: Wallet, color: "text-cyan-500", bg: "bg-cyan-500/10", link: "/wallets" },
    can("logs") && { title: "System Logs", desc: "Login activity & hardware checks", icon: ScrollText, color: "text-slate-400", bg: "bg-slate-400/10", link: "/logs" },
    me?.is_super_admin && { title: "Admins", desc: "Team access & permissions", icon: UserCog, color: "text-rose-500", bg: "bg-rose-500/10", link: "/admins" },
  ].filter(Boolean) as any[];

  const statusTotal = revenue ? revenue.statusBreakdown.approved + revenue.statusBreakdown.pending + revenue.statusBreakdown.rejected : 0;
  const statusBars = revenue
    ? [
        { name: "Approved", value: revenue.statusBreakdown.approved, color: STATUS_COLORS.approved },
        { name: "Pending", value: revenue.statusBreakdown.pending, color: STATUS_COLORS.pending },
        { name: "Rejected", value: revenue.statusBreakdown.rejected, color: STATUS_COLORS.rejected },
      ]
    : [];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Activity className="w-10 h-10 text-primary" />
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            {me?.username ? `Welcome back, ${me.username}.` : ''} Customers, licenses, and revenue at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-xl border border-emerald-500/20 font-medium text-sm">
          <ShieldCheck className="w-5 h-5" />
          System Optimal
        </div>
      </div>

      {statCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card, index) => (
            <Link href={card.link} key={card.title} className="animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${index * 60}ms`, animationDuration: '500ms', animationFillMode: 'backwards' }}>
              <div className={`bg-card p-6 rounded-2xl border shadow-sm transition-all hover:scale-105 hover:shadow-md cursor-pointer ${card.border}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">{card.title}</p>
                    <h3 className="text-4xl font-bold text-foreground mt-2 tabular-nums">{card.value}</h3>
                  </div>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${card.bg}`}>
                    <card.icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  View Details <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {revenue && (
        <div>
          <h2 className="font-heading text-xl font-semibold mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Financial Status
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <div className="bg-card border border-border/50 rounded-2xl p-6">
              <p className="text-muted-foreground text-sm font-medium">Last 7 Days</p>
              <h3 className="text-3xl font-bold text-foreground mt-2 tabular-nums">${revenue.totals.last7Days.toLocaleString()}</h3>
              <p className="text-xs text-muted-foreground mt-1">USDT, approved payments</p>
            </div>
            <div className="bg-card border border-border/50 rounded-2xl p-6">
              <p className="text-muted-foreground text-sm font-medium">This Month</p>
              <h3 className="text-3xl font-bold text-foreground mt-2 tabular-nums">${revenue.totals.currentMonth.toLocaleString()}</h3>
              <p className="text-xs text-muted-foreground mt-1">USDT, approved payments</p>
            </div>
            <div className="bg-card border border-border/50 rounded-2xl p-6">
              <p className="text-muted-foreground text-sm font-medium">All-Time</p>
              <h3 className="text-3xl font-bold text-foreground mt-2 tabular-nums">${revenue.totals.allTime.toLocaleString()}</h3>
              <p className="text-xs text-muted-foreground mt-1">USDT, approved payments</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6">
              <p className="text-sm font-semibold text-foreground mb-4">Revenue — last 30 days</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenue.daily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={REVENUE_COLOR} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={REVENUE_COLOR} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { day: 'numeric' })}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={false}
                      interval={4}
                    />
                    <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={<RevenueTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="amount" stroke={REVENUE_COLOR} strokeWidth={2} fill="url(#revenueFill)" dot={false} activeDot={{ r: 4, fill: REVENUE_COLOR }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl p-6">
              <p className="text-sm font-semibold text-foreground mb-4">Transactions by Status</p>
              <div className="h-40 mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusBars} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
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
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><CheckCircle2 className="w-3.5 h-3.5" style={{ color: STATUS_COLORS.approved }} /> Approved</span>
                  <span className="font-semibold text-foreground tabular-nums">{revenue.statusBreakdown.approved}{statusTotal > 0 ? ` (${Math.round(revenue.statusBreakdown.approved / statusTotal * 100)}%)` : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><AlertTriangle className="w-3.5 h-3.5" style={{ color: STATUS_COLORS.pending }} /> Pending</span>
                  <span className="font-semibold text-foreground tabular-nums">{revenue.statusBreakdown.pending}{statusTotal > 0 ? ` (${Math.round(revenue.statusBreakdown.pending / statusTotal * 100)}%)` : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><XCircle className="w-3.5 h-3.5" style={{ color: STATUS_COLORS.rejected }} /> Rejected</span>
                  <span className="font-semibold text-foreground tabular-nums">{revenue.statusBreakdown.rejected}{statusTotal > 0 ? ` (${Math.round(revenue.statusBreakdown.rejected / statusTotal * 100)}%)` : ''}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {quickAccess.length > 0 && (
        <div>
          <h2 className="font-heading text-xl font-semibold mb-6">Quick Access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {quickAccess.map((item) => (
              <Link key={item.title} href={item.link} className="bg-card border border-border/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-muted/30 transition-colors group">
                <div className={`w-14 h-14 ${item.bg} ${item.color} rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <item.icon className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
