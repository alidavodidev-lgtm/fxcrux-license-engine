"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LifeBuoy, Plus, MessageCircle, CheckCircle2, Clock, Loader2, X, Paperclip, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/Skeleton";
import { usePolling } from "@/hooks/usePolling";
import { useUploadLimits } from "@/hooks/useUploadLimits";

interface TicketGroup {
  id: string;
  name: string;
  description: string;
}

interface TicketRow {
  id: string;
  subject: string;
  status: "OPEN" | "CLOSED";
  rating: number | null;
  updated_at: string;
  group: TicketGroup;
  lastResponderAdmin: { id: string; username: string } | null;
}

const TICKETS_PER_PAGE = 20;

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [groups, setGroups] = useState<TicketGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ groupId: "", subject: "", message: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { ticketAttachmentMaxKb } = useUploadLimits();
  const ticketAttachmentMaxBytes = ticketAttachmentMaxKb * 1024;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [adminFilter, setAdminFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > ticketAttachmentMaxBytes) {
      toast.error(`Image must be under ${ticketAttachmentMaxKb}KB`);
      e.target.value = "";
      return;
    }
    setImageFile(file);
  };

  const loadTickets = useCallback(() => {
    Promise.all([
      fetch("/api/tickets").then((r) => r.json()),
      fetch("/api/tickets/groups").then((r) => r.json()),
    ]).then(([t, g]) => {
      setTickets(Array.isArray(t) ? t : []);
      setGroups(Array.isArray(g) ? g : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);
  usePolling(loadTickets, 15000);

  const adminOptions = useMemo(() => {
    const names = new Set<string>();
    tickets.forEach((t) => { if (t.lastResponderAdmin) names.add(t.lastResponderAdmin.username); });
    return Array.from(names).sort();
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesSearch = t.subject.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
      const matchesAdmin = adminFilter === "ALL" || t.lastResponderAdmin?.username === adminFilter;
      return matchesSearch && matchesStatus && matchesAdmin;
    });
  }, [tickets, searchTerm, statusFilter, adminFilter]);

  useEffect(() => { setPage(1); }, [searchTerm, statusFilter, adminFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / TICKETS_PER_PAGE));
  const pagedTickets = filteredTickets.slice((page - 1) * TICKETS_PER_PAGE, page * TICKETS_PER_PAGE);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const uploadForm = new FormData();
        uploadForm.append("image", imageFile);
        const uploadRes = await fetch("/api/tickets/upload", { method: "POST", body: uploadForm });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          toast.error(uploadData.error || "Failed to upload image");
          setCreating(false);
          return;
        }
        imageUrl = uploadData.url;
      }

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, imageUrl }),
      });
      if (res.ok) {
        toast.success("Ticket created.");
        setShowNew(false);
        setForm({ groupId: "", subject: "", message: "" });
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        const t = await fetch("/api/tickets").then((r) => r.json());
        setTickets(Array.isArray(t) ? t : []);
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create ticket");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8 min-h-screen">
        <Skeleton className="h-10 w-56" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto animate-fade-in-up space-y-8 min-h-screen">
      <div className="flex items-center justify-between pb-6 border-b border-black-border flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gold/10 border border-gold/20 rounded-2xl flex items-center justify-center text-gold"><LifeBuoy className="w-7 h-7" /></div>
          <div><h1 className="font-display text-3xl font-black text-white tracking-tight">Support</h1><p className="text-sm text-gray-400">Ask a question, we'll get back to you.</p></div>
        </div>
        <button onClick={() => setShowNew(true)} className="h-11 px-5 bg-gold text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-black-light/50 border border-black-border border-dashed p-16 rounded-2xl flex flex-col items-center justify-center text-center">
          <MessageCircle className="w-12 h-12 text-gray-600 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Tickets Yet</h3>
          <p className="text-gray-400">Need help? Open a ticket and we'll respond soon.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text" placeholder="Search by subject..."
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-black-border bg-black-light text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-gold/60"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative w-full md:w-44">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-black-border bg-black-light text-white text-sm appearance-none cursor-pointer"
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div className="relative w-full md:w-48">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-black-border bg-black-light text-white text-sm appearance-none cursor-pointer"
                value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)}
              >
                <option value="ALL">All Responders</option>
                {adminOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="bg-black-light/50 border border-black-border border-dashed p-16 rounded-2xl flex flex-col items-center justify-center text-center">
              <MessageCircle className="w-12 h-12 text-gray-600 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Matching Tickets</h3>
              <p className="text-gray-400">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pagedTickets.map((t) => (
                <Link key={t.id} href={`/tickets/${t.id}`} className="block bg-black-light border border-black-border rounded-2xl p-5 hover:border-gold/30 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">{t.group?.name}</span>
                        {t.status === 'OPEN' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> Open</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Closed</span>
                        )}
                      </div>
                      <h3 className="text-white font-bold truncate">{t.subject}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{t.lastResponderAdmin ? `Responded by ${t.lastResponderAdmin.username}` : "Awaiting response"}</p>
                    </div>
                    <div className="text-xs text-gray-500 shrink-0" suppressHydrationWarning>{new Date(t.updated_at).toLocaleDateString()}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {filteredTickets.length > TICKETS_PER_PAGE && (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-gray-500">{filteredTickets.length} ticket{filteredTickets.length === 1 ? '' : 's'} total</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-black-border text-gray-400 hover:bg-black-light disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-black-border text-gray-400 hover:bg-black-light disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showNew && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-black-light border border-black-border rounded-2xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">New Ticket</h3>
              <button onClick={() => setShowNew(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Category</label>
                <select
                  className="w-full h-12 px-4 rounded-xl border border-black-border bg-black text-white focus:outline-none focus:border-gold/60"
                  value={form.groupId}
                  onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                  required
                >
                  <option value="" disabled>Select a category...</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Subject</label>
                <input
                  type="text"
                  className="w-full h-12 px-4 rounded-xl border border-black-border bg-black text-white placeholder:text-gray-600 focus:outline-none focus:border-gold/60"
                  placeholder="Brief summary of your question"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Message</label>
                <textarea
                  className="w-full min-h-[120px] px-4 py-3 rounded-xl border border-black-border bg-black text-white placeholder:text-gray-600 focus:outline-none focus:border-gold/60 resize-none"
                  placeholder="Describe what you need help with..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Attach Image (optional)</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-11 px-4 rounded-xl border border-black-border bg-black text-gray-300 hover:border-gold/50 hover:text-gold transition-colors flex items-center gap-2 shrink-0"
                  >
                    <Paperclip className="w-4 h-4" /> Attach
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
                  {imageFile && <span className="text-xs text-gray-400 truncate">{imageFile.name}</span>}
                </div>
                <p className="text-[11px] text-gray-500">Max {ticketAttachmentMaxKb}KB. Images are deleted automatically 5 days after the ticket is closed.</p>
              </div>
              <button type="submit" disabled={creating || !form.groupId} className="w-full h-12 bg-gold text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {creating && <Loader2 className="w-5 h-5 animate-spin" />} Submit Ticket
              </button>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
