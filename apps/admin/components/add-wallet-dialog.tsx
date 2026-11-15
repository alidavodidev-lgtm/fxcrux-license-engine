"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Loader2, Network, Hash, AlignLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AddWalletDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    network: "TRC20",
    address: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.address || !formData.network) return;

    try {
      setLoading(true);
      const res = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setOpen(false);
        setFormData({ network: "TRC20", address: "", description: "" });
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to add wallet");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 shadow-sm text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add New Wallet
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px] border-border bg-card text-card-foreground shadow-2xl rounded-2xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle className="text-xl flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              Add Payment Wallet
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-2">
              Add a new crypto wallet address for users to submit their payments.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6 px-1">
            <div className="grid gap-2.5">
              <Label className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <Network className="w-4 h-4 text-primary" />
                Network / Coin
              </Label>
              <input
                type="text"
                placeholder="e.g., Tether (TRC20), Bitcoin (BTC)"
                className="flex h-11 w-full rounded-xl border border-border/80 bg-slate-900 text-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                value={formData.network}
                onChange={(e) => setFormData({ ...formData, network: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2.5">
              <Label className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <Hash className="w-4 h-4 text-primary" />
                Wallet Address
              </Label>
              <input
                type="text"
                placeholder="Enter the exact wallet address"
                className="flex h-11 w-full rounded-xl border border-border/80 bg-slate-900 text-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm font-mono"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2.5">
              <Label className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <AlignLeft className="w-4 h-4 text-primary" />
                Description (Optional)
              </Label>
              <textarea
                placeholder="e.g., Only send USDT on TRON network. Other assets will be lost."
                className="flex min-h-[80px] w-full rounded-xl border border-border/80 bg-slate-900 text-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm resize-y"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.network || !formData.address || loading} className="rounded-xl px-6">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Wallet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}