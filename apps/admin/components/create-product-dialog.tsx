"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Loader2, Plus, Tag, FileText, Layers, Image as ImageIcon, Upload, FileArchive } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useUploadLimits } from "@/lib/use-upload-limits";

interface ProductGroup {
  id: string;
  name: string;
}

export function CreateProductDialog({ groups }: { groups: ProductGroup[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [deliverableFile, setDeliverableFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deliverableInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { productImageMaxKb, productFileMaxMb } = useUploadLimits();
  const productImageMaxBytes = productImageMaxKb * 1024;
  const productFileMaxBytes = productFileMaxMb * 1024 * 1024;

  const [formData, setFormData] = useState({
    name: "",
    version: "1.0.0",
    description: "",
    groupId: "",
    image_url: "",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > productImageMaxBytes) {
      toast.error(`Image must be under ${productImageMaxKb}KB`);
      e.target.value = "";
      return;
    }
    setImageFile(file);
  };

  const handleDeliverableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > productFileMaxBytes) {
      toast.error(`File must be under ${productFileMaxMb}MB`);
      e.target.value = "";
      return;
    }
    setDeliverableFile(file);
  };

  const resetForm = () => {
    setFormData({ name: "", version: "1.0.0", description: "", groupId: "", image_url: "" });
    setImageFile(null);
    setDeliverableFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (deliverableInputRef.current) deliverableInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      setLoading(true);
      // A chosen file wins over a pasted URL - upload happens as a second
      // step once the product exists, since the upload endpoint needs a real id.
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, image_url: imageFile ? "" : formData.image_url }),
      });

      if (!res.ok) {
        toast.error("Failed to create product");
        return;
      }

      const created = await res.json();

      if (imageFile) {
        const uploadForm = new FormData();
        uploadForm.append("image", imageFile);
        uploadForm.append("id", created.id);
        const uploadRes = await fetch(`/api/products/${created.id}/image`, { method: "POST", body: uploadForm });
        if (!uploadRes.ok) {
          const error = await uploadRes.json().catch(() => ({}));
          toast.error(error.error || "Product created, but the image upload failed");
        }
      }

      if (deliverableFile) {
        const uploadForm = new FormData();
        uploadForm.append("file", deliverableFile);
        const uploadRes = await fetch(`/api/products/${created.id}/file`, { method: "POST", body: uploadForm });
        if (!uploadRes.ok) {
          const error = await uploadRes.json().catch(() => ({}));
          toast.error(error.error || "Product created, but the file upload failed");
        }
      }

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium hover:bg-primary/90 hover:-translate-y-0.5 transition-all shadow-sm text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px] border-border bg-card shadow-2xl rounded-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle className="text-xl flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Box className="w-5 h-5 text-primary" />
              </div>
              New FXCRUX Product
            </DialogTitle>
            <DialogDescription>Create a software product and set its initial version. Add purchase plans under Pricing Tiers.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-6">
            <div className="grid gap-2">
              <Label className="flex items-center gap-2 text-sm font-semibold"><Box className="w-4 h-4 text-primary"/> Product Name</Label>
              <input type="text" placeholder="e.g., Studio Exporter" className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2 text-sm font-semibold"><Tag className="w-4 h-4 text-primary"/> Version</Label>
              <input type="text" placeholder="1.0.0" className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50" value={formData.version} onChange={(e) => setFormData({ ...formData, version: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2 text-sm font-semibold"><FileText className="w-4 h-4 text-primary"/> Description</Label>
              <textarea placeholder="Brief description of the product..." className="min-h-[80px] w-full rounded-xl border border-border/80 bg-slate-900 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 resize-none" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2 text-sm font-semibold"><Layers className="w-4 h-4 text-primary"/> Category</Label>
              <select className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer" value={formData.groupId} onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}>
                <option value="">Uncategorized</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2 text-sm font-semibold"><ImageIcon className="w-4 h-4 text-primary"/> Header Image (optional)</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-11 px-4 rounded-xl border border-border/80 bg-slate-900 text-sm flex items-center gap-2 hover:border-primary/50 transition-colors shrink-0"
                >
                  <Upload className="w-4 h-4 text-primary" /> Upload
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
                {imageFile ? (
                  <span className="text-xs text-muted-foreground truncate">{imageFile.name}</span>
                ) : (
                  <input
                    type="text" placeholder="...or paste an image URL"
                    className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50"
                    value={formData.image_url} onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">Uploads are capped at {productImageMaxKb}KB.</p>
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2 text-sm font-semibold"><FileArchive className="w-4 h-4 text-primary"/> Downloadable File (optional)</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => deliverableInputRef.current?.click()}
                  className="h-11 px-4 rounded-xl border border-border/80 bg-slate-900 text-sm flex items-center gap-2 hover:border-primary/50 transition-colors shrink-0"
                >
                  <Upload className="w-4 h-4 text-primary" /> Upload
                </button>
                <input ref={deliverableInputRef} type="file" className="hidden" onChange={handleDeliverableChange} />
                {deliverableFile && <span className="text-xs text-muted-foreground truncate">{deliverableFile.name}</span>}
              </div>
              <p className="text-xs text-muted-foreground">Shown to users under Licenses once their license is active. Uploads are capped at {productFileMaxMb}MB.</p>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={!formData.name || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}