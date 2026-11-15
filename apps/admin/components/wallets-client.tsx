"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Server, AlertCircle, Edit2, Loader2, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AddWalletDialog } from "@/components/add-wallet-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { usePolling } from "@/hooks/usePolling";
import { useSortableData } from "@/hooks/useSortableData";

export function WalletsClient({ initialWallets }: { initialWallets: any[] }) {
  const router = useRouter();
  usePolling(() => router.refresh(), 30000);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingWallet, setEditingWallet] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sortField, setSortField] = useState("created_at");

  const { sorted: sortedWallets, sortKey, sortDir, requestSort } = useSortableData(
    initialWallets,
    (wallet, key) => (key === "created_at" ? new Date(wallet.created_at) : key === "is_active" ? (wallet.is_active !== false) : wallet[key]),
    "created_at", "desc",
  );

  // Sort field is driven by a <select> here (no column headers on a card
  // grid) - requestSort() toggles direction if you re-pick the same field,
  // so keep them in sync when the user explicitly picks a new one.
  const handleSortFieldChange = (key: string) => {
    setSortField(key);
    if (sortKey !== key) requestSort(key);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleUpdateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWallet) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/wallets/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingWallet),
      });

      if (res.ok) {
        setEditingWallet(null);
        handleRefresh();
      } else {
        toast.error("Failed to update wallet.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Wallet className="w-8 h-8 text-primary" />
            Wallets
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Addresses customers use to send crypto payments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="h-11 px-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 text-sm appearance-none cursor-pointer"
            value={sortField} onChange={(e) => handleSortFieldChange(e.target.value)}
            title="Sort by"
          >
            <option value="created_at">Sort: Newest</option>
            <option value="network">Sort: Network</option>
            <option value="is_active">Sort: Status</option>
          </select>
          <button onClick={handleRefresh} className="bg-card border border-border/50 text-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition-all flex items-center gap-2 shadow-sm">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <AddWalletDialog />
        </div>
      </div>

      {/* Wallets Grid */}
      {sortedWallets.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card border border-border/50 rounded-2xl text-muted-foreground">
          <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">No wallets found</p>
          <p className="text-sm mt-1">Add a wallet to allow users to submit transaction IDs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sortedWallets.map((wallet: any, i: number) => (
            <div key={wallet.id} className={`bg-card text-card-foreground p-6 rounded-2xl border animate-in fade-in slide-in-from-bottom-2 ${wallet.is_active !== false ? 'border-border/50 hover:border-primary/50' : 'border-rose-500/20 opacity-80'} shadow-sm relative overflow-hidden group transition-all`} style={{ animationDelay: `${i * 60}ms`, animationDuration: '500ms', animationFillMode: 'backwards' }}>
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -z-10 ${wallet.is_active !== false ? 'bg-primary/5' : 'bg-rose-500/5'}`} />

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-800 rounded-lg">
                    <Server className={`w-5 h-5 ${wallet.is_active !== false ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{wallet.network}</h3>
                    {wallet.is_active !== false ? (
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Active</span>
                    ) : (
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">Disabled</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setEditingWallet({ ...wallet, is_active: wallet.is_active !== false })}
                  className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Edit Wallet"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Address</label>
                  <p className="text-sm font-mono bg-slate-900/50 p-2.5 rounded-lg border border-border/50 mt-1 break-all text-slate-300">
                    {wallet.address}
                  </p>
                </div>
                {wallet.description && (
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Description</label>
                    <p className="text-sm text-muted-foreground mt-1 bg-muted/20 p-2.5 rounded-lg">{wallet.description}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Wallet Modal */}
      <Dialog open={!!editingWallet} onOpenChange={(open) => !open && setEditingWallet(null)}>
        <DialogContent className="sm:max-w-[480px] border-border bg-card shadow-2xl rounded-2xl">
          <form onSubmit={handleUpdateWallet}>
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="text-xl flex items-center gap-2"><div className="p-2 bg-primary/10 rounded-lg"><Edit2 className="w-5 h-5 text-primary" /></div>Edit Wallet</DialogTitle>
              <DialogDescription>Update payment address, network, or toggle its availability.</DialogDescription>
            </DialogHeader>
            {editingWallet && (
              <div className="grid gap-5 py-6">
                <div className="grid gap-2"><Label className="text-sm font-semibold">Network (e.g. TRC20)</Label><input type="text" className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm" value={editingWallet.network} onChange={(e) => setEditingWallet({ ...editingWallet, network: e.target.value })} required /></div>
                <div className="grid gap-2"><Label className="text-sm font-semibold">Wallet Address</Label><input type="text" className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm font-mono" value={editingWallet.address} onChange={(e) => setEditingWallet({ ...editingWallet, address: e.target.value })} required /></div>
                <div className="grid gap-2"><Label className="text-sm font-semibold">Description</Label><input type="text" className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm" value={editingWallet.description || ""} onChange={(e) => setEditingWallet({ ...editingWallet, description: e.target.value })} /></div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-border/80 bg-slate-900">
                  <div>
                    <Label className="text-sm font-semibold text-foreground">Active Status</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Allow users to select this wallet for payments</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={editingWallet.is_active} onChange={(e) => setEditingWallet({ ...editingWallet, is_active: e.target.checked })} />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            )}
            <DialogFooter className="pt-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setEditingWallet(null)} disabled={isSaving}>Cancel</Button>
              <Button type="submit" disabled={!editingWallet?.address || isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}