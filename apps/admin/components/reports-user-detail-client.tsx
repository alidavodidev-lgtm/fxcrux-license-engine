"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Mail, MonitorSmartphone, CheckCircle, Clock, Ban, Key, CreditCard, LifeBuoy, Star,
  Loader2, CalendarClock, XCircle, AlertCircle, Download, History, Wrench,
} from "lucide-react";
import { usePolling } from "@/hooks/usePolling";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableTh } from "@/components/ui/sortable-th";

interface License {
  id: string;
  license_key: string;
  expires_at: string;
  is_active: boolean;
  status: string;
  paid_amount: number;
  is_manual: boolean;
  date_manually_adjusted: boolean;
  created_at: string;
  product: { id: string; name: string } | null;
}

interface Purchase {
  id: string;
  tx_id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  duration_days: number;
  amount: number;
  rejection_reason: string | null;
  created_at: string;
  product: { id: string; name: string } | null;
  tier: { id: string; label: string } | null;
}

interface MachineIdChange {
  action: string;
  changedBy: string;
  actorLabel: string | null;
  oldMachineId: string | null;
  newMachineId: string | null;
  createdAt: string;
}

interface UserDetail {
  user: {
    id: string;
    username: string;
    email: string;
    machine_id: string | null;
    status: "PENDING" | "ACTIVE" | "BANNED";
    created_at: string;
  };
  licenses: License[];
  purchases: Purchase[];
  tickets: { total: number; open: number; closed: number; avgRatingGiven: number | null };
  machineIdHistory: { changeCount: number; history: MachineIdChange[] };
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle className="w-3.5 h-3.5" /> Active</span>;
  if (status === 'PENDING') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> Pending</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20"><Ban className="w-3.5 h-3.5" /> Banned</span>;
}

function PurchaseStatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle className="w-3.5 h-3.5" /> Approved</span>;
  if (status === 'PENDING') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> Pending</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20"><XCircle className="w-3.5 h-3.5" /> Rejected</span>;
}

export function ReportsUserDetailClient({ userId }: { userId: string }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch(`/api/analytics/users/${userId}`).then((r) => r.ok ? r.json() : null).then((data) => {
      setDetail(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  usePolling(load, 30000);

  const { sorted: sortedPurchases, sortKey, sortDir, requestSort } = useSortableData(
    detail?.purchases ?? [],
    (p, key) => {
      if (key === "product") return p.product?.name || "";
      if (key === "amount") return Number(p.amount) || 0;
      if (key === "created_at") return new Date(p.created_at);
      return (p as any)[key];
    },
    "created_at", "desc",
  );

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (!detail) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        <div className="bg-card border border-border/50 rounded-2xl p-12 text-center text-muted-foreground">User not found.</div>
      </div>
    );
  }

  const { user, licenses, purchases, tickets, machineIdHistory } = detail;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <Link href="/reports/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Users Report
        </Link>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">{user.username}</h1>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1"><Mail className="w-3.5 h-3.5" /> {user.email || 'No email'}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <StatusBadge status={user.status} />
            <a
              href={`/api/analytics/users/${userId}/export`}
              className="h-10 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
            >
              <Download className="w-4 h-4" /> Export
            </a>
          </div>
        </div>
      </div>

      {/* Account metadata */}
      <div className="bg-card border border-border/50 rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1.5"><MonitorSmartphone className="w-3.5 h-3.5" /> Machine Code</p>
          {user.machine_id ? (
            <p className="font-mono text-sm text-foreground mt-1.5 break-all">{user.machine_id}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic mt-1.5">Unbound</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Registered</p>
          <p className="text-sm text-foreground mt-1.5" suppressHydrationWarning>{new Date(user.created_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1.5"><LifeBuoy className="w-3.5 h-3.5" /> Support Tickets</p>
          <p className="text-sm text-foreground mt-1.5">
            {tickets.total} total &middot; {tickets.open} open &middot; {tickets.closed} closed
            {tickets.avgRatingGiven !== null && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-500"><Star className="w-3.5 h-3.5 fill-amber-500" /> {tickets.avgRatingGiven}</span>
            )}
          </p>
        </div>
      </div>

      {/* Machine ID change history - the "identify suspicious users" signal */}
      <div>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-primary" /> Machine Code History
          {machineIdHistory.changeCount > 0 && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${machineIdHistory.changeCount >= 3 ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
              {machineIdHistory.changeCount} reset{machineIdHistory.changeCount === 1 ? '' : 's'}
            </span>
          )}
        </h2>
        {machineIdHistory.history.length === 0 ? (
          <div className="bg-card border border-border/50 rounded-2xl p-8 text-center text-muted-foreground text-sm">No machine code activity recorded.</div>
        ) : (
          <>
            <div className="hidden md:block bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
                    <tr>
                      <th className="px-6 py-4 font-medium">Event</th>
                      <th className="px-6 py-4 font-medium">Changed By</th>
                      <th className="px-6 py-4 font-medium">Old Machine ID</th>
                      <th className="px-6 py-4 font-medium">New Machine ID</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {machineIdHistory.history.map((h, i) => (
                      <tr key={i} className="hover:bg-muted/10 transition-colors">
                        <td className="px-6 py-4 text-foreground">{h.action === 'USER_HARDWARE_RESET' ? 'Reset' : 'Bound'}</td>
                        <td className="px-6 py-4 text-muted-foreground">{h.changedBy}{h.actorLabel ? ` (${h.actorLabel})` : ''}</td>
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground max-w-[180px] truncate" title={h.oldMachineId || undefined}>{h.oldMachineId || '—'}</td>
                        <td className="px-6 py-4 font-mono text-xs text-foreground max-w-[180px] truncate" title={h.newMachineId || undefined}>{h.newMachineId || '—'}</td>
                        <td className="px-6 py-4 text-muted-foreground" suppressHydrationWarning>{new Date(h.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="md:hidden space-y-3">
              {machineIdHistory.history.map((h, i) => (
                <div key={i} className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-semibold text-foreground text-sm">{h.action === 'USER_HARDWARE_RESET' ? 'Reset' : 'Bound'}</span>
                    <span className="text-xs text-muted-foreground" suppressHydrationWarning>{new Date(h.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">By {h.changedBy}{h.actorLabel ? ` (${h.actorLabel})` : ''}</div>
                  <div className="text-xs font-mono text-muted-foreground truncate">Old: {h.oldMachineId || '—'}</div>
                  <div className="text-xs font-mono text-foreground truncate">New: {h.newMachineId || '—'}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Product history - every product this user has ever held a license
      for, as cards: lit up while active, dimmed once expired/revoked. */}
      <div>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2"><Key className="w-5 h-5 text-primary" /> Product History ({licenses.length})</h2>
        {licenses.length === 0 ? (
          <div className="bg-card border border-border/50 rounded-2xl p-8 text-center text-muted-foreground text-sm">No licenses yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {licenses.map((l) => {
              const isLive = l.is_active && new Date(l.expires_at) > new Date();
              const wasManuallyAdjusted = l.is_manual || l.date_manually_adjusted;
              return (
                <div
                  key={l.id}
                  className={`rounded-2xl p-4 border transition-all ${
                    isLive
                      ? 'bg-card border-emerald-500/30 shadow-sm'
                      : 'bg-card/50 border-border/50 opacity-60 grayscale-[0.4]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-semibold text-foreground">{l.product?.name || 'Unknown Product'}</div>
                    {isLive ? (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                    ) : (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-muted-foreground/40 mt-1.5" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{l.license_key}</div>
                  <div className="text-xs text-muted-foreground mt-2" suppressHydrationWarning>
                    {isLive ? 'Expires' : 'Expired'} {new Date(l.expires_at).toLocaleDateString()}
                  </div>
                  {wasManuallyAdjusted && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                      <Wrench className="w-2.5 h-2.5" /> Manually Adjusted
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Purchase / invoice history */}
      <div>
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> Purchase History ({purchases.length})</h2>

        <div className="hidden md:block bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
                <tr>
                  <SortableTh label="Product / Plan" sortKey="product" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                  <SortableTh label="Amount" sortKey="amount" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                  <SortableTh label="Status" sortKey="status" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                  <SortableTh label="Date" sortKey="created_at" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                  <th className="px-6 py-4 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedPurchases.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No purchases yet.</td></tr>
                ) : (
                  sortedPurchases.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{p.product?.name || 'Unknown Product'}</div>
                        {p.tier && <div className="text-xs text-muted-foreground mt-0.5">{p.tier.label}</div>}
                      </td>
                      <td className="px-6 py-4 font-semibold text-foreground tabular-nums">${Number(p.amount).toLocaleString()}</td>
                      <td className="px-6 py-4"><PurchaseStatusBadge status={p.status} /></td>
                      <td className="px-6 py-4 text-muted-foreground" suppressHydrationWarning>{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 max-w-xs">
                        {p.status === 'REJECTED' && p.rejection_reason ? (
                          <span className="flex items-start gap-1.5 text-xs text-rose-500"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {p.rejection_reason}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono truncate block max-w-[160px]" title={p.tx_id}>{p.tx_id}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:hidden space-y-3">
          {sortedPurchases.length === 0 ? (
            <div className="bg-card border border-border/50 rounded-2xl p-10 text-center text-muted-foreground">No purchases yet.</div>
          ) : (
            sortedPurchases.map((p) => (
              <div key={p.id} className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-foreground text-sm">{p.product?.name || 'Unknown Product'}</span>
                  <PurchaseStatusBadge status={p.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{p.tier?.label || '—'}</span>
                  <span className="font-semibold text-foreground tabular-nums">${Number(p.amount).toLocaleString()}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1" suppressHydrationWarning>{new Date(p.created_at).toLocaleDateString()}</div>
                {p.status === 'REJECTED' && p.rejection_reason && (
                  <div className="flex items-start gap-1.5 text-xs text-rose-500 mt-2 pt-2 border-t border-border/50"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {p.rejection_reason}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
