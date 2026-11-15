"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Key, Loader2, CalendarClock, UserCheck, Box } from "lucide-react";
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

export function IssueLicenseDialog({ users = [], products = [] }: { users: any[], products: any[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    userId: "",
    productId: "",
    durationDays: "30",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userId || !formData.productId) return;

    try {
      setLoading(true);

      const payload = {
        userId: formData.userId,
        productId: formData.productId,
        daysValid: parseInt(formData.durationDays),
      };

      const res = await fetch("/api/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setOpen(false);
        setFormData({ userId: "", productId: "", durationDays: "30" });
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to issue license");
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
        <button className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-medium hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 shadow-sm text-sm flex items-center gap-2">
          <Key className="w-4 h-4" />
          Issue New License
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px] border-border bg-card text-card-foreground shadow-2xl rounded-2xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle className="text-xl flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Key className="w-5 h-5 text-primary" />
              </div>
              Issue License
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-2">
              Select a customer and a product to issue a license key.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6 px-1">

            <div className="grid gap-2.5">
              <Label className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <UserCheck className="w-4 h-4 text-primary" />
                Select Customer
              </Label>
              <select
                className="flex h-11 w-full rounded-xl border border-border/80 bg-slate-900 text-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                required
              >
                <option value="" disabled className="bg-slate-900 text-slate-50">-- Choose a registered user --</option>
                {users.map((user: any) => (
                  <option key={user.id} value={user.id} className="bg-slate-900 text-slate-50">{user.username}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-2.5">
              <Label className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <Box className="w-4 h-4 text-primary" />
                Select Product
              </Label>
              <select
                className="flex h-11 w-full rounded-xl border border-border/80 bg-slate-900 text-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                required
              >
                <option value="" disabled className="bg-slate-900 text-slate-50">Choose a product</option>
                {products.map((product: any) => (
                  <option key={product.id} value={product.id} className="bg-slate-900 text-slate-50">{product.name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-2.5 bg-muted/40 p-4 rounded-xl border border-border/50">
              <Label className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="w-4 h-4 text-primary" />
                Validity Period
              </Label>
              <select
                className="flex h-11 w-full rounded-lg border border-border/80 bg-slate-900 text-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                value={formData.durationDays}
                onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
                required
              >
                <option value="7" className="bg-slate-900 text-slate-50">7 Days (Trial/Demo)</option>
                <option value="30" className="bg-slate-900 text-slate-50">1 Month (Standard)</option>
                <option value="90" className="bg-slate-900 text-slate-50">3 Months</option>
                <option value="180" className="bg-slate-900 text-slate-50">6 Months</option>
                <option value="365" className="bg-slate-900 text-slate-50">1 Year</option>
                <option value="36500" className="bg-slate-900 text-slate-50">Lifetime (No Expiry)</option>
              </select>
            </div>

          </div>

          <DialogFooter className="pt-4 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.userId || !formData.productId || loading} className="rounded-xl px-6">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Secure Key
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}