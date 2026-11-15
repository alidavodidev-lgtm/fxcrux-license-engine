"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, CheckCircle2, Clock, Star, User, FolderInput, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { usePolling } from "@/hooks/usePolling";
import { useUploadLimits } from "@/lib/use-upload-limits";

interface Message {
  id: string;
  sender_type: "USER" | "ADMIN";
  sender_name: string;
  message: string;
  image_url: string | null;
  created_at: string;
}

interface TicketGroup {
  id: string;
  name: string;
}

interface TicketDetail {
  id: string;
  subject: string;
  status: "OPEN" | "CLOSED";
  rating: number | null;
  user: { username: string };
  group: { id: string; name: string };
}

export function TicketThreadClient({ ticketId, groups }: { ticketId: string; groups: TicketGroup[] }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { ticketAttachmentMaxKb } = useUploadLimits();
  const ticketAttachmentMaxBytes = ticketAttachmentMaxKb * 1024;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > ticketAttachmentMaxBytes) {
      toast.error(`Image must be under ${ticketAttachmentMaxKb}KB`);
      e.target.value = "";
      return;
    }
    setImageFile(file);
  };

  const load = useCallback(() => {
    fetch("/api/tickets/thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId }),
    }).then((r) => r.json()).then((data) => {
      if (data.ticket) {
        setTicket(data.ticket);
        setMessages(data.messages || []);
      } else {
        toast.error(data.error || "Failed to load ticket");
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);
  usePolling(load, 8000);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const uploadForm = new FormData();
        uploadForm.append("image", imageFile);
        const uploadRes = await fetch("/api/tickets/upload", { method: "POST", body: uploadForm });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          toast.error(uploadData.error || "Failed to upload image");
          setSending(false);
          return;
        }
        imageUrl = uploadData.url;
      }

      const res = await fetch("/api/tickets/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, message: reply, imageUrl }),
      });
      if (res.ok) {
        setReply("");
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        load();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to send reply");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSending(false);
    }
  };

  const handleReassign = async (groupId: string) => {
    if (!ticket || groupId === ticket.group.id) return;
    setReassigning(true);
    try {
      const res = await fetch("/api/tickets/reassign-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, groupId }),
      });
      if (res.ok) {
        toast.success("Ticket moved to the new category.");
        load();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to move ticket");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setReassigning(false);
    }
  };

  const handleClose = async () => {
    try {
      const res = await fetch("/api/tickets/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      if (res.ok) {
        toast.success("Ticket closed.");
        load();
      } else {
        toast.error("Failed to close ticket.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  if (loading) {
    return <div className="p-6 md:p-10 max-w-3xl mx-auto"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (!ticket) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        <p className="text-muted-foreground">Ticket not found, or you don't have access to its category.</p>
        <Link href="/tickets" className="text-primary hover:underline">Back to tickets</Link>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Link href="/tickets" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to tickets
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="relative inline-flex items-center">
              <FolderInput className="absolute left-2 w-3 h-3 text-primary pointer-events-none" />
              <select
                value={ticket.group?.id}
                disabled={reassigning}
                onChange={(e) => handleReassign(e.target.value)}
                className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 pl-6 pr-2 py-0.5 rounded-full appearance-none cursor-pointer disabled:opacity-50"
                title="Move this ticket to a different category"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id} className="bg-slate-900 text-slate-50 normal-case">{g.name}</option>
                ))}
              </select>
            </div>
            {ticket.status === 'OPEN' ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> Open</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground bg-muted border border-border/50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Closed</span>
            )}
            {ticket.rating && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                <Star className="w-3 h-3 fill-amber-500" /> Rated {ticket.rating}/5
              </span>
            )}
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{ticket.subject}</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {ticket.user?.username}</p>
        </div>
        {ticket.status === 'OPEN' && (
          <button onClick={() => setConfirmClose(true)} className="h-10 px-4 bg-card border border-border/50 text-foreground hover:bg-muted rounded-xl text-sm font-semibold transition-colors">
            Close Ticket
          </button>
        )}
      </div>

      <div className="space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_type === 'ADMIN' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-4 ${m.sender_type === 'ADMIN' ? 'bg-primary/10 border border-primary/20' : 'bg-card border border-border/50'}`}>
              <div className="flex items-center gap-1.5 mb-1.5 text-xs font-bold text-muted-foreground">
                {m.sender_name}
                <span className="font-normal" suppressHydrationWarning>· {new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{m.message}</p>
              {m.image_url && (
                <a href={m.image_url} target="_blank" rel="noopener noreferrer" className="block mt-2">
                  <img src={m.image_url} alt="Attachment" className="max-w-full max-h-64 rounded-lg border border-border/50" />
                </a>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {ticket.status === 'OPEN' ? (
        <div className="sticky bottom-4 space-y-2">
          {imageFile && (
            <div className="flex items-center gap-2 bg-card border border-border/50 rounded-xl px-3 py-2 text-xs text-muted-foreground">
              <Paperclip className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate flex-1">{imageFile.name}</span>
              <button type="button" onClick={() => { setImageFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <form onSubmit={handleReply} className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-[52px] px-4 bg-card border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/50 rounded-xl transition-colors shrink-0"
              title={`Attach image (max ${ticketAttachmentMaxKb}KB)`}
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
            <textarea
              className="flex-1 min-h-[52px] max-h-40 px-4 py-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder="Type your reply..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(e); } }}
            />
            <button type="submit" disabled={sending || !reply.trim()} className="h-[52px] px-5 bg-primary text-primary-foreground font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center shrink-0">
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
        </div>
      ) : (
        <div className="text-center text-sm text-muted-foreground py-4 border-t border-border/50">This ticket is closed.</div>
      )}

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Close Ticket"
        description="The user won't be able to reply unless they reopen it by sending a new message."
        confirmLabel="Close Ticket"
        destructive={false}
        onConfirm={handleClose}
      />
    </div>
  );
}
