"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, CheckCircle2, Clock, Star, ShieldCheck, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/Skeleton";
import { usePolling } from "@/hooks/usePolling";
import { useUploadLimits } from "@/hooks/useUploadLimits";

interface Message {
  id: string;
  sender_type: "USER" | "ADMIN";
  sender_name: string;
  message: string;
  image_url: string | null;
  created_at: string;
}

interface TicketDetail {
  id: string;
  subject: string;
  status: "OPEN" | "CLOSED";
  rating: number | null;
  group: { name: string };
}

export default function TicketThreadPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
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

  const handleClose = async (withRating: boolean) => {
    try {
      const res = await fetch("/api/tickets/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withRating ? { ticketId, rating } : { ticketId }),
      });
      if (res.ok) {
        toast.success("Ticket closed.");
        setShowRating(false);
        load();
      } else {
        toast.error("Failed to close ticket.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6 min-h-screen">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto min-h-screen">
        <p className="text-gray-400">Ticket not found.</p>
        <Link href="/tickets" className="text-gold hover:text-gold-light">Back to tickets</Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto animate-fade-in-up space-y-6 min-h-screen">
      <Link href="/tickets" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to tickets
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">{ticket.group?.name}</span>
            {ticket.status === 'OPEN' ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> Open</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Closed</span>
            )}
          </div>
          <h1 className="font-display text-2xl font-bold text-white">{ticket.subject}</h1>
        </div>
        {ticket.status === 'OPEN' && (
          <button onClick={() => setShowRating(true)} className="h-10 px-4 bg-black-light border border-black-border text-gray-300 hover:text-white rounded-xl text-sm font-semibold transition-colors">
            Close Ticket
          </button>
        )}
        {ticket.status === 'CLOSED' && ticket.rating && (
          <div className="flex items-center gap-1 text-gold">
            {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-4 h-4 ${i < ticket.rating! ? 'fill-gold' : ''}`} />)}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_type === 'USER' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-4 ${m.sender_type === 'USER' ? 'bg-gold/10 border border-gold/20' : 'bg-black-light border border-black-border'}`}>
              <div className="flex items-center gap-1.5 mb-1.5 text-xs font-bold text-gray-400">
                {m.sender_type === 'ADMIN' && <ShieldCheck className="w-3.5 h-3.5 text-gold" />}
                {m.sender_name}
                <span className="font-normal text-gray-600" suppressHydrationWarning>· {new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-white whitespace-pre-wrap">{m.message}</p>
              {m.image_url && (
                <a href={m.image_url} target="_blank" rel="noopener noreferrer" className="block mt-2">
                  <img src={m.image_url} alt="Attachment" className="max-w-full max-h-64 rounded-lg border border-black-border" />
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
            <div className="flex items-center gap-2 bg-black-light border border-black-border rounded-xl px-3 py-2 text-xs text-gray-400">
              <Paperclip className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate flex-1">{imageFile.name}</span>
              <button type="button" onClick={() => { setImageFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-gray-500 hover:text-white shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <form onSubmit={handleReply} className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-[52px] px-4 bg-black-light border border-black-border text-gray-400 hover:text-gold hover:border-gold/50 rounded-xl transition-colors shrink-0"
              title={`Attach image (max ${ticketAttachmentMaxKb}KB)`}
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
            <textarea
              className="flex-1 min-h-[52px] max-h-40 px-4 py-3 rounded-xl border border-black-border bg-black-light text-white placeholder:text-gray-600 focus:outline-none focus:border-gold/60 resize-none"
              placeholder="Type your reply..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(e); } }}
            />
            <button type="submit" disabled={sending || !reply.trim()} className="h-[52px] px-5 bg-gold text-black font-bold rounded-xl disabled:opacity-50 flex items-center justify-center shrink-0">
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
        </div>
      ) : (
        <div className="text-center text-sm text-gray-500 py-4 border-t border-black-border">This ticket is closed.</div>
      )}

      {showRating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-black-light border border-black-border rounded-2xl w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-bold text-white mb-2">Close this ticket?</h3>
            <p className="text-sm text-gray-400 mb-5">Rate the support you received (optional).</p>
            <div className="flex items-center justify-center gap-2 mb-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <button key={i} onClick={() => setRating(i + 1)} type="button">
                  <Star className={`w-8 h-8 transition-colors ${i < rating ? 'text-gold fill-gold' : 'text-gray-700'}`} />
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRating(false)} className="flex-1 h-11 rounded-xl border border-black-border text-gray-300 font-semibold hover:bg-black transition-colors">Cancel</button>
              <button onClick={() => handleClose(rating > 0)} className="flex-1 h-11 rounded-xl bg-gold text-black font-bold hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                {rating > 0 ? 'Submit & Close' : 'Close Without Rating'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
