"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserCog, Plus, Loader2, Ban, CheckCircle, Crown, Star, Pencil, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { usePolling } from "@/hooks/usePolling";
import { useSortableData } from "@/hooks/useSortableData";

const SECTIONS = [
  { key: "purchases", label: "Transactions" },
  { key: "products", label: "Products" },
  { key: "users", label: "Users" },
  { key: "licenses", label: "Licenses" },
  { key: "wallets", label: "Wallets" },
  { key: "logs", label: "Logs" },
  { key: "tickets", label: "Tickets" },
  { key: "reports", label: "Reports" },
] as const;

type Section = (typeof SECTIONS)[number]["key"];
type Permissions = Record<Section, boolean> & { ticketGroupIds: string[] | null };

interface TicketGroup {
  id: string;
  name: string;
}

interface RatingStat {
  adminId: string;
  averageRating: number;
  ratingCount: number;
}

interface AdminRow {
  id: string;
  username: string;
  is_super_admin: boolean;
  is_active: boolean;
  permissions: Permissions;
}

const emptyPermissions = {
  purchases: false, products: false, users: false, licenses: false, wallets: false, logs: false, tickets: false, reports: false,
};

export function AdminsClient({ initialAdmins, groups, ratingStats, currentAdminId }: { initialAdmins: AdminRow[]; groups: TicketGroup[]; ratingStats: RatingStat[]; currentAdminId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmToggleId, setConfirmToggleId] = useState<string | null>(null);
  const [confirmPromoteId, setConfirmPromoteId] = useState<string | null>(null);
  const [confirmDemoteId, setConfirmDemoteId] = useState<string | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<AdminRow | null>(null);
  const [editForm, setEditForm] = useState({ username: "", password: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", ...emptyPermissions });
  const ratingByAdmin = new Map(ratingStats.map((r) => [r.adminId, r]));
  const [sortField, setSortField] = useState("username");
  const { sorted: sortedAdmins, sortKey, requestSort } = useSortableData(
    initialAdmins,
    (admin, key) => (key === "rating" ? (ratingByAdmin.get(admin.id)?.averageRating ?? -1) : (admin as any)[key]),
    "username", "asc",
  );
  const handleSortFieldChange = (key: string) => {
    setSortField(key);
    if (sortKey !== key) requestSort(key);
  };

  usePolling(() => router.refresh(), 30000);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Admin created.");
        setOpen(false);
        setForm({ username: "", password: "", ...emptyPermissions });
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create admin");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setCreating(false);
    }
  };

  const handlePermissionChange = async (admin: AdminRow, section: Section, value: boolean) => {
    setSavingId(admin.id);
    try {
      const res = await fetch("/api/admin/admins/update-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: admin.id, [section]: value }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update permission");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSavingId(null);
    }
  };

  const handleTicketGroupsChange = async (admin: AdminRow, groupId: string, checked: boolean) => {
    const current = admin.permissions?.ticketGroupIds || [];
    const next = checked ? [...current, groupId] : current.filter((id) => id !== groupId);
    setSavingId(admin.id);
    try {
      const res = await fetch("/api/admin/admins/update-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: admin.id, ticketGroupIds: next }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update category access");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSavingId(null);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setSavingEdit(true);
    try {
      const payload: any = { adminId: editingAdmin.id };
      if (editForm.username && editForm.username !== editingAdmin.username) payload.username = editForm.username;
      if (editForm.password) payload.password = editForm.password;

      const res = await fetch("/api/admin/admins/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("Admin updated.");
        setEditingAdmin(null);
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update admin");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePromote = async (adminId: string) => {
    setSavingId(adminId);
    try {
      const res = await fetch("/api/admin/admins/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId }),
      });
      if (res.ok) {
        toast.success("Admin promoted to super admin.");
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to promote admin");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDemote = async (adminId: string) => {
    setSavingId(adminId);
    try {
      const res = await fetch("/api/admin/admins/demote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId }),
      });
      if (res.ok) {
        toast.success("Admin demoted to regular admin.");
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to demote admin");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (adminId: string) => {
    setSavingId(adminId);
    try {
      const res = await fetch("/api/admin/admins/toggle-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId }),
      });
      if (res.ok) {
        toast.success("Admin status updated.");
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update admin");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <UserCog className="w-8 h-8 text-primary" /> Admins
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Who can access this panel, and which sections they can see.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm appearance-none cursor-pointer"
            value={sortField} onChange={(e) => handleSortFieldChange(e.target.value)}
            title="Sort by"
          >
            <option value="username">Sort: Username</option>
            <option value="rating">Sort: Rating</option>
          </select>
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Admin
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px] border-border bg-card text-card-foreground shadow-2xl rounded-2xl">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>New Admin</DialogTitle>
                <DialogDescription>Create an admin account and choose what they can access.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="admin-username">Username</Label>
                  <Input id="admin-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <Input id="admin-password" type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label>Access</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SECTIONS.map((s) => (
                      <label key={s.key} className="flex items-center gap-2 text-sm p-2.5 rounded-lg border border-border/80 bg-slate-900 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form[s.key]}
                          onChange={(e) => setForm({ ...form, [s.key]: e.target.checked })}
                        />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={creating}>Cancel</Button>
                <Button type="submit" disabled={!form.username || !form.password || creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Admin
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4">
        {sortedAdmins.map((admin) => (
          <div key={admin.id} className={`bg-card border border-border/50 rounded-2xl p-5 shadow-sm ${!admin.is_active ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${admin.is_super_admin ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}>
                  {admin.is_super_admin ? <Crown className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                </div>
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    {admin.username}
                    {admin.is_super_admin && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">Super Admin</span>}
                    {!admin.is_active && <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">Disabled</span>}
                    {ratingByAdmin.has(admin.id) && (
                      <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-500" /> {ratingByAdmin.get(admin.id)!.averageRating} ({ratingByAdmin.get(admin.id)!.ratingCount})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {savingId === admin.id ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => { setEditingAdmin(admin); setEditForm({ username: admin.username, password: "" }); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1.5 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  {admin.is_super_admin ? (
                    admin.id !== currentAdminId && (
                      <button
                        onClick={() => setConfirmDemoteId(admin.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-500/20 text-amber-500 hover:bg-amber-500/10 flex items-center gap-1.5 transition-colors"
                      >
                        <ArrowDownCircle className="w-3.5 h-3.5" /> Demote
                      </button>
                    )
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirmPromoteId(admin.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-500/20 text-amber-500 hover:bg-amber-500/10 flex items-center gap-1.5 transition-colors"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" /> Promote
                      </button>
                      <button
                        onClick={() => setConfirmToggleId(admin.id)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${admin.is_active ? 'text-rose-500 border-rose-500/20 hover:bg-rose-500/10' : 'text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10'}`}
                      >
                        {admin.is_active ? <><Ban className="w-3.5 h-3.5" /> Disable</> : <><CheckCircle className="w-3.5 h-3.5" /> Enable</>}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {admin.is_super_admin ? (
              <p className="text-sm text-muted-foreground">Full access to every section - can't be restricted.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SECTIONS.map((s) => (
                    <label key={s.key} className="flex items-center gap-2 text-sm p-2 rounded-lg border border-border/50 bg-muted/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={admin.permissions?.[s.key] ?? false}
                        disabled={savingId === admin.id}
                        onChange={(e) => handlePermissionChange(admin, s.key, e.target.checked)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>

                {admin.permissions?.tickets && groups.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg border border-border/50 bg-muted/10">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ticket Categories (blank = all)</p>
                    <div className="flex flex-wrap gap-2">
                      {groups.map((g) => {
                        const checked = (admin.permissions.ticketGroupIds || []).includes(g.id);
                        return (
                          <label key={g.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-border/50 bg-slate-900 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={savingId === admin.id}
                              onChange={(e) => handleTicketGroupsChange(admin, g.id, e.target.checked)}
                            />
                            {g.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!confirmToggleId}
        onOpenChange={(o) => !o && setConfirmToggleId(null)}
        title="Change Admin Status"
        description="Enabling or disabling takes effect immediately - a disabled admin's existing session stops working right away."
        confirmLabel="Confirm"
        destructive={false}
        onConfirm={() => confirmToggleId && handleToggleActive(confirmToggleId)}
      />

      <ConfirmDialog
        open={!!confirmPromoteId}
        onOpenChange={(o) => !o && setConfirmPromoteId(null)}
        title="Promote to Super Admin"
        description="This grants full access to every section, including managing other admins, and can't be section-restricted afterward."
        confirmLabel="Promote"
        destructive={false}
        onConfirm={() => confirmPromoteId && handlePromote(confirmPromoteId)}
      />

      <ConfirmDialog
        open={!!confirmDemoteId}
        onOpenChange={(o) => !o && setConfirmDemoteId(null)}
        title="Demote to Regular Admin"
        description="Removes full access immediately - all section permissions reset to none, and you'll need to grant access again from here."
        confirmLabel="Demote"
        onConfirm={() => confirmDemoteId && handleDemote(confirmDemoteId)}
      />

      <Dialog open={!!editingAdmin} onOpenChange={(o) => !o && setEditingAdmin(null)}>
        <DialogContent className="sm:max-w-[420px] border-border bg-card text-card-foreground shadow-2xl rounded-2xl">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Admin</DialogTitle>
              <DialogDescription>Update username or set a new password. Leave password blank to keep the current one.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="grid gap-2">
                <Label htmlFor="edit-username">Username</Label>
                <Input id="edit-username" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-password">New Password (optional)</Label>
                <Input id="edit-password" type="password" minLength={6} placeholder="Leave blank to keep current password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingAdmin(null)} disabled={savingEdit}>Cancel</Button>
              <Button type="submit" disabled={!editForm.username || savingEdit}>
                {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
