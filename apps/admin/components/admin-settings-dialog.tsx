"use client";

import { useState } from "react";
import { Lock, Loader2, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AdminSettingsDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ oldPassword: "", newPassword: "" });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", ...formData }),
      });

      if (res.ok) {
        toast.success("Password updated successfully!", { description: "Please log in again." });
        await fetch("/api/admin/logout", { method: "POST" });
        window.location.href = "/admin-login";
      } else {
        const err = await res.json();
        toast.error(`Error: ${err.error}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center justify-center p-2.5 rounded-xl bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Admin Settings">
          <Lock className="w-5 h-5" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px] border-border bg-card shadow-2xl rounded-2xl">
        <DialogHeader className="pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-amber-500" /> Admin Security</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleChangePassword} className="py-4 space-y-4">
          <div className="grid gap-2">
            <Label>Current Password</Label>
            <input type="password" required className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm" value={formData.oldPassword} onChange={(e) => setFormData({ ...formData, oldPassword: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>New Password</Label>
            <input type="password" required className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm" value={formData.newPassword} onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })} />
          </div>

          <Button type="submit" className="w-full mt-2" disabled={loading || !formData.oldPassword || !formData.newPassword}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Update Password
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}