"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, ImageIcon, Paperclip, FileArchive, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface SystemSettings {
  product_image_max_kb: number;
  ticket_attachment_max_kb: number;
  product_file_max_mb: number;
}

export function SettingsClient({ initialSettings }: { initialSettings: SystemSettings | null }) {
  const router = useRouter();
  const [productImageMaxKb, setProductImageMaxKb] = useState(initialSettings?.product_image_max_kb ?? 100);
  const [ticketAttachmentMaxKb, setTicketAttachmentMaxKb] = useState(initialSettings?.ticket_attachment_max_kb ?? 250);
  const [productFileMaxMb, setProductFileMaxMb] = useState(initialSettings?.product_file_max_mb ?? 50);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_image_max_kb: productImageMaxKb,
          ticket_attachment_max_kb: ticketAttachmentMaxKb,
          product_file_max_mb: productFileMaxMb,
        }),
      });
      if (res.ok) {
        toast.success("Settings saved.");
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save settings");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          System Settings
        </h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">
          Super-admin-only system-wide configuration.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-card border border-border/50 rounded-2xl p-6 space-y-6 shadow-sm">
        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" /> Product Image Max Size (KB)
          </Label>
          <input
            type="number" min="1" required
            className="h-11 w-full max-w-xs rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50"
            value={productImageMaxKb}
            onChange={(e) => setProductImageMaxKb(parseInt(e.target.value) || 1)}
          />
          <p className="text-xs text-muted-foreground">Maximum upload size for product header images shown in the store.</p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-primary" /> Ticket Attachment Max Size (KB)
          </Label>
          <input
            type="number" min="1" required
            className="h-11 w-full max-w-xs rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50"
            value={ticketAttachmentMaxKb}
            onChange={(e) => setTicketAttachmentMaxKb(parseInt(e.target.value) || 1)}
          />
          <p className="text-xs text-muted-foreground">Maximum upload size for images attached to support tickets, by users and admins.</p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <FileArchive className="w-4 h-4 text-primary" /> Product File Max Size (MB)
          </Label>
          <input
            type="number" min="1" required
            className="h-11 w-full max-w-xs rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50"
            value={productFileMaxMb}
            onChange={(e) => setProductFileMaxMb(parseInt(e.target.value) || 1)}
          />
          <p className="text-xs text-muted-foreground">Maximum upload size for the downloadable deliverable attached to a product.</p>
        </div>

        <div className="pt-2 border-t border-border/50 flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
