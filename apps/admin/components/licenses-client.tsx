"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Key, Search, Filter, ShieldBan, CheckCircle, XCircle, RefreshCw, Box, Loader2, CalendarX, Plus, Edit2, Save
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { usePolling } from "@/hooks/usePolling";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableTh } from "@/components/ui/sortable-th";

export function LicensesClient({ initialLicenses, users, products }: { initialLicenses: any[], users: any[], products: any[] }) {
  const router = useRouter();
  usePolling(() => router.refresh(), 20000);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmToggleId, setConfirmToggleId] = useState<string | null>(null);

  const [editingLicense, setEditingLicense] = useState<any | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueData, setIssueData] = useState({ userId: "", productId: "", daysValid: 30 });

  const uniqueProducts = Array.from(new Set(initialLicenses.map(l => l.product?.name).filter(Boolean)));

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleToggleStatus = async (licenseId: string) => {
    setProcessingId(licenseId);
    try {
      const res = await fetch("/api/licenses/toggle-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ licenseId }) });
      if (res.ok) {
        handleRefresh();
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error.error || "Failed to update license status");
      }
    } catch {
      toast.error("Network error.");
    } finally { setProcessingId(null); }
  };

  const handleUpdateDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLicense) return;
    setProcessingId(editingLicense.id);
    try {
      const res = await fetch("/api/licenses/update-date", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseId: editingLicense.id, expiresAt: editingLicense.newDate })
      });
      if (res.ok) { setEditingLicense(null); handleRefresh(); }
    } finally { setProcessingId(null); }
  };

  const handleManualIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueData.userId || !issueData.productId) return toast.error("Select User and Product");
    setProcessingId("issuing");
    try {
      const res = await fetch("/api/licenses/issue-manual", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(issueData)
      });
      if (res.ok) { setIsIssuing(false); handleRefresh(); }
    } finally { setProcessingId(null); }
  };

  const filteredLicenses = initialLicenses.filter((license) => {
    const matchesSearch = (license.license_key && license.license_key.toLowerCase().includes(searchTerm.toLowerCase())) || (license.user?.username && license.user.username.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" && license.status === 'active') || (statusFilter === "REVOKED" && license.status !== 'active');
    const matchesProduct = productFilter === "ALL" || license.product?.name === productFilter;
    return matchesSearch && matchesStatus && matchesProduct;
  });

  const { sorted: sortedLicenses, sortKey, sortDir, requestSort } = useSortableData(
    filteredLicenses,
    (license, key) => {
      if (key === "license_key") return license.license_key || "";
      if (key === "user") return license.user?.username || "";
      if (key === "product") return license.product?.name || "";
      if (key === "expires_at") return new Date(license.expires_at);
      return license[key];
    },
  );

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground flex items-center gap-3"><Key className="w-8 h-8 text-primary" /> Licenses</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">Issued licenses, expiration dates, and manual grants.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsIssuing(true)} className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-all">
            <Plus className="w-4 h-4" /> Issue Manual
          </button>
          <button onClick={handleRefresh} className="bg-card border border-border/50 text-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-muted flex items-center gap-2 shadow-sm transition-all">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input type="text" placeholder="Search by license key or username..." className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-background text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <div className="relative w-full md:w-64"><Box className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><select className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}><option value="ALL">All Products</option>{uniqueProducts.map((p: any) => (<option key={p} value={p}>{p}</option>))}</select></div>
        <div className="relative w-full md:w-48"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><select className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">All Statuses</option><option value="ACTIVE">Active</option><option value="REVOKED">Revoked</option></select></div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
              <tr>
                <SortableTh label="License Key" sortKey="license_key" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <SortableTh label="Customer" sortKey="user" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <SortableTh label="Product" sortKey="product" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <th className="px-6 py-4 font-medium">Details</th>
                <SortableTh label="Expires At" sortKey="expires_at" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedLicenses.map((license: any) => {
                const isExpired = new Date() > new Date(license.expires_at);
                const isActive = license.status === 'active';
                return (
                  <tr key={license.id} className="hover:bg-muted/10 transition-colors group">
                    <td className="px-6 py-4"><span className="font-mono text-xs bg-slate-900/50 px-2 py-1 rounded border border-border/50 text-slate-300">{license.license_key}</span></td>
                    <td className="px-6 py-4 font-medium">{license.user?.username || <span className="text-muted-foreground italic">Unknown</span>}</td>
                    <td className="px-6 py-4">{license.product?.name || <span className="text-muted-foreground italic">Unknown</span>}</td>
                    <td className="px-6 py-4">
                      {license.is_manual ? <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md">Manual</span> : <span className="text-xs text-muted-foreground border border-border/50 bg-muted/20 px-2 py-0.5 rounded-md">Standard</span>}
                    </td>
                    <td className="px-6 py-4">
                      {isActive ? (
                        isExpired ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20"><CalendarX className="w-3.5 h-3.5" /> Expired</span> : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle className="w-3.5 h-3.5" /> Active</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20"><XCircle className="w-3.5 h-3.5" /> Revoked</span>
                      )}
                      <div className="text-xs text-muted-foreground mt-1" suppressHydrationWarning>{new Date(license.expires_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {processingId === license.id ? <Loader2 className="w-5 h-5 animate-spin text-primary inline-block mr-2" /> : (
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingLicense({ id: license.id, newDate: new Date(license.expires_at).toISOString().slice(0,16) })} className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit Expiration Date"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setConfirmToggleId(license.id)} className={`p-2 rounded-lg transition-colors ${isActive ? 'text-rose-500 hover:bg-rose-500/10' : 'text-emerald-500 hover:bg-emerald-500/10'}`} title={isActive ? "Revoke" : "Activate"}>{isActive ? <ShieldBan className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile/tablet card list */}
      <div className="md:hidden space-y-3">
        {sortedLicenses.map((license: any) => {
          const isExpired = new Date() > new Date(license.expires_at);
          const isActive = license.status === 'active';
          return (
            <div key={license.id} className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{license.product?.name || <span className="italic text-muted-foreground">Unknown</span>}</div>
                  <div className="text-xs text-muted-foreground truncate">{license.user?.username || <span className="italic">Unknown</span>}</div>
                </div>
                {isActive ? (
                  isExpired ? <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20"><CalendarX className="w-3.5 h-3.5" /> Expired</span> : <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle className="w-3.5 h-3.5" /> Active</span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20"><XCircle className="w-3.5 h-3.5" /> Revoked</span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2.5 mb-3">
                <span className="font-mono bg-slate-900/50 px-2 py-1 rounded border border-border/50 text-slate-300">{license.license_key}</span>
                <span suppressHydrationWarning>{new Date(license.expires_at).toLocaleDateString()}</span>
              </div>

              {processingId === license.id ? (
                <div className="flex justify-center py-1"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : (
                <div className="flex items-center gap-2 border-t border-border/50 pt-3">
                  <button onClick={() => setEditingLicense({ id: license.id, newDate: new Date(license.expires_at).toISOString().slice(0,16) })} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-primary bg-primary/10 rounded-lg"><Edit2 className="w-3.5 h-3.5" /> Edit Date</button>
                  <button onClick={() => setConfirmToggleId(license.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg ${isActive ? 'text-rose-500 bg-rose-500/10' : 'text-emerald-500 bg-emerald-500/10'}`}>
                    {isActive ? <><ShieldBan className="w-3.5 h-3.5" /> Revoke</> : <><CheckCircle className="w-3.5 h-3.5" /> Activate</>}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modals omitted for brevity but remain functional */}
      <Dialog open={!!editingLicense} onOpenChange={(open) => !open && setEditingLicense(null)}>
        <DialogContent className="sm:max-w-[400px] border-border bg-card shadow-2xl rounded-2xl">
          <form onSubmit={handleUpdateDate}>
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="flex items-center gap-2"><CalendarX className="w-5 h-5 text-primary"/> Edit Expiration Date</DialogTitle>
            </DialogHeader>
            <div className="py-6"><Label>New Expiration Date & Time</Label><input type="datetime-local" className="mt-2 h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm text-slate-50" value={editingLicense?.newDate || ""} onChange={(e) => setEditingLicense({ ...editingLicense, newDate: e.target.value })} required /></div>
            <DialogFooter className="pt-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setEditingLicense(null)}>Cancel</Button>
              <Button type="submit"><Save className="mr-2 w-4 h-4"/> Save Date</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isIssuing} onOpenChange={setIsIssuing}>
        <DialogContent className="sm:max-w-[480px] border-border bg-card shadow-2xl rounded-2xl">
          <form onSubmit={handleManualIssue}>
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="flex items-center gap-2"><Key className="w-5 h-5 text-primary"/> Issue Manual License</DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 py-6">
              <div className="grid gap-2"><Label>Select Customer</Label><select className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm text-slate-50" value={issueData.userId} onChange={(e) => setIssueData({ ...issueData, userId: e.target.value })} required><option value="" disabled>Select a user...</option>{users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}</select></div>
              <div className="grid gap-2"><Label>Select Product</Label><select className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm text-slate-50" value={issueData.productId} onChange={(e) => setIssueData({ ...issueData, productId: e.target.value })} required><option value="" disabled>Select a product...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="grid gap-2"><Label>Duration (Days)</Label><input type="number" min="1" className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm text-slate-50" value={issueData.daysValid} onChange={(e) => setIssueData({ ...issueData, daysValid: parseInt(e.target.value) })} required /></div>
            </div>
            <DialogFooter className="pt-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setIsIssuing(false)}>Cancel</Button>
              <Button type="submit" disabled={processingId === "issuing"}>{processingId === "issuing" ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Key className="mr-2 w-4 h-4"/>} Generate License</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmToggleId}
        onOpenChange={(open) => !open && setConfirmToggleId(null)}
        title="Change License Status"
        description="Change the status of this license?"
        confirmLabel="Confirm"
        destructive={false}
        onConfirm={() => confirmToggleId && handleToggleStatus(confirmToggleId)}
      />
    </div>
  );
}
