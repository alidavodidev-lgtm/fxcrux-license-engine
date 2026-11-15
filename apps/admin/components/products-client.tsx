"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Search, RefreshCw, DollarSign, Tag, CheckCircle, XCircle, Edit2, Loader2, Save, CalendarClock, Layers, Image as ImageIcon, Plus, FileArchive, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { CreateProductDialog } from "@/components/create-product-dialog";
import { ManageTiersDialog } from "@/components/manage-tiers-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePolling } from "@/hooks/usePolling";
import { useUploadLimits } from "@/lib/use-upload-limits";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableTh } from "@/components/ui/sortable-th";

interface ProductGroup {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

export function ProductsClient({ initialProducts, groups }: { initialProducts: any[]; groups: ProductGroup[] }) {
  const router = useRouter();
  usePolling(() => router.refresh(), 30000);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [togglingGroupId, setTogglingGroupId] = useState<string | null>(null);

  // States for Edit Modal
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // State for Tiers Modal — store only the id so the dialog always reflects
  // fresh data from initialProducts after router.refresh() (e.g. after adding a tier)
  const [tiersProductId, setTiersProductId] = useState<string | null>(null);
  const tiersProduct = initialProducts.find((p) => p.id === tiersProductId) || null;
  const { productImageMaxKb, productFileMaxMb } = useUploadLimits();
  const productImageMaxBytes = productImageMaxKb * 1024;
  const productFileMaxBytes = productFileMaxMb * 1024 * 1024;

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleImageUpload = async (file: File | null) => {
    if (!file || !editingProduct) return;
    if (file.size > productImageMaxBytes) {
      toast.error(`Image must be under ${productImageMaxKb}KB`);
      return;
    }
    setUploadingImage(true);
    try {
      const uploadForm = new FormData();
      uploadForm.append("image", file);
      const res = await fetch(`/api/products/${editingProduct.id}/image`, { method: "POST", body: uploadForm });
      const data = await res.json();
      if (res.ok) {
        setEditingProduct({ ...editingProduct, image_url: data.image_url });
        toast.success("Image uploaded.");
      } else {
        toast.error(data.error || "Failed to upload image");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file || !editingProduct) return;
    if (file.size > productFileMaxBytes) {
      toast.error(`File must be under ${productFileMaxMb}MB`);
      return;
    }
    setUploadingFile(true);
    try {
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const res = await fetch(`/api/products/${editingProduct.id}/file`, { method: "POST", body: uploadForm });
      const data = await res.json();
      if (res.ok) {
        setEditingProduct({ ...editingProduct, file_original_name: data.file_original_name });
        toast.success("File uploaded.");
      } else {
        toast.error(data.error || "Failed to upload file");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileRemove = async () => {
    if (!editingProduct) return;
    setUploadingFile(true);
    try {
      const res = await fetch(`/api/products/${editingProduct.id}/file`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setEditingProduct({ ...editingProduct, file_original_name: null });
        toast.success("File removed.");
      } else {
        toast.error(data.error || "Failed to remove file");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/products/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingProduct.id,
          name: editingProduct.name,
          version: editingProduct.version,
          price: parseFloat(editingProduct.price) || 0,
          description: editingProduct.description,
          is_active: editingProduct.is_active,
          groupId: editingProduct.group?.id || "",
          image_url: editingProduct.image_url || "",
        }),
      });

      if (res.ok) {
        setEditingProduct(null);
        handleRefresh();
      } else {
        const error = await res.json();
        toast.error(`Failed to update: ${error.error}`);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingGroup(true);
    try {
      const res = await fetch("/api/products/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGroup),
      });
      if (res.ok) {
        toast.success("Category created.");
        setNewGroup({ name: "", description: "" });
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create category");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleToggleGroup = async (groupId: string) => {
    setTogglingGroupId(groupId);
    try {
      const res = await fetch("/api/products/groups/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setTogglingGroupId(null);
    }
  };

  const filteredProducts = initialProducts.filter((product) =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { sorted: sortedProducts, sortKey, sortDir, requestSort } = useSortableData(
    filteredProducts,
    (product, key) => {
      if (key === "price") return Number(product.price) || 0;
      return product[key];
    },
  );

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Box className="w-8 h-8 text-primary" />
            Products
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Manage your software catalog, versions, and pricing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} className="bg-card border border-border/50 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm hover:bg-muted transition-all">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => setShowGroups(true)} className="bg-card border border-border/50 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm hover:bg-muted transition-all">
            <Layers className="w-4 h-4" /> Categories
          </button>
          <CreateProductDialog groups={groups.filter((g) => g.is_active)} />
        </div>
      </div>

      {/* Search */}
      <div className="flex bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search products..." className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
              <tr>
                <SortableTh label="Product Info" sortKey="name" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <SortableTh label="Version" sortKey="version" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <SortableTh label="Price (USDT)" sortKey="price" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <SortableTh label="Status" sortKey="is_active" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedProducts.map((product: any) => (
                <tr key={product.id} className="hover:bg-muted/10 group transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border/50 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0"><ImageIcon className="w-4 h-4 text-muted-foreground/50" /></div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-base">{product.name}</div>
                        <div className="text-xs text-muted-foreground mt-1 truncate max-w-xs" title={product.description}>
                          {product.description || 'No description provided'}
                        </div>
                        {product.group && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full mt-1">
                            <Layers className="w-2.5 h-2.5" /> {product.group.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-muted-foreground"/> {product.version || '1.0.0'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 font-bold text-emerald-500"><DollarSign className="w-4 h-4"/> {product.price}</span>
                  </td>
                  <td className="px-6 py-4">
                    {product.is_active ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <CheckCircle className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/50">
                        <XCircle className="w-3.5 h-3.5" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setTiersProductId(product.id)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Manage Pricing Tiers"
                    >
                      <CalendarClock className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingProduct({ ...product })}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Edit Product"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile/tablet card list */}
      <div className="md:hidden space-y-3">
        {sortedProducts.map((product: any) => (
          <div key={product.id} className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-3 min-w-0">
                {product.image_url ? (
                  <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border/50 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0"><ImageIcon className="w-4 h-4 text-muted-foreground/50" /></div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-base truncate">{product.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 truncate" title={product.description}>
                    {product.description || 'No description provided'}
                  </div>
                  {product.group && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full mt-1">
                      <Layers className="w-2.5 h-2.5" /> {product.group.name}
                    </span>
                  )}
                </div>
              </div>
              {product.is_active ? (
                <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <CheckCircle className="w-3.5 h-3.5" /> Active
                </span>
              ) : (
                <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/50">
                  <XCircle className="w-3.5 h-3.5" /> Inactive
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm border-t border-border/50 pt-2.5 mb-3">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Tag className="w-3.5 h-3.5"/> {product.version || '1.0.0'}</span>
              <span className="flex items-center gap-1.5 font-bold text-emerald-500"><DollarSign className="w-4 h-4"/> {product.price}</span>
            </div>

            <div className="flex items-center gap-2 border-t border-border/50 pt-3">
              <button onClick={() => setTiersProductId(product.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-primary bg-primary/10 rounded-lg">
                <CalendarClock className="w-3.5 h-3.5" /> Pricing Tiers
              </button>
              <button onClick={() => setEditingProduct({ ...product })} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-primary bg-primary/10 rounded-lg">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="sm:max-w-[480px] border-border bg-card shadow-2xl rounded-2xl">
          <form onSubmit={handleUpdateProduct}>
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="text-xl flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Edit2 className="w-5 h-5 text-primary" />
                </div>
                Edit Product
              </DialogTitle>
              <DialogDescription>Update the details, pricing, or status of this product.</DialogDescription>
            </DialogHeader>

            {editingProduct && (
              <div className="grid gap-5 py-6">
                <div className="grid gap-2">
                  <Label className="text-sm font-semibold">Product Name</Label>
                  <input type="text" className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50"
                    value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold">Version</Label>
                    <input type="text" className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50"
                      value={editingProduct.version} onChange={(e) => setEditingProduct({ ...editingProduct, version: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold">Price (USDT)</Label>
                    <input type="number" min="0" step="0.01" className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50"
                      value={editingProduct.price} onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold">Description</Label>
                  <textarea className="min-h-[80px] w-full rounded-xl border border-border/80 bg-slate-900 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 resize-none"
                    value={editingProduct.description || ""} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })} />
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold">Category</Label>
                  <select
                    className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
                    value={editingProduct.group?.id || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, group: e.target.value ? { id: e.target.value } : null })}
                  >
                    <option value="">Uncategorized</option>
                    {groups.filter((g) => g.is_active || g.id === editingProduct.group?.id).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold">Header Image</Label>
                  <div className="flex items-center gap-2">
                    <Input placeholder="https://... (leave blank for no image)" value={editingProduct.image_url || ""} onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })} />
                    <label className="h-10 px-4 rounded-xl border border-border/80 bg-slate-900 text-sm flex items-center gap-2 hover:border-primary/50 transition-colors shrink-0 cursor-pointer">
                      {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : "Upload"}
                      <input
                        type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                        disabled={uploadingImage}
                        onChange={(e) => handleImageUpload(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">Uploads are capped at {productImageMaxKb}KB.</p>
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold">Downloadable File</Label>
                  <div className="flex items-center gap-2">
                    {editingProduct.file_original_name ? (
                      <span className="flex-1 h-10 flex items-center gap-2 px-3 rounded-xl border border-border/80 bg-slate-900 text-sm text-muted-foreground truncate">
                        <FileArchive className="w-4 h-4 text-primary shrink-0" /> {editingProduct.file_original_name}
                      </span>
                    ) : (
                      <span className="flex-1 h-10 flex items-center px-3 rounded-xl border border-dashed border-border/80 text-sm text-muted-foreground italic">
                        No file attached
                      </span>
                    )}
                    <label className="h-10 px-4 rounded-xl border border-border/80 bg-slate-900 text-sm flex items-center gap-2 hover:border-primary/50 transition-colors shrink-0 cursor-pointer">
                      {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : "Replace"}
                      <input
                        type="file" className="hidden"
                        disabled={uploadingFile}
                        onChange={(e) => handleFileUpload(e.target.files?.[0] || null)}
                      />
                    </label>
                    {editingProduct.file_original_name && (
                      <button
                        type="button"
                        onClick={handleFileRemove}
                        disabled={uploadingFile}
                        className="h-10 w-10 flex items-center justify-center rounded-xl border border-border/80 bg-slate-900 text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Shown to users under Licenses once their license is active. Uploads are capped at {productFileMaxMb}MB.</p>
                </div>

                {/* Status Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-border/80 bg-slate-900">
                  <div>
                    <Label className="text-sm font-semibold text-foreground">Active Status</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Allow users to purchase this product</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer"
                      checked={editingProduct.is_active}
                      onChange={(e) => setEditingProduct({ ...editingProduct, is_active: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setEditingProduct(null)} disabled={isSaving}>Cancel</Button>
              <Button type="submit" disabled={!editingProduct?.name || isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ManageTiersDialog
        product={tiersProduct}
        open={!!tiersProductId}
        onOpenChange={(open) => !open && setTiersProductId(null)}
      />

      <Dialog open={showGroups} onOpenChange={setShowGroups}>
        <DialogContent className="sm:max-w-[520px] border-border bg-card shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Product Categories</DialogTitle>
            <DialogDescription>Group products so customers can filter the store by category.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4 max-h-[40vh] overflow-y-auto">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No categories yet - add one below.</p>
            ) : (
              groups.map((g) => (
                <div key={g.id} className="flex items-center justify-between p-3 rounded-xl border border-border/80 bg-slate-900">
                  <div>
                    <div className="font-semibold text-sm">{g.name}</div>
                    {g.description && <div className="text-xs text-muted-foreground mt-0.5">{g.description}</div>}
                  </div>
                  {togglingGroupId === g.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : (
                    <button
                      onClick={() => handleToggleGroup(g.id)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border ${g.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border/50'}`}
                    >
                      {g.is_active ? 'Active' : 'Disabled'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleCreateGroup} className="space-y-3 pt-4 border-t border-border/50">
            <Label className="text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> New Category</Label>
            <Input placeholder="e.g., Developer Tools, Creative Tools" value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} required />
            <Input placeholder="Short description (optional)" value={newGroup.description} onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })} />
            <DialogFooter className="pt-2">
              <Button type="submit" disabled={!newGroup.name || creatingGroup}>
                {creatingGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}