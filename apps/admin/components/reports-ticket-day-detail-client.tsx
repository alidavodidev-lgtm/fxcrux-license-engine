"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Star, ExternalLink, Users, LifeBuoy, ChevronLeft, ChevronRight, Tag,
} from "lucide-react";

interface TicketRow {
  id: string;
  subject: string;
  status: "OPEN" | "CLOSED";
  rating: number | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  user: { id: string; username: string } | null;
  group: { id: string; name: string } | null;
  lastResponderAdmin: { id: string; username: string } | null;
}

interface DayDetail {
  tickets: TicketRow[];
  stats: {
    byGroup: { groupId: string; groupName: string; ticketCount: number }[];
    byAdmin: { adminId: string; adminUsername: string; ticketCount: number; avgRating: number | null }[];
    distinctUserCount: number;
    totalTickets: number;
  };
}

interface Filters {
  status?: string;
  groupId?: string;
  adminId?: string;
  userSearch?: string;
  search?: string;
}

function TicketStatusBadge({ status }: { status: string }) {
  if (status === 'OPEN') return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">Open</span>;
  return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Closed</span>;
}

const TICKETS_PER_PAGE = 20;

export function ReportsTicketDayDetailClient({ date, filters }: { date: string; filters: Filters }) {
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.groupId) params.set("groupId", filters.groupId);
    if (filters.adminId) params.set("adminId", filters.adminId);
    if (filters.userSearch) params.set("userSearch", filters.userSearch);
    if (filters.search) params.set("search", filters.search);

    fetch(`/api/analytics/tickets/day/${encodeURIComponent(date)}?${params.toString()}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { setDetail(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [date, filters.status, filters.groupId, filters.adminId, filters.userSearch, filters.search]);

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (!detail) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        <div className="bg-card border border-border/50 rounded-2xl p-12 text-center text-muted-foreground">No data found for this day.</div>
      </div>
    );
  }

  const { tickets, stats } = detail;
  const displayDate = new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const totalPages = Math.max(1, Math.ceil(tickets.length / TICKETS_PER_PAGE));
  const pagedTickets = tickets.slice((page - 1) * TICKETS_PER_PAGE, page * TICKETS_PER_PAGE);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <Link href="/reports/tickets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Tickets Report
        </Link>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <LifeBuoy className="w-8 h-8 text-primary" /> {displayDate}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">{stats.totalTickets} ticket{stats.totalTickets === 1 ? '' : 's'} · {stats.distinctUserCount} distinct user{stats.distinctUserCount === 1 ? '' : 's'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border/50 rounded-2xl p-6">
          <p className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-primary" /> By Category</p>
          {stats.byGroup.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categorized tickets.</p>
          ) : (
            <div className="space-y-2">
              {stats.byGroup.map((g) => (
                <div key={g.groupId} className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium">{g.groupName}</span>
                  <span className="text-muted-foreground tabular-nums">{g.ticketCount}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6">
          <p className="text-sm font-semibold text-foreground mb-4">By Admin — Closed &amp; Rated</p>
          {stats.byAdmin.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets closed this day.</p>
          ) : (
            <div className="space-y-2">
              {stats.byAdmin.map((a) => (
                <div key={a.adminId} className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium">{a.adminUsername}</span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <span className="tabular-nums">{a.ticketCount}</span>
                    {a.avgRating !== null && (
                      <span className="flex items-center gap-1 text-amber-500"><Star className="w-3.5 h-3.5 fill-amber-500" /> {a.avgRating}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6 flex flex-col justify-center">
          <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Distinct Users</p>
          <p className="text-3xl font-bold text-foreground tabular-nums">{stats.distinctUserCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Unique accounts that opened a ticket this day.</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-4">Tickets — {displayDate}</p>

        <div className="hidden md:block bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Subject</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Opened By</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Responder</th>
                  <th className="px-6 py-4 font-medium">Rating</th>
                  <th className="px-6 py-4 font-medium text-right">Thread</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {pagedTickets.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No tickets for these filters.</td></tr>
                ) : (
                  pagedTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 text-foreground max-w-xs truncate">{t.subject}</td>
                      <td className="px-6 py-4 text-muted-foreground">{t.group?.name || '—'}</td>
                      <td className="px-6 py-4 text-muted-foreground">{t.user?.username || '—'}</td>
                      <td className="px-6 py-4"><TicketStatusBadge status={t.status} /></td>
                      <td className="px-6 py-4 text-muted-foreground">{t.lastResponderAdmin?.username || '—'}</td>
                      <td className="px-6 py-4">
                        {t.rating ? <span className="flex items-center gap-1 text-amber-500"><Star className="w-3.5 h-3.5 fill-amber-500" /> {t.rating}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/tickets/${t.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                          View <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:hidden space-y-3">
          {pagedTickets.length === 0 ? (
            <div className="bg-card border border-border/50 rounded-2xl p-10 text-center text-muted-foreground">No tickets for these filters.</div>
          ) : (
            pagedTickets.map((t) => (
              <Link key={t.id} href={`/tickets/${t.id}`} className="block bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-semibold text-foreground text-sm truncate">{t.subject}</span>
                  <TicketStatusBadge status={t.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t.user?.username || '—'} · {t.group?.name || '—'}</span>
                  {t.rating ? <span className="flex items-center gap-1 text-amber-500"><Star className="w-3 h-3 fill-amber-500" /> {t.rating}</span> : null}
                </div>
              </Link>
            ))
          )}
        </div>

        {tickets.length > TICKETS_PER_PAGE && (
          <div className="flex items-center justify-between gap-4 flex-wrap mt-4">
            <p className="text-xs text-muted-foreground">{tickets.length} ticket{tickets.length === 1 ? '' : 's'} total</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg border border-border/50 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg border border-border/50 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
