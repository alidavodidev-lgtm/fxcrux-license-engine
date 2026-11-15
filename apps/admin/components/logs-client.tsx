"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ScrollText, Search, Filter, CheckCircle, XCircle, RefreshCw, Monitor, Globe, AlertTriangle,
  ShieldCheck, User, Cog, ChevronLeft, ChevronRight, Loader2, Activity,
} from "lucide-react";
import { usePolling } from "@/hooks/usePolling";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableTh } from "@/components/ui/sortable-th";

const ACTION_LABELS: Record<string, string> = {
  ADMIN_LOGIN: "Admin Login",
  ADMIN_PASSWORD_CHANGED: "Admin Password Changed",
  ADMIN_CREATED: "Admin Created",
  ADMIN_UPDATED: "Admin Updated",
  ADMIN_PROMOTED: "Admin Promoted",
  ADMIN_DEMOTED: "Admin Demoted",
  ADMIN_STATUS_CHANGED: "Admin Status Changed",
  ADMIN_PERMISSIONS_UPDATED: "Admin Permissions Updated",
  USER_REGISTERED: "User Registered",
  USER_LOGIN: "User Login",
  USER_PASSWORD_CHANGED: "User Password Changed",
  USER_STATUS_CHANGED: "User Status Changed",
  USER_HARDWARE_RESET: "Hardware Reset",
  USER_HARDWARE_BOUND: "Hardware Bound",
  USER_UPDATED: "User Updated",
  PURCHASE_SUBMITTED: "Purchase Submitted",
  PURCHASE_APPROVED: "Purchase Approved",
  PURCHASE_REJECTED: "Purchase Rejected",
  LICENSE_ISSUED_MANUAL: "License Issued (Manual)",
  LICENSE_DATE_UPDATED: "License Date Updated",
  LICENSE_STATUS_CHANGED: "License Status Changed",
  PRODUCT_CREATED: "Product Created",
  PRODUCT_UPDATED: "Product Updated",
  TIER_CREATED: "Pricing Tier Created",
  TIER_UPDATED: "Pricing Tier Updated",
  TIER_DELETED: "Pricing Tier Deleted",
  APP_VERSION_CREATED: "App Version Created",
  APP_VERSION_UPDATED: "App Version Updated",
  APP_VERSION_DELETED: "App Version Deleted",
  APP_VERSION_ACCESS_ALL_USERS: "App Version Set to All Users",
  APP_VERSION_ACCESS_ASSIGNED: "App Version Access Assigned",
  PRODUCT_GROUP_CREATED: "Product Category Created",
  PRODUCT_GROUP_STATUS_CHANGED: "Product Category Status Changed",
  WALLET_CREATED: "Wallet Created",
  WALLET_UPDATED: "Wallet Updated",
  TICKET_GROUP_CREATED: "Ticket Category Created",
  TICKET_GROUP_STATUS_CHANGED: "Ticket Category Status Changed",
  TICKET_GROUP_ACCESS_UPDATED: "Ticket Category Access Updated",
};

interface AuditLogRow {
  id: string;
  actor_type: "ADMIN" | "USER" | "SYSTEM";
  actor_label: string | null;
  action: string;
  target_type: string | null;
  target_label: string | null;
  metadata: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

function ActorBadge({ type }: { type: string }) {
  if (type === "ADMIN") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
        <ShieldCheck className="w-3 h-3" /> Admin
      </span>
    );
  }
  if (type === "USER") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-violet-500 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
        <User className="w-3 h-3" /> User
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground bg-muted border border-border/50 px-2 py-0.5 rounded-full">
      <Cog className="w-3 h-3" /> System
    </span>
  );
}

function metadataSummary(metadata: Record<string, any> | null) {
  if (!metadata) return null;
  const parts = Object.entries(metadata)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .map(([k, v]) => `${k}: ${v}`);
  return parts.length ? parts.join(", ") : null;
}

function ActivityLogTab() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [actorType, setActorType] = useState("ALL");
  const [action, setAction] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("DESC");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (actorType !== "ALL") params.set("actorType", actorType);
    if (action !== "ALL") params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", String(page));
    params.set("limit", String(limit));
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);

    fetch(`/api/audit-logs?${params.toString()}`).then((r) => r.ok ? r.json() : null).then((data) => {
      if (data) {
        setRows(data.rows || []);
        setTotal(data.total || 0);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [search, actorType, action, from, to, page, limit, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);
  usePolling(load, 20000);

  const handleRefresh = () => {
    setIsRefreshing(true);
    load();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const resetFilters = () => {
    setSearch(""); setActorType("ALL"); setAction("ALL"); setFrom(""); setTo(""); setPage(1);
  };

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"));
    else { setSortBy(key); setSortDir("ASC"); }
    setPage(1);
  };
  const sortDirLower = sortDir === "ASC" ? "asc" : "desc";

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const actionOptions = Object.keys(ACTION_LABELS).sort((a, b) => ACTION_LABELS[a].localeCompare(ACTION_LABELS[b]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by actor or target..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          />
        </div>

        <select
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-40 appearance-none cursor-pointer"
          value={actorType}
          onChange={(e) => { setPage(1); setActorType(e.target.value); }}
        >
          <option value="ALL">All Actors</option>
          <option value="ADMIN">Admin</option>
          <option value="USER">User</option>
          <option value="SYSTEM">System</option>
        </select>

        <select
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-56 appearance-none cursor-pointer"
          value={action}
          onChange={(e) => { setPage(1); setAction(e.target.value); }}
        >
          <option value="ALL">All Event Types</option>
          {actionOptions.map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
        </select>

        <input
          type="date"
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-40"
          value={from}
          onChange={(e) => { setPage(1); setFrom(e.target.value); }}
          title="From date"
        />
        <input
          type="date"
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-40"
          value={to}
          onChange={(e) => { setPage(1); setTo(e.target.value); }}
          title="To date"
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
          {/* Desktop table */}
          <div className="hidden md:block bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
                  <tr>
                    <SortableTh label="Time" sortKey="created_at" activeSortKey={sortBy} sortDir={sortDirLower} onSort={handleSort} />
                    <SortableTh label="Actor" sortKey="actor_label" activeSortKey={sortBy} sortDir={sortDirLower} onSort={handleSort} />
                    <SortableTh label="Event" sortKey="action" activeSortKey={sortBy} sortDir={sortDirLower} onSort={handleSort} />
                    <SortableTh label="Target" sortKey="target_label" activeSortKey={sortBy} sortDir={sortDirLower} onSort={handleSort} />
                    <th className="px-6 py-4 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rows.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No activity found for these filters.</td></tr>
                  ) : (
                    rows.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-6 py-4 text-xs text-muted-foreground" suppressHydrationWarning>
                          {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <ActorBadge type={log.actor_type} />
                            <span className="text-xs text-muted-foreground truncate max-w-[140px]">{log.actor_label || '—'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-foreground">{ACTION_LABELS[log.action] || log.action}</td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {log.target_label ? <span className="truncate max-w-[160px] inline-block align-bottom">{log.target_label}</span> : '—'}
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground max-w-xs truncate" title={metadataSummary(log.metadata) || undefined}>
                          {metadataSummary(log.metadata) || (log.ip_address ? `IP: ${log.ip_address}` : '—')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {rows.length === 0 ? (
              <div className="bg-card border border-border/50 rounded-2xl p-10 text-center text-muted-foreground">No activity found for these filters.</div>
            ) : (
              rows.map((log) => (
                <div key={log.id} className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <ActorBadge type={log.actor_type} />
                    <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="font-semibold text-foreground text-sm">{ACTION_LABELS[log.action] || log.action}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{log.actor_label || '—'}</div>
                  {log.target_label && <div className="text-xs text-muted-foreground mt-1.5 border-t border-border/50 pt-1.5">Target: {log.target_label}</div>}
                  {metadataSummary(log.metadata) && <div className="text-xs text-muted-foreground mt-1 truncate">{metadataSummary(log.metadata)}</div>}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-muted-foreground">{total} event{total === 1 ? '' : 's'} total</p>
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

function LoginActivityTab({ initialLoginLogs }: { initialLoginLogs: any[] }) {
  const router = useRouter();
  usePolling(() => router.refresh(), 20000);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredLogs = initialLoginLogs.filter((log) => {
    const matchesSearch =
      (log.license_key && log.license_key.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.machine_id && log.machine_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const { sorted: sortedLogs, sortKey, sortDir, requestSort } = useSortableData(
    filteredLogs,
    (log, key) => (key === "created_at" ? new Date(log.created_at) : log[key]),
    "created_at", "desc",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by License Key, Machine ID, or IP Address..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative w-full md:w-64">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all appearance-none cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Events</option>
            <option value="SUCCESS">Successful Logins</option>
            <option value="FAILED">Blocked / Failed Attempts</option>
          </select>
        </div>

        <button
          onClick={handleRefresh}
          className="h-11 px-4 bg-card border border-border/50 text-foreground rounded-xl text-sm font-medium hover:bg-muted transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
              <tr>
                <SortableTh label="Status & Time" sortKey="created_at" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <SortableTh label="License Key" sortKey="license_key" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <th className="px-6 py-4 font-medium">Machine ID / IP</th>
                <th className="px-6 py-4 font-medium">Details / Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    No authentication logs found.
                  </td>
                </tr>
              ) : (
                sortedLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-muted/10 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {log.status === 'SUCCESS' ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500" />
                        )}
                        <div>
                          <div className={`font-semibold ${log.status === 'SUCCESS' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {log.status}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="font-mono text-xs bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-border/50 text-slate-300">
                        {log.license_key}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Monitor className="w-3.5 h-3.5" />
                          <span className="font-mono truncate max-w-[150px]" title={log.machine_id}>
                            {log.machine_id ? `${log.machine_id.substring(0,16)}...` : 'Unknown HW'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Globe className="w-3.5 h-3.5" />
                          <span className="font-mono">{log.ip_address || 'Unknown IP'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {log.error_message ? (
                        <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 inline-flex max-w-xs truncate" title={log.error_message}>
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate text-xs font-medium">{log.error_message}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Authenticated successfully</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile/tablet card list */}
      <div className="md:hidden space-y-3">
        {sortedLogs.length === 0 ? (
          <div className="bg-card border border-border/50 rounded-2xl p-10 text-center text-muted-foreground">
            No authentication logs found.
          </div>
        ) : (
          sortedLogs.map((log: any) => (
            <div key={log.id} className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-2.5">
                {log.status === 'SUCCESS' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className={`font-semibold ${log.status === 'SUCCESS' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {log.status}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-border/50 pt-2.5 mb-2.5">
                <span className="font-mono text-xs bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-border/50 text-slate-300 inline-block">
                  {log.license_key}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Monitor className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono truncate" title={log.machine_id}>
                    {log.machine_id ? `${log.machine_id.substring(0,20)}...` : 'Unknown HW'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono">{log.ip_address || 'Unknown IP'}</span>
                </div>
              </div>

              <div className="border-t border-border/50 pt-2.5">
                {log.error_message ? (
                  <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs font-medium">{log.error_message}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Authenticated successfully</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function LogsClient({ initialLoginLogs }: { initialLoginLogs: any[] }) {
  const [tab, setTab] = useState<"activity" | "login">("activity");

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <ScrollText className="w-8 h-8 text-primary" />
          System Logs
        </h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">
          Important admin and user activity, plus raw license/hardware authentication events.
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-border/50">
        <button
          onClick={() => setTab("activity")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${tab === "activity" ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Activity className="w-4 h-4" /> Activity Log
        </button>
        <button
          onClick={() => setTab("login")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${tab === "login" ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Globe className="w-4 h-4" /> Login Activity
        </button>
      </div>

      {tab === "activity" ? <ActivityLogTab /> : <LoginActivityTab initialLoginLogs={initialLoginLogs} />}
    </div>
  );
}
