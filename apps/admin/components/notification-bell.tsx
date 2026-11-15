"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Ticket, ShoppingCart, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { usePolling } from "@/hooks/usePolling";
import { playNotificationSound } from "@/lib/play-notification-sound";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const ICONS: Record<string, any> = {
  TICKET_CREATED: Ticket,
  TICKET_REPLY: Ticket,
  PURCHASE_SUBMITTED: ShoppingCart,
  PURCHASE_APPROVED: CheckCircle2,
  PURCHASE_REJECTED: XCircle,
};

export function NotificationBell({ align = "right" }: { align?: "left" | "right" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSeenUnread = useRef<number | null>(null);

  const refreshCount = useCallback(() => {
    fetch("/api/notifications/unread-count").then((r) => r.ok ? r.json() : { count: 0 }).then((data) => {
      const count = data.count || 0;
      if (lastSeenUnread.current !== null && count > lastSeenUnread.current) {
        playNotificationSound();
        fetch("/api/notifications").then((r) => r.ok ? r.json() : []).then((rows: NotificationRow[]) => {
          const latest = rows.find((n) => !n.is_read);
          if (latest) {
            toast.message(latest.title, { description: latest.message });
          }
        }).catch(() => {});
      }
      lastSeenUnread.current = count;
      setUnreadCount(count);
    }).catch(() => {});
  }, []);

  // Only unread items are shown - once a notification is read (by clicking
  // it here, or because the thing it was about got handled elsewhere, e.g.
  // an order approved/rejected from the Payments page) it should disappear
  // from this list entirely, not just get grayed out.
  const loadList = useCallback(() => {
    fetch("/api/notifications").then((r) => r.ok ? r.json() : []).then((data) => {
      setItems(Array.isArray(data) ? data.filter((n: NotificationRow) => !n.is_read) : []);
    }).catch(() => {});
  }, []);

  useEffect(() => { refreshCount(); }, [refreshCount]);
  usePolling(refreshCount, 15000);

  useEffect(() => {
    const onOnline = () => refreshCount();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refreshCount]);

  useEffect(() => {
    if (open) loadList();
  }, [open, loadList]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleItemClick = async (n: NotificationRow) => {
    if (!n.is_read) {
      fetch(`/api/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
      setItems((prev) => prev.filter((x) => x.id !== n.id));
      setUnreadCount((c) => Math.max(0, c - 1));
      lastSeenUnread.current = Math.max(0, (lastSeenUnread.current ?? 1) - 1);
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const handleMarkAllRead = async () => {
    fetch("/api/notifications/mark-all-read", { method: "POST" }).catch(() => {});
    setItems([]);
    setUnreadCount(0);
    lastSeenUnread.current = 0;
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute top-full ${align === "left" ? "left-0" : "right-0"} mt-2 w-80 max-w-[85vw] bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-200 z-50`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <span className="text-sm font-bold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">You're all caught up.</p>
            ) : (
              items.map((n) => {
                const Icon = ICONS[n.type] || Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className="w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors bg-primary/5"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1" suppressHydrationWarning>{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
