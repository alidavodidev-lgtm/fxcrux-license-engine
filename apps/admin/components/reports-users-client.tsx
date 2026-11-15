"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3, Search, RefreshCw, CheckCircle, Clock, Ban, Loader2, ChevronLeft, ChevronRight, Mail, Key, CreditCard, ArrowRight, Download,
} from "lucide-react";
import { ReportsTabs } from "@/components/reports-tabs";
import { SortableTh } from "@/components/ui/sortable-th";

interface UserRow {
  id: string;
  username: string;
  email: string;
  machine_id: string | null;
  status: "PENDING" | "ACTIVE" | "BANNED";
  created_at: string;
  activeLicenseCount: number;
  totalPurchaseCount: number;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle className="w-3.5 h-3.5" /> Active</span>;
  if (status === 'PENDING') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> Pending</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20"><Ban className="w-3.5 h-3.5" /> Banned</span>;
}

export function ReportsUsersClient() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [hasMachineId, setHasMachineId] = useState("ALL");
  const [registeredFrom, setRegisteredFrom] = useState("");
  const [registeredTo, setRegisteredTo] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("DESC");

  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    if (hasMachineId !== "ALL") params.set("hasMachineId", hasMachineId);
    if (registeredFrom) params.set("registeredFrom", registeredFrom);
    if (registeredTo) params.set("registeredTo", registeredTo);
    return params;
  }, [search, status, hasMachineId, registeredFrom, registeredTo]);

  const load = useCallback(() => {
    const params = filterParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);

    fetch(`/api/analytics/users?${params.toString()}`).then((r) => r.ok ? r.json() : null).then((data) => {
      if (data) {
        setRows(data.rows || []);
        setTotal(data.total || 0);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filterParams, page, limit, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    load();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const resetFilters = () => {
    setSearch(""); setStatus("ALL"); setHasMachineId("ALL"); setRegisteredFrom(""); setRegisteredTo(""); setPage(1);
  };

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"));
    else { setSortBy(key); setSortDir("ASC"); }
    setPage(1);
  };

  const exportUrl = `/api/analytics/users/export?${filterParams().toString()}`;
  const sortDirLower = sortDir === "ASC" ? "asc" : "desc";
  const totalPages = Math.max(1, Math.ceil(total / limit));

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
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search username, email, or machine code..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          />
        </div>
        <select
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-40 appearance-none cursor-pointer"
          value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="BANNED">Banned</option>
        </select>
        <select
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-44 appearance-none cursor-pointer"
          value={hasMachineId} onChange={(e) => { setPage(1); setHasMachineId(e.target.value); }}
        >
          <option value="ALL">Any Hardware Lock</option>
          <option value="true">Bound Only</option>
          <option value="false">Unbound Only</option>
        </select>
        <input
          type="date" title="Registered from"
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-40"
          value={registeredFrom} onChange={(e) => { setPage(1); setRegisteredFrom(e.target.value); }}
        />
        <input
          type="date" title="Registered to"
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-40"
          value={registeredTo} onChange={(e) => { setPage(1); setRegisteredTo(e.target.value); }}
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
      ) : (
        <>
          <div className="hidden md:block bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
                  <tr>
                    <SortableTh label="Customer" sortKey="username" activeSortKey={sortBy} sortDir={sortDirLower} onSort={handleSort} />
                    <SortableTh label="Status" sortKey="status" activeSortKey={sortBy} sortDir={sortDirLower} onSort={handleSort} />
                    <SortableTh label="Active Licenses" sortKey="activeLicenseCount" activeSortKey={sortBy} sortDir={sortDirLower} onSort={handleSort} />
                    <SortableTh label="Purchases" sortKey="totalPurchaseCount" activeSortKey={sortBy} sortDir={sortDirLower} onSort={handleSort} />
                    <SortableTh label="Joined" sortKey="created_at" activeSortKey={sortBy} sortDir={sortDirLower} onSort={handleSort} />
                    <th className="px-6 py-4 font-medium text-right">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rows.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No users found for these filters.</td></tr>
                  ) : (
                    rows.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/10 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-foreground text-base">{u.username}</div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1"><Mail className="w-3 h-3" /><span>{u.email || 'No email'}</span></div>
                        </td>
                        <td className="px-6 py-4"><StatusBadge status={u.status} /></td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 text-foreground font-medium tabular-nums"><Key className="w-3.5 h-3.5 text-muted-foreground" /> {u.activeLicenseCount}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 text-foreground font-medium tabular-nums"><CreditCard className="w-3.5 h-3.5 text-muted-foreground" /> {u.totalPurchaseCount}</span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground" suppressHydrationWarning>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                          <Link href={`/reports/users/${u.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                            View <ArrowRight className="w-3.5 h-3.5" />
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
            {rows.length === 0 ? (
              <div className="bg-card border border-border/50 rounded-2xl p-10 text-center text-muted-foreground">No users found for these filters.</div>
            ) : (
              rows.map((u) => (
                <Link key={u.id} href={`/reports/users/${u.id}`} className="block bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground text-base truncate">{u.username}</div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5"><Mail className="w-3 h-3 shrink-0" /><span className="truncate">{u.email || 'No email'}</span></div>
                    </div>
                    <StatusBadge status={u.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 mt-2">
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><Key className="w-3.5 h-3.5" /> {u.activeLicenseCount}</span>
                      <span className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> {u.totalPurchaseCount}</span>
                    </span>
                    <span suppressHydrationWarning>{new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-muted-foreground">{total} user{total === 1 ? '' : 's'} total</p>
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
        </>
      )}
    </div>
  );
}
