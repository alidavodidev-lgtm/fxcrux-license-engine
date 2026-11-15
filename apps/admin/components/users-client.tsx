"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Search, Filter, ShieldAlert, MonitorX, CheckCircle, Ban, Clock, RefreshCw, Mail, Loader2, UserCheck, Edit2, Save
} from "lucide-react";
import { CreateUserDialog } from "@/components/create-user-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { usePolling } from "@/hooks/usePolling";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableTh } from "@/components/ui/sortable-th";

export function UsersClient({ initialUsers }: { initialUsers: any[] }) {
  const router = useRouter();
  usePolling(() => router.refresh(), 20000);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmResetUserId, setConfirmResetUserId] = useState<string | null>(null);

  // States for Edit Modal
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSaving(true);
    try {
      const payload: any = { id: editingUser.id, username: editingUser.username, email: editingUser.email };
      if (editingUser.newPassword) payload.password = editingUser.newPassword;

      const res = await fetch("/api/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditingUser(null);
        handleRefresh();
      } else {
        toast.error("Failed to update user.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetHardware = async (userId: string) => {
    setProcessingId(userId);
    try {
      const res = await fetch("/api/users/reset-hardware", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (res.ok) handleRefresh();
    } finally { setProcessingId(null); }
  };

  const handleToggleStatus = async (userId: string) => {
    setProcessingId(userId);
    try {
      const res = await fetch("/api/users/toggle-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (res.ok) handleRefresh();
    } finally { setProcessingId(null); }
  };

  const filteredUsers = initialUsers.filter((user) => {
    const matchesSearch = (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase())) || (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "ALL" || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { sorted: sortedUsers, sortKey, sortDir, requestSort } = useSortableData(
    filteredUsers,
    (user, key) => (key === "machine_id" ? (user.machine_id || "") : key === "created_at" ? new Date(user.created_at) : user[key]),
  );

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" /> Users
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">Manage customer accounts and device bindings.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} className="bg-card border border-border/50 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition-all flex items-center gap-2 shadow-sm">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <CreateUserDialog />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search by username or email..." className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-background text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="relative w-full md:w-64">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Customers</option>
            <option value="PENDING">Pending</option>
            <option value="BANNED">Banned</option>
          </select>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
              <tr>
                <SortableTh label="Customer" sortKey="username" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <SortableTh label="Status" sortKey="status" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <SortableTh label="Hardware Lock" sortKey="machine_id" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <SortableTh label="Joined Date" sortKey="created_at" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedUsers.map((user: any) => (
                <tr key={user.id} className="hover:bg-muted/10 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-foreground text-base">{user.username}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1"><Mail className="w-3 h-3" /><span>{user.email || 'No email'}</span></div>
                  </td>
                  <td className="px-6 py-4">
                    {user.status === 'ACTIVE' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle className="w-3.5 h-3.5" /> Active</span>}
                    {user.status === 'PENDING' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> Pending</span>}
                    {user.status === 'BANNED' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20"><Ban className="w-3.5 h-3.5" /> Banned</span>}
                  </td>
                  <td className="px-6 py-4">{user.machine_id ? <span className="font-mono text-xs bg-slate-900/50 px-2 py-1 rounded border border-border/50 text-slate-300">{user.machine_id.length > 20 ? `${user.machine_id.substring(0, 20)}...` : user.machine_id}</span> : <span className="text-muted-foreground text-xs italic">Unbound</span>}</td>
                  <td className="px-6 py-4 text-muted-foreground" suppressHydrationWarning>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    {processingId === user.id ? <Loader2 className="w-5 h-5 animate-spin text-primary inline-block mr-2" /> : (
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingUser({ ...user, newPassword: "" })} className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit User"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setConfirmResetUserId(user.id)} className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors" title="Reset Hardware Lock"><MonitorX className="w-4 h-4" /></button>
                        <button onClick={() => handleToggleStatus(user.id)} className={`p-2 rounded-lg transition-colors ${user.status === 'PENDING' ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-rose-500 hover:bg-rose-500/10'}`} title={user.status === 'PENDING' ? "Approve User" : "Toggle Ban"}>
                          {user.status === 'PENDING' ? <UserCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile/tablet card list */}
      <div className="md:hidden space-y-3">
        {sortedUsers.map((user: any) => (
          <div key={user.id} className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="font-semibold text-foreground text-base truncate">{user.username}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1"><Mail className="w-3 h-3 shrink-0" /><span className="truncate">{user.email || 'No email'}</span></div>
              </div>
              {user.status === 'ACTIVE' && <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle className="w-3.5 h-3.5" /> Active</span>}
              {user.status === 'PENDING' && <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> Pending</span>}
              {user.status === 'BANNED' && <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20"><Ban className="w-3.5 h-3.5" /> Banned</span>}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3 mb-3">
              <span>{user.machine_id ? <span className="font-mono">{user.machine_id.substring(0, 14)}...</span> : <span className="italic">Unbound</span>}</span>
              <span suppressHydrationWarning>{new Date(user.created_at).toLocaleDateString()}</span>
            </div>

            {processingId === user.id ? (
              <div className="flex justify-center py-1"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : (
              <div className="flex items-center gap-2 border-t border-border/50 pt-3">
                <button onClick={() => setEditingUser({ ...user, newPassword: "" })} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-primary bg-primary/10 rounded-lg"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
                <button onClick={() => setConfirmResetUserId(user.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-amber-500 bg-amber-500/10 rounded-lg"><MonitorX className="w-3.5 h-3.5" /> Reset HW</button>
                <button onClick={() => handleToggleStatus(user.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg ${user.status === 'PENDING' ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}>
                  {user.status === 'PENDING' ? <><UserCheck className="w-3.5 h-3.5" /> Approve</> : <><ShieldAlert className="w-3.5 h-3.5" /> Ban</>}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit User Modal */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-[480px] border-border bg-card shadow-2xl rounded-2xl">
          <form onSubmit={handleUpdateUser}>
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="text-xl flex items-center gap-2"><div className="p-2 bg-primary/10 rounded-lg"><Edit2 className="w-5 h-5 text-primary" /></div>Edit Customer Profile</DialogTitle>
              <DialogDescription>Update username, email, or assign a new password.</DialogDescription>
            </DialogHeader>
            {editingUser && (
              <div className="grid gap-5 py-6">
                <div className="grid gap-2"><Label className="text-sm font-semibold">Username</Label><input type="text" className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm" value={editingUser.username} onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })} required /></div>
                <div className="grid gap-2"><Label className="text-sm font-semibold">Email</Label><input type="email" className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm" value={editingUser.email} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} required /></div>
                <div className="grid gap-2"><Label className="text-sm font-semibold">New Password (Optional)</Label><input type="text" placeholder="Leave blank to keep current password" className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm" value={editingUser.newPassword || ""} onChange={(e) => setEditingUser({ ...editingUser, newPassword: e.target.value })} /></div>
              </div>
            )}
            <DialogFooter className="pt-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setEditingUser(null)} disabled={isSaving}>Cancel</Button>
              <Button type="submit" disabled={!editingUser?.username || isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmResetUserId}
        onOpenChange={(open) => !open && setConfirmResetUserId(null)}
        title="Reset Hardware Lock"
        description="Are you sure you want to reset the hardware lock? The user will be able to bind a new machine."
        confirmLabel="Reset"
        onConfirm={() => confirmResetUserId && handleResetHardware(confirmResetUserId)}
      />
    </div>
  );
}