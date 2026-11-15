"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ticket as TicketIcon, Search, Filter, Clock, CheckCircle2, RefreshCw, Settings, Plus, Loader2, Star, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePolling } from "@/hooks/usePolling";
import { useSortableData } from "@/hooks/useSortableData";

interface TicketGroup {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

interface TicketRow {
  id: string;
  subject: string;
  status: "OPEN" | "CLOSED";
  rating: number | null;
  updated_at: string;
  user: { username: string };
  group: TicketGroup;
}

export function TicketsClient({ initialTickets, groups, isSuperAdmin }: { initialTickets: TicketRow[]; groups: TicketGroup[]; isSuperAdmin: boolean }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [accessGroup, setAccessGroup] = useState<TicketGroup | null>(null);
  const [accessAdmins, setAccessAdmins] = useState<{ id: string; username: string; hasAccess: boolean }[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  usePolling(() => router.refresh(), 15000);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingGroup(true);
    try {
      const res = await fetch("/api/tickets/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGroup),
      });
      if (res.ok) {
        toast.success("Category created.");
        setNewGroup({ name: "", description: "" });
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create category");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleToggleGroup = async (groupId: string) => {
    setTogglingId(groupId);
    try {
      const res = await fetch("/api/tickets/groups/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setTogglingId(null);
    }
  };

  const openAccessPanel = async (group: TicketGroup) => {
    setAccessGroup(group);
    setLoadingAccess(true);
    try {
      const res = await fetch(`/api/tickets/groups/${group.id}/admins`);
      setAccessAdmins(res.ok ? await res.json() : []);
    } catch {
      setAccessAdmins([]);
    } finally {
      setLoadingAccess(false);
    }
  };

  const toggleAccessAdmin = (adminId: string, checked: boolean) => {
    setAccessAdmins((prev) => prev.map((a) => (a.id === adminId ? { ...a, hasAccess: checked } : a)));
  };

  const handleSaveAccess = async () => {
    if (!accessGroup) return;
    setSavingAccess(true);
    try {
      const res = await fetch("/api/tickets/groups/assign-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: accessGroup.id, adminIds: accessAdmins.filter((a) => a.hasAccess).map((a) => a.id) }),
      });
      if (res.ok) {
        toast.success("Category access updated.");
        setAccessGroup(null);
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update access");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSavingAccess(false);
    }
  };

  const filtered = initialTickets.filter((t) => {
    const matchesSearch = t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || t.user?.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    const matchesGroup = groupFilter === "ALL" || t.group?.id === groupFilter;
    return matchesSearch && matchesStatus && matchesGroup;
  });

  const [sortField, setSortField] = useState("updated_at");
  const { sorted: sortedTickets, sortKey, requestSort } = useSortableData(
    filtered,
    (t, key) => (key === "updated_at" ? new Date(t.updated_at) : key === "rating" ? (t.rating ?? -1) : (t as any)[key]),
    "updated_at", "desc",
  );
  const handleSortFieldChange = (key: string) => {
    setSortField(key);
    if (sortKey !== key) requestSort(key);
  };

  const TICKETS_PER_PAGE = 20;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [searchTerm, statusFilter, groupFilter, sortField]);
  const totalPages = Math.max(1, Math.ceil(sortedTickets.length / TICKETS_PER_PAGE));
  const pagedTickets = sortedTickets.slice((page - 1) * TICKETS_PER_PAGE, page * TICKETS_PER_PAGE);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <TicketIcon className="w-8 h-8 text-primary" /> Tickets
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">Support requests from customers.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} className="bg-card border border-border/50 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition-all flex items-center gap-2 shadow-sm">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {isSuperAdmin && (
            <button onClick={() => setShowGroups(true)} className="bg-card border border-border/50 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition-all flex items-center gap-2 shadow-sm">
              <Settings className="w-4 h-4" /> Categories
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search by subject or username..." className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-background text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="relative w-full md:w-56">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="ALL">All Categories</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="relative w-full md:w-48">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <select
          className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm w-full md:w-40 appearance-none cursor-pointer"
          value={sortField} onChange={(e) => handleSortFieldChange(e.target.value)}
          title="Sort by"
        >
          <option value="updated_at">Sort: Latest</option>
          <option value="rating">Sort: Rating</option>
          <option value="status">Sort: Status</option>
        </select>
      </div>

      {sortedTickets.length === 0 ? (
        <div className="bg-card border border-border/50 rounded-2xl p-16 text-center">
          <TicketIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No tickets found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pagedTickets.map((t) => (
            <Link key={t.id} href={`/tickets/${t.id}`} className="block bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">{t.group?.name}</span>
                    {t.status === 'OPEN' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> Open</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground bg-muted border border-border/50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Closed</span>
                    )}
                    {t.rating && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        <Star className="w-3 h-3 fill-amber-500" /> {t.rating}
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-foreground truncate">{t.subject}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.user?.username}</div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0" suppressHydrationWarning>{new Date(t.updated_at).toLocaleDateString()}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {sortedTickets.length > TICKETS_PER_PAGE && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-muted-foreground">{sortedTickets.length} ticket{sortedTickets.length === 1 ? '' : 's'} total</p>
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

      <Dialog open={showGroups} onOpenChange={setShowGroups}>
        <DialogContent className="sm:max-w-[520px] border-border bg-card shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Ticket Categories</DialogTitle>
            <DialogDescription>Users must pick one of these when opening a ticket. Admins can be scoped to specific categories from the Admins page.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4 max-h-[40vh] overflow-y-auto">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No categories yet - add one below.</p>
            ) : (
              groups.map((g) => (
                <div key={g.id} className="flex items-center justify-between p-3 rounded-xl border border-border/80 bg-slate-900">
                  <div>
                    <div className="font-semibold text-sm">{g.name}</div>
                    {g.description && <div className="text-xs text-muted-foreground mt-0.5">{g.description}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openAccessPanel(g)}
                      className="text-xs font-medium px-2.5 py-1 rounded-full border border-border/50 text-muted-foreground hover:bg-muted flex items-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" /> Access
                    </button>
                    {togglingId === g.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <button
                        onClick={() => handleToggleGroup(g.id)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border ${g.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border/50'}`}
                      >
                        {g.is_active ? 'Active' : 'Disabled'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleCreateGroup} className="space-y-3 pt-4 border-t border-border/50">
            <Label className="text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> New Category</Label>
            <Input placeholder="e.g., Billing, Technical, License Issue" value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} required />
            <Input placeholder="Short description (optional)" value={newGroup.description} onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })} />
            <DialogFooter className="pt-2">
              <Button type="submit" disabled={!newGroup.name || creatingGroup}>
                {creatingGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!accessGroup} onOpenChange={(o) => !o && setAccessGroup(null)}>
        <DialogContent className="sm:max-w-[420px] border-border bg-card shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Access - {accessGroup?.name}</DialogTitle>
            <DialogDescription>Which admins can see and reply to tickets in this category. Always editable here or from the Admins page.</DialogDescription>
          </DialogHeader>

          <div className="py-4 max-h-[40vh] overflow-y-auto space-y-2">
            {loadingAccess ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : accessAdmins.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No admins have the Tickets permission yet.</p>
            ) : (
              accessAdmins.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm p-2.5 rounded-lg border border-border/80 bg-slate-900 cursor-pointer">
                  <input type="checkbox" checked={a.hasAccess} onChange={(e) => toggleAccessAdmin(a.id, e.target.checked)} />
                  {a.username}
                </label>
              ))
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAccessGroup(null)} disabled={savingAccess}>Cancel</Button>
            <Button type="button" onClick={handleSaveAccess} disabled={savingAccess || loadingAccess}>
              {savingAccess && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
