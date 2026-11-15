"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle, DollarSign, Edit2, Loader2, Plus, Save, Tag, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface Tier {
  id: string;
  label: string;
  duration_days: number;
  price: number;
  is_active: boolean;
  is_one_time: boolean;
}

export function ManageTiersDialog({ product, open, onOpenChange }: { product: any; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ label: "", duration_days: 30, price: 0, is_one_time: false });
  const [processingTierId, setProcessingTierId] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [deletingTierId, setDeletingTierId] = useState<string | null>(null);

  const tiers: Tier[] = product?.tiers || [];

  const handleAddTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.label) return;

    try {
      setLoading(true);
      const res = await fetch("/api/products/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, ...formData }),
      });

      if (res.ok) {
        setFormData({ label: "", duration_days: 30, price: 0, is_one_time: false });
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to add tier");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTier = async (tier: Tier) => {
    setProcessingTierId(tier.id);
    try {
      const res = await fetch("/api/products/tiers/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tier.id, is_active: !tier.is_active }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update tier");
      }
    } catch (error) {
      toast.error("Network error.");
    } finally {
      setProcessingTierId(null);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTier) return;
    setProcessingTierId(editingTier.id);
    try {
      const res = await fetch("/api/products/tiers/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTier.id,
          label: editingTier.label,
          duration_days: editingTier.duration_days,
          price: editingTier.price,
          is_one_time: editingTier.is_one_time,
        }),
      });
      if (res.ok) {
        setEditingTier(null);
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update tier");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setProcessingTierId(null);
    }
  };

  const handleDeleteTier = async () => {
    if (!deletingTierId) return;
    const tierId = deletingTierId;
    setDeletingTierId(null);
    setProcessingTierId(tierId);
    try {
      const res = await fetch("/api/products/tiers/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tierId }),
      });
      if (res.ok) {
        toast.success("Tier removed.");
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete tier");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setProcessingTierId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] border-border bg-card shadow-2xl rounded-2xl">
        <DialogHeader className="pb-4 border-b border-border/50">
          <DialogTitle className="text-xl flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CalendarClock className="w-5 h-5 text-primary" />
            </div>
            Pricing Tiers — {product?.name}
          </DialogTitle>
          <DialogDescription>Define the purchasable durations and prices for this product (e.g. 1 Month, 3 Months, Lifetime).</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[50vh] overflow-y-auto">
          {tiers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No tiers defined yet — add one below.</p>
          ) : (
            tiers.map((tier) => (
              <div key={tier.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-border/80 bg-slate-900">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{tier.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                    <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {tier.duration_days} days</span>
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {tier.price} USDT</span>
                    {tier.is_one_time && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        One-Time
                      </span>
                    )}
                  </div>
                </div>

                {processingTierId === tier.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleToggleTier(tier)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        tier.is_active
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : "bg-muted text-muted-foreground border-border/50"
                      }`}
                    >
                      {tier.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {tier.is_active ? "Active" : "Inactive"}
                    </button>
                    <button
                      onClick={() => setEditingTier(tier)}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Edit tier"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingTierId(tier.id)}
                      className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Delete tier"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleAddTier} className="space-y-3 pt-4 border-t border-border/50">
          <Label className="text-sm font-semibold flex items-center gap-2"><Tag className="w-4 h-4 text-primary" /> Add New Tier</Label>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text" placeholder="Label (e.g. 3 Months)" required
              className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50 col-span-3 sm:col-span-1"
              value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            />
            <input
              type="number" min="1" placeholder="Days" required
              className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50"
              value={formData.duration_days} onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) || 1 })}
            />
            <input
              type="number" min="0" step="0.01" placeholder="Price (USDT)" required
              className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50"
              value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <p className="text-xs text-muted-foreground">Tip: use 36500 days for a "Lifetime" tier.</p>
          <label className="flex items-center gap-2 text-sm text-muted-foreground select-none cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border/80 accent-primary"
              checked={formData.is_one_time}
              onChange={(e) => setFormData({ ...formData, is_one_time: e.target.checked })}
            />
            Purchasable only once per user
          </label>
          <DialogFooter className="pt-2">
            <Button type="submit" disabled={!formData.label || loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Tier
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <Dialog open={!!editingTier} onOpenChange={(o) => !o && setEditingTier(null)}>
        <DialogContent className="sm:max-w-[420px] border-border bg-card shadow-2xl rounded-2xl">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle>Edit Tier</DialogTitle>
              <DialogDescription>Existing purchases already made under this tier keep their own recorded price/duration - this only affects future purchases.</DialogDescription>
            </DialogHeader>
            {editingTier && (
              <div className="grid gap-4 py-6">
                <div className="grid gap-2">
                  <Label className="text-sm font-semibold">Label</Label>
                  <input
                    type="text" required
                    className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50"
                    value={editingTier.label} onChange={(e) => setEditingTier({ ...editingTier, label: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold">Days</Label>
                    <input
                      type="number" min="1" required
                      className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50"
                      value={editingTier.duration_days} onChange={(e) => setEditingTier({ ...editingTier, duration_days: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold">Price (USDT)</Label>
                    <input
                      type="number" min="0" step="0.01" required
                      className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50"
                      value={editingTier.price} onChange={(e) => setEditingTier({ ...editingTier, price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground select-none cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border/80 accent-primary"
                    checked={editingTier.is_one_time}
                    onChange={(e) => setEditingTier({ ...editingTier, is_one_time: e.target.checked })}
                  />
                  Purchasable only once per user
                </label>
              </div>
            )}
            <DialogFooter className="pt-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setEditingTier(null)}>Cancel</Button>
              <Button type="submit" disabled={!editingTier?.label}>
                <Save className="mr-2 h-4 w-4" /> Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingTierId}
        onOpenChange={(o) => !o && setDeletingTierId(null)}
        title="Delete Tier"
        description="Removes it from this list and from the store. Any past purchases made under it are unaffected - they keep their own recorded price and duration."
        confirmLabel="Delete"
        onConfirm={handleDeleteTier}
      />
    </Dialog>
  );
}
