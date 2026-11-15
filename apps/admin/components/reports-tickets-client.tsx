"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, RefreshCw, Loader2, Download, ChevronLeft, ChevronRight, Star, Eye, LifeBuoy, Users,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { ReportsTabs } from "@/components/reports-tabs";
import { SortableTh } from "@/components/ui/sortable-th";
import { useSortableData } from "@/hooks/useSortableData";

// Same validated single-hue palette as the Financial report's revenue chart.
const VOLUME_COLOR = "#3987e5";
const STATUS_COLORS = { open: "#fab219", closed: "#0ca30c" };

interface TicketsReport {
  buckets: { date: string; count: number }[];
  statusBreakdown: { open: number; closed: number };
  byAdmin: { adminId: string; adminUsername: string; ticketCount: number; avgRating: number | null }[];
}

interface DayBucket { date: string; ticketCount: number; distinctUserCount: number; }
interface TicketGroupOption { id: string; name: string; }
interface AdminOption { id: string; username: string; }

function VolumeTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <div className="text-muted-foreground mb-1" suppressHydrationWarning>{new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
      <div className="font-semibold text-foreground">{payload[0].value} ticket{payload[0].value === 1 ? '' : 's'}</div>
    </div>
  );
}

export function ReportsTicketsClient() {
  const router = useRouter();
  const [report, setReport] = useState<TicketsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("ALL");
  const [groupId, setGroupId] = useState("ALL");
  const [adminId, setAdminId] = useState("ALL");
  const [userSearch, setUserSearch] = useState("");
  const [search, setSearch] = useState("");

  const [groups, setGroups] = useState<TicketGroupOption[]>([]);
  const [admins, setAdmins] = useState<AdminOption[]>([]);

  const [dayBuckets, setDayBuckets] = useState<DayBucket[]>([]);
  const [dayBucketsLoading, setDayBucketsLoading] = useState(true);
  const [bucketPage, setBucketPage] = useState(1);
  const BUCKETS_PER_PAGE = 7;

  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status !== "ALL") params.set("status", status);
    if (groupId !== "ALL") params.set("groupId", groupId);
    if (adminId !== "ALL") params.set("adminId", adminId);
    if (userSearch) params.set("userSearch", userSearch);
    return params;
  }, [from, to, status, groupId, adminId, userSearch]);

  useEffect(() => {
    fetch("/api/analytics/tickets/groups").then((r) => r.ok ? r.json() : []).then(setGroups).catch(() => setGroups([]));
    fetch("/api/analytics/tickets/admins").then((r) => r.ok ? r.json() : []).then(setAdmins).catch(() => setAdmins([]));
  }, []);

  const load = useCallback(() => {
    const params = filterParams();
    params.set("groupBy", "day");
    fetch(`/api/analytics/tickets?${params.toString()}`).then((r) => r.ok ? r.json() : null).then((data) => {
      setReport(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filterParams]);

  const loadDayBuckets = useCallback(() => {
    setDayBucketsLoading(true);
    const params = filterParams();
    fetch(`/api/analytics/tickets/by-day?${params.toString()}`).then((r) => r.ok ? r.json() : null).then((data) => {
      setDayBuckets(Array.isArray(data) ? data : []);
      setDayBucketsLoading(false);
    }).catch(() => setDayBucketsLoading(false));
  }, [filterParams]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadDayBuckets(); }, [loadDayBuckets]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    load(); loadDayBuckets();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const resetFilters = () => {
    setFrom(""); setTo(""); setStatus("ALL"); setGroupId("ALL"); setAdminId("ALL"); setUserSearch(""); setSearch("");
  };

  const {
    sorted: sortedBuckets, sortKey: bucketSortKey, sortDir: bucketSortDir, requestSort: requestBucketSort,
  } = useSortableData(
    dayBuckets,
    (row, key) => (key === "date" ? row.date : key === "ticketCount" ? row.ticketCount : row.distinctUserCount),
    "date", "desc",
  );

  const bucketTotalPages = Math.max(1, Math.ceil(sortedBuckets.length / BUCKETS_PER_PAGE));
  const pagedBuckets = sortedBuckets.slice((bucketPage - 1) * BUCKETS_PER_PAGE, bucketPage * BUCKETS_PER_PAGE);

  useEffect(() => { setBucketPage(1); }, [dayBuckets, bucketSortKey, bucketSortDir]);

  const viewDay = (date: string) => {
    const params = filterParams();
    if (search) params.set("search", search);
    router.push(`/reports/tickets/${encodeURIComponent(date.slice(0, 10))}?${params.toString()}`);
  };

  const exportUrl = (() => {
    const params = filterParams();
    if (search) params.set("search", search);
    return `/api/analytics/tickets/export?${params.toString()}`;
  })();

  const statusTotal = report ? report.statusBreakdown.open + report.statusBreakdown.closed : 0;

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
          value={from} onChange={(e) => setFrom(e.target.value)}
        />
        <input
          type="date" title="To date"
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-40"
          value={to} onChange={(e) => setTo(e.target.value)}
        />
        <select
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-40 appearance-none cursor-pointer"
          value={status} onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-44 appearance-none cursor-pointer"
          value={groupId} onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="ALL">All Categories</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-44 appearance-none cursor-pointer"
          value={adminId} onChange={(e) => setAdminId(e.target.value)}
        >
          <option value="ALL">All Responders</option>
          {admins.map((a) => <option key={a.id} value={a.id}>{a.username}</option>)}
        </select>
        <input
          type="text" placeholder="Opened by (username)..."
          className="h-11 px-3 rounded-xl border border-border/80 bg-background text-sm w-full md:w-48"
          value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
        />
        <input
          type="text" placeholder="Search subject..."
          className="h-11 px-3 rounded-xl border border-border/80 bg-background text-sm flex-1 min-w-[180px]"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6">
              <p className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><LifeBuoy className="w-4 h-4 text-primary" /> Tickets over time</p>
              <div className="h-64">
                {report.buckets.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data for these filters.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report.buckets} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ticketsVolumeFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={VOLUME_COLOR} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={VOLUME_COLOR} stopOpacity={0} />
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
                      <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                      <Tooltip content={<VolumeTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                      <Area type="monotone" dataKey="count" stroke={VOLUME_COLOR} strokeWidth={2} fill="url(#ticketsVolumeFill)" dot={false} activeDot={{ r: 4, fill: VOLUME_COLOR }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="flex items-center gap-6 mt-4 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.open }} /> Open: <span className="font-semibold text-foreground tabular-nums">{report.statusBreakdown.open}{statusTotal > 0 ? ` (${Math.round(report.statusBreakdown.open / statusTotal * 100)}%)` : ''}</span></span>
                <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS.closed }} /> Closed: <span className="font-semibold text-foreground tabular-nums">{report.statusBreakdown.closed}{statusTotal > 0 ? ` (${Math.round(report.statusBreakdown.closed / statusTotal * 100)}%)` : ''}</span></span>
              </div>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl p-6">
              <p className="text-sm font-semibold text-foreground mb-4">By Admin — Replies &amp; Rating</p>
              {report.byAdmin.length === 0 ? (
                <p className="text-sm text-muted-foreground">No responses in this range.</p>
              ) : (
                <div className="space-y-3">
                  {report.byAdmin.map((a) => (
                    <div key={a.adminId} className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-medium">{a.adminUsername}</span>
                      <span className="flex items-center gap-3 text-muted-foreground">
                        <span className="tabular-nums">{a.ticketCount} tickets</span>
                        {a.avgRating !== null && (
                          <span className="flex items-center gap-1 text-amber-500"><Star className="w-3.5 h-3.5 fill-amber-500" /> {a.avgRating}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground mb-4">Tickets by Day</p>
            {dayBucketsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : (
              <>
                <div className="hidden md:block bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
                        <tr>
                          <SortableTh label="Date" sortKey="date" activeSortKey={bucketSortKey} sortDir={bucketSortDir} onSort={requestBucketSort} />
                          <SortableTh label="Tickets" sortKey="ticketCount" activeSortKey={bucketSortKey} sortDir={bucketSortDir} onSort={requestBucketSort} />
                          <SortableTh label="Distinct Users" sortKey="distinctUserCount" activeSortKey={bucketSortKey} sortDir={bucketSortDir} onSort={requestBucketSort} />
                          <th className="px-6 py-4 font-medium text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {pagedBuckets.length === 0 ? (
                          <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No tickets for these filters.</td></tr>
                        ) : (
                          pagedBuckets.map((b) => (
                            <tr key={b.date} className="hover:bg-muted/10 transition-colors">
                              <td className="px-6 py-4 text-foreground" suppressHydrationWarning>{new Date(b.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                              <td className="px-6 py-4 text-muted-foreground">{b.ticketCount}</td>
                              <td className="px-6 py-4 text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {b.distinctUserCount}</td>
                              <td className="px-6 py-4 text-right">
                                <button onClick={() => viewDay(b.date)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                                  <Eye className="w-3.5 h-3.5" /> View Details
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
                    <div className="bg-card border border-border/50 rounded-2xl p-10 text-center text-muted-foreground">No tickets for these filters.</div>
                  ) : (
                    pagedBuckets.map((b) => (
                      <button key={b.date} onClick={() => viewDay(b.date)} className="w-full text-left bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground text-sm" suppressHydrationWarning>{new Date(b.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          <span className="inline-flex items-center gap-1 text-primary font-semibold text-xs"><Eye className="w-3.5 h-3.5" /> View</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
                          <span>{b.ticketCount} ticket{b.ticketCount === 1 ? '' : 's'}</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {b.distinctUserCount} user{b.distinctUserCount === 1 ? '' : 's'}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {sortedBuckets.length > BUCKETS_PER_PAGE && (
                  <div className="flex items-center justify-between gap-4 flex-wrap mt-4">
                    <p className="text-xs text-muted-foreground">{sortedBuckets.length} day{sortedBuckets.length === 1 ? '' : 's'} total</p>
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
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
