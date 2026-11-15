"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Layers, Plus, Loader2, Save, Edit2, Trash2, Users, Search,
  Image as ImageIcon, FileArchive, CheckCircle, Tag,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUploadLimits } from "@/lib/use-upload-limits";

interface Product {
  id: string;
  name: string;
  image_url: string | null;
}

interface Version {
  id: string;
  version: string;
  platform: string | null;
  description: string | null;
  icon_url: string | null;
  installer_original_name: string | null;
  access_mode: "ALL_USERS" | "SPECIFIC";
  is_active: boolean;
  created_at: string;
  specificUserCount: number;
}

interface AccessUser {
  id: string;
  username: string;
  email: string;
  hasAccess: boolean;
  currentVersionLabel: string | null;
}

export function ProductVersionsClient({ product, initialVersions }: { product: Product; initialVersions: Version[] }) {
  const router = useRouter();
  const { productImageMaxKb, productFileMaxMb } = useUploadLimits();
  const productImageMaxBytes = productImageMaxKb * 1024;
  const productFileMaxBytes = productFileMaxMb * 1024 * 1024;

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [newVersion, setNewVersion] = useState({ version: "", platform: "", description: "" });
  const [creatingVersion, setCreatingVersion] = useState(false);

  // Edit + uploads
  const [editingVersion, setEditingVersion] = useState<Version | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [uploadingInstaller, setUploadingInstaller] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  // Delete
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);

  // Access
  const [accessVersion, setAccessVersion] = useState<Version | null>(null);
  const [accessMode, setAccessMode] = useState<"ALL_USERS" | "SPECIFIC">("SPECIFIC");
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [loadingAccessUsers, setLoadingAccessUsers] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [confirmAllUsers, setConfirmAllUsers] = useState(false);

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingVersion(true);
    try {
      const res = await fetch(`/api/products/${product.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVersion),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Version created.");
        setShowCreate(false);
        setNewVersion({ version: "", platform: "", description: "" });
        router.refresh();
        setEditingVersion(data); // jump straight into editing so installer/icon can be attached
      } else {
        toast.error(data.error || "Failed to create version");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVersion) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/products/versions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingVersion.id,
          version: editingVersion.version,
          platform: editingVersion.platform,
          description: editingVersion.description,
        }),
      });
      if (res.ok) {
        toast.success("Version updated.");
        setEditingVersion(null);
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update version");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleInstallerUpload = async (file: File | null) => {
    if (!file || !editingVersion) return;
    if (file.size > productFileMaxBytes) {
      toast.error(`File must be under ${productFileMaxMb}MB`);
      return;
    }
    setUploadingInstaller(true);
    try {
      const form = new FormData();
      form.append("installer", file);
      const res = await fetch(`/api/products/versions/${editingVersion.id}/installer`, { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        setEditingVersion({ ...editingVersion, installer_original_name: data.installer_original_name });
        toast.success("Installer uploaded.");
      } else {
        toast.error(data.error || "Failed to upload installer");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setUploadingInstaller(false);
    }
  };

  const handleInstallerRemove = async () => {
    if (!editingVersion) return;
    setUploadingInstaller(true);
    try {
      const res = await fetch(`/api/products/versions/${editingVersion.id}/installer`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setEditingVersion({ ...editingVersion, installer_original_name: null });
        toast.success("Installer removed.");
      } else {
        toast.error(data.error || "Failed to remove installer");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setUploadingInstaller(false);
    }
  };

  const handleIconUpload = async (file: File | null) => {
    if (!file || !editingVersion) return;
    if (file.size > productImageMaxBytes) {
      toast.error(`Image must be under ${productImageMaxKb}KB`);
      return;
    }
    setUploadingIcon(true);
    try {
      const form = new FormData();
      form.append("icon", file);
      const res = await fetch(`/api/products/versions/${editingVersion.id}/icon`, { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        setEditingVersion({ ...editingVersion, icon_url: data.icon_url });
        toast.success("Icon uploaded.");
      } else {
        toast.error(data.error || "Failed to upload icon");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleIconRemove = async () => {
    if (!editingVersion) return;
    setUploadingIcon(true);
    try {
      const res = await fetch(`/api/products/versions/${editingVersion.id}/icon`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setEditingVersion({ ...editingVersion, icon_url: null });
        toast.success("Icon removed.");
      } else {
        toast.error(data.error || "Failed to remove icon");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleDeleteVersion = async () => {
    if (!deletingVersionId) return;
    try {
      const res = await fetch(`/api/products/versions/${deletingVersionId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Version deleted.");
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete version");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setDeletingVersionId(null);
    }
  };

  const openAccessDialog = async (version: Version) => {
    setAccessVersion(version);
    setAccessMode(version.access_mode);
    setUserSearchTerm("");
    setLoadingAccessUsers(true);
    try {
      const res = await fetch(`/api/products/versions/${version.id}/users`);
      setAccessUsers(res.ok ? await res.json() : []);
    } catch {
      setAccessUsers([]);
    } finally {
      setLoadingAccessUsers(false);
    }
  };

  const toggleAccessUser = (userId: string, checked: boolean) => {
    setAccessUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, hasAccess: checked } : u)));
  };

  const handleSaveSpecificAccess = async () => {
    if (!accessVersion) return;
    setSavingAccess(true);
    try {
      const userIds = accessUsers.filter((u) => u.hasAccess).map((u) => u.id);
      const res = await fetch(`/api/products/versions/${accessVersion.id}/assign-users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds }),
      });
      if (res.ok) {
        toast.success("Access updated.");
        setAccessVersion(null);
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update access");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSavingAccess(false);
    }
  };

  const handleSetAllUsers = async () => {
    if (!accessVersion) return;
    setSavingAccess(true);
    try {
      const res = await fetch(`/api/products/versions/${accessVersion.id}/set-all-users`, { method: "POST" });
      if (res.ok) {
        toast.success("Version set to All Users.");
        setAccessVersion(null);
        router.refresh();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update access");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSavingAccess(false);
    }
  };

  const filteredAccessUsers = accessUsers.filter(
    (u) => u.username.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()),
  );

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <Link href="/app-versions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to App Versions
        </Link>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border/50 shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0"><ImageIcon className="w-5 h-5 text-muted-foreground/50" /></div>
            )}
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">{product.name}</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="h-11 px-5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add Version
          </button>
        </div>
      </div>

      {initialVersions.length === 0 ? (
        <div className="bg-card border border-border/50 rounded-2xl p-16 text-center">
          <Layers className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No versions yet for this product.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {initialVersions.map((v) => (
            <div key={v.id} className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {v.icon_url ? (
                    <img src={v.icon_url} alt="" className="w-11 h-11 rounded-lg object-cover border border-border/50 shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0"><ImageIcon className="w-5 h-5 text-muted-foreground/50" /></div>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-base flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> {v.version}</div>
                    {v.platform && <div className="text-xs text-muted-foreground mt-0.5 truncate">{v.platform}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openAccessDialog(v)} className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Manage Access">
                    <Users className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingVersion(v)} className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit Version">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeletingVersionId(v.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors" title="Delete Version">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {v.description && <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{v.description}</p>}

              <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-border/50">
                {v.access_mode === "ALL_USERS" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <CheckCircle className="w-3.5 h-3.5" /> All Users
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    <Users className="w-3.5 h-3.5" /> {v.specificUserCount} specific user{v.specificUserCount === 1 ? "" : "s"}
                  </span>
                )}
                {v.installer_original_name ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/50">
                    <FileArchive className="w-3.5 h-3.5" /> Installer attached
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    No installer attached
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[440px] border-border bg-card shadow-2xl rounded-2xl">
          <form onSubmit={handleCreateVersion}>
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="text-xl flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg"><Plus className="w-5 h-5 text-primary" /></div>
                Add Version
              </DialogTitle>
              <DialogDescription>Create the version entry, then attach an installer and icon.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="grid gap-2">
                <Label className="text-sm font-semibold">Version</Label>
                <Input placeholder="e.g., 1.2.3" value={newVersion.version} onChange={(e) => setNewVersion({ ...newVersion, version: e.target.value })} required />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-semibold">Platform</Label>
                <Input placeholder="e.g., Linux x64, macOS, Windows x64" value={newVersion.platform} onChange={(e) => setNewVersion({ ...newVersion, platform: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-semibold">Description</Label>
                <textarea
                  className="min-h-[80px] w-full rounded-xl border border-border/80 bg-slate-900 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 resize-none"
                  value={newVersion.description} onChange={(e) => setNewVersion({ ...newVersion, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="pt-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)} disabled={creatingVersion}>Cancel</Button>
              <Button type="submit" disabled={!newVersion.version || creatingVersion}>
                {creatingVersion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingVersion} onOpenChange={(open) => !open && setEditingVersion(null)}>
        <DialogContent className="sm:max-w-[480px] border-border bg-card shadow-2xl rounded-2xl">
          <form onSubmit={handleSaveEdit}>
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="text-xl flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg"><Edit2 className="w-5 h-5 text-primary" /></div>
                Edit Version
              </DialogTitle>
              <DialogDescription>Update details, or attach/replace the installer and icon.</DialogDescription>
            </DialogHeader>
            {editingVersion && (
              <div className="grid gap-5 py-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold">Version</Label>
                    <input
                      type="text" className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50"
                      value={editingVersion.version} onChange={(e) => setEditingVersion({ ...editingVersion, version: e.target.value })} required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold">Platform</Label>
                    <input
                      type="text" className="h-11 w-full rounded-xl border border-border/80 bg-slate-900 px-3 text-sm focus:ring-2 focus:ring-primary/50"
                      value={editingVersion.platform || ""} onChange={(e) => setEditingVersion({ ...editingVersion, platform: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold">Description</Label>
                  <textarea
                    className="min-h-[80px] w-full rounded-xl border border-border/80 bg-slate-900 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 resize-none"
                    value={editingVersion.description || ""} onChange={(e) => setEditingVersion({ ...editingVersion, description: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold">Icon</Label>
                  <div className="flex items-center gap-2">
                    {editingVersion.icon_url ? (
                      <img src={editingVersion.icon_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border/50 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0"><ImageIcon className="w-4 h-4 text-muted-foreground/50" /></div>
                    )}
                    <label className="h-10 px-4 rounded-xl border border-border/80 bg-slate-900 text-sm flex items-center gap-2 hover:border-primary/50 transition-colors shrink-0 cursor-pointer">
                      {uploadingIcon ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : "Upload"}
                      <input
                        type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                        disabled={uploadingIcon} onChange={(e) => handleIconUpload(e.target.files?.[0] || null)}
                      />
                    </label>
                    {editingVersion.icon_url && (
                      <button type="button" onClick={handleIconRemove} disabled={uploadingIcon} className="h-10 w-10 flex items-center justify-center rounded-xl border border-border/80 bg-slate-900 text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0" title="Remove icon">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Uploads are capped at {productImageMaxKb}KB.</p>
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-semibold">Installer File</Label>
                  <div className="flex items-center gap-2">
                    {editingVersion.installer_original_name ? (
                      <span className="flex-1 h-10 flex items-center gap-2 px-3 rounded-xl border border-border/80 bg-slate-900 text-sm text-muted-foreground truncate">
                        <FileArchive className="w-4 h-4 text-primary shrink-0" /> {editingVersion.installer_original_name}
                      </span>
                    ) : (
                      <span className="flex-1 h-10 flex items-center px-3 rounded-xl border border-dashed border-border/80 text-sm text-muted-foreground italic">
                        No installer attached
                      </span>
                    )}
                    <label className="h-10 px-4 rounded-xl border border-border/80 bg-slate-900 text-sm flex items-center gap-2 hover:border-primary/50 transition-colors shrink-0 cursor-pointer">
                      {uploadingInstaller ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : "Replace"}
                      <input type="file" className="hidden" disabled={uploadingInstaller} onChange={(e) => handleInstallerUpload(e.target.files?.[0] || null)} />
                    </label>
                    {editingVersion.installer_original_name && (
                      <button type="button" onClick={handleInstallerRemove} disabled={uploadingInstaller} className="h-10 w-10 flex items-center justify-center rounded-xl border border-border/80 bg-slate-900 text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0" title="Remove installer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Uploads are capped at {productFileMaxMb}MB.</p>
                </div>
              </div>
            )}
            <DialogFooter className="pt-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setEditingVersion(null)} disabled={isSavingEdit}>Close</Button>
              <Button type="submit" disabled={!editingVersion?.version || isSavingEdit}>
                {isSavingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Access dialog */}
      <Dialog open={!!accessVersion} onOpenChange={(open) => !open && setAccessVersion(null)}>
        <DialogContent className="sm:max-w-[480px] border-border bg-card shadow-2xl rounded-2xl">
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle>Access — v{accessVersion?.version}</DialogTitle>
            <DialogDescription>Only one version of this product can be All Users, and a user can only have one active version at a time.</DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 p-1 bg-slate-900 rounded-xl border border-border/80 mt-4">
            <button
              type="button" onClick={() => setAccessMode("SPECIFIC")}
              className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-colors ${accessMode === "SPECIFIC" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Specific Users
            </button>
            <button
              type="button" onClick={() => setAccessMode("ALL_USERS")}
              className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-colors ${accessMode === "ALL_USERS" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              All Users
            </button>
          </div>

          {accessMode === "ALL_USERS" ? (
            <div className="py-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Every user with an active license for this product will resolve to this version. Any other version's All-Users flag and every individual access grant for this product will be cleared.
              </p>
              <Button
                type="button" className="w-full" disabled={savingAccess || accessVersion?.access_mode === "ALL_USERS"}
                onClick={() => setConfirmAllUsers(true)}
              >
                {savingAccess ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                {accessVersion?.access_mode === "ALL_USERS" ? "Already set to All Users" : "Set to All Users"}
              </Button>
            </div>
          ) : (
            <>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text" placeholder="Search users..."
                  className="w-full h-10 pl-10 pr-3 rounded-xl border border-border/80 bg-background text-sm"
                  value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)}
                />
              </div>
              <div className="py-3 max-h-[40vh] overflow-y-auto space-y-2">
                {loadingAccessUsers ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                ) : filteredAccessUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No users found.</p>
                ) : (
                  filteredAccessUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-2.5 text-sm p-2.5 rounded-lg border border-border/80 bg-slate-900 cursor-pointer">
                      <input type="checkbox" checked={u.hasAccess} onChange={(e) => toggleAccessUser(u.id, e.target.checked)} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{u.username}</div>
                        {u.currentVersionLabel && !u.hasAccess && (
                          <div className="text-xs text-amber-500 truncate">Currently on v{u.currentVersionLabel} — will move to v{accessVersion?.version}</div>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>
              <DialogFooter className="pt-4 border-t border-border/50">
                <Button type="button" variant="ghost" onClick={() => setAccessVersion(null)} disabled={savingAccess}>Cancel</Button>
                <Button type="button" onClick={handleSaveSpecificAccess} disabled={savingAccess || loadingAccessUsers}>
                  {savingAccess && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Access
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmAllUsers}
        onOpenChange={setConfirmAllUsers}
        title="Set to All Users?"
        description={`This clears any other version's All-Users flag and every individual access grant for ${product.name}, so every licensed user resolves to v${accessVersion?.version}.`}
        confirmLabel="Set to All Users"
        destructive={false}
        onConfirm={handleSetAllUsers}
      />

      <ConfirmDialog
        open={!!deletingVersionId}
        onOpenChange={(o) => !o && setDeletingVersionId(null)}
        title="Delete Version"
        description="Removes this version and every user's access to it. The installer and icon files are deleted from the server."
        confirmLabel="Delete"
        onConfirm={handleDeleteVersion}
      />
    </div>
  );
}
