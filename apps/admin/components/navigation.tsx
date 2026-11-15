"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Key, Users, Box, ScrollText, Wallet, CreditCard, UserCog, Menu, X, Ticket, Settings, BarChart3, Layers } from "lucide-react";
import { AdminSettingsDialog } from "@/components/admin-settings-dialog";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { AdminIdleLogout } from "@/components/admin-idle-logout";
import { NotificationBell } from "@/components/notification-bell";
import { usePolling } from "@/hooks/usePolling";
import { useMediaQuery } from "@/hooks/useMediaQuery";

type Section = "purchases" | "products" | "users" | "licenses" | "wallets" | "logs" | "tickets" | "reports";

const navItems: { name: string; href: string; icon: any; section: Section | null }[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, section: null },
  { name: "Transactions", href: "/purchases", icon: CreditCard, section: "purchases" },
  { name: "Products", href: "/products", icon: Box, section: "products" },
  { name: "App Versions", href: "/app-versions", icon: Layers, section: "products" },
  { name: "Users", href: "/users", icon: Users, section: "users" },
  { name: "Licenses", href: "/licenses", icon: Key, section: "licenses" },
  { name: "Wallets", href: "/wallets", icon: Wallet, section: "wallets" },
  { name: "Tickets", href: "/tickets", icon: Ticket, section: "tickets" },
  { name: "Reports", href: "/reports", icon: BarChart3, section: "reports" },
  { name: "System Logs", href: "/logs", icon: ScrollText, section: "logs" },
];

interface Me {
  username: string;
  is_super_admin: boolean;
  permissions: Record<Section, boolean>;
}

export function Navigation() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Gate which single NotificationBell instance mounts - CSS hidden/md:hidden
  // still mounts both, which double-fired toasts/polling (see useMediaQuery).
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const isAdminLogin = pathname === '/admin-login';
  const fetchMe = () => {
    fetch("/api/admin/me").then((r) => r.ok ? r.json() : null).then(setMe).catch(() => setMe(null));
  };

  // Fetches once when entering the app (not on every route change - that was
  // the source of the "slow switching between admin pages" complaint) and
  // then polls, which also keeps a live/deactivated/permission change reflected
  // in the nav without a manual reload.
  useEffect(() => {
    if (isAdminLogin) return;
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminLogin]);
  usePolling(() => { if (!isAdminLogin) fetchMe(); }, 15000);

  useEffect(() => {
    if (!me || (!me.is_super_admin && !me.permissions?.purchases)) return;
    fetch("/api/purchases/pending").then((r) => r.ok ? r.json() : []).then((data) => {
      setPendingCount(Array.isArray(data) ? data.length : 0);
    }).catch(() => setPendingCount(0));
  }, [me]);

  useEffect(() => {
    if (!me || (!me.is_super_admin && !me.permissions?.tickets)) return;
    fetch("/api/tickets").then((r) => r.ok ? r.json() : []).then((data) => {
      setOpenTicketCount(Array.isArray(data) ? data.filter((t: any) => t.status === 'OPEN').length : 0);
    }).catch(() => setOpenTicketCount(0));
  }, [me]);

  // Close the mobile drawer automatically whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (pathname === '/admin-login') {
    return null;
  }

  const visibleItems = navItems.filter((item) => {
    if (!item.section) return true;
    if (!me) return false;
    return me.is_super_admin || me.permissions?.[item.section];
  });

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {visibleItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm ${
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.name}
            {item.href === '/purchases' && pendingCount > 0 && (
              <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
            {item.href === '/tickets' && openTicketCount > 0 && (
              <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                {openTicketCount}
              </span>
            )}
          </Link>
        );
      })}

      {me?.is_super_admin && (
        <Link
          href="/admins"
          onClick={onNavigate}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm ${
            pathname === '/admins'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <UserCog className="w-5 h-5" />
          Admins
        </Link>
      )}

      {me?.is_super_admin && (
        <Link
          href="/settings"
          onClick={onNavigate}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm ${
            pathname === '/settings'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Settings className="w-5 h-5" />
          Settings
        </Link>
      )}
    </>
  );

  return (
    <>
      <AdminIdleLogout />
      {/* DESKTOP SIDEBAR */}
      <aside className="w-64 h-screen bg-card/50 backdrop-blur-xl border-r border-border/50 sticky top-0 flex-col hidden md:flex">
        <div className="p-6 flex items-center justify-between gap-3 border-b border-border/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center p-1 shrink-0">
              <img src="/brand/fxcrux-icon.png" alt="FXCRUX" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-lg tracking-tight text-foreground truncate">FXCRUX</span>
          </div>
          {isDesktop && <NotificationBell align="left" />}
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <NavLinks />
        </nav>

        <div className="p-4 border-t border-border/50">
          <div className="flex items-center justify-between bg-slate-900/50 border border-border/80 p-3 rounded-2xl">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">{me?.username || 'Administrator'}</span>
              <span className="text-xs text-emerald-500 font-medium">{me?.is_super_admin ? 'Super Admin' : 'Session Active'}</span>
            </div>
            <div className="flex items-center gap-2">
              <AdminSettingsDialog />
              <AdminLogoutButton />
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE/TABLET TOP BAR + DRAWER */}
      <div className="md:hidden fixed top-0 inset-x-0 h-16 bg-card/95 backdrop-blur-xl border-b border-border/50 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center p-1">
            <img src="/brand/fxcrux-icon.png" alt="FXCRUX" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">FXCRUX</span>
        </div>
        <div className="flex items-center gap-1">
          {!isDesktop && <NotificationBell align="right" />}
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {drawerOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setDrawerOpen(false)} />
      )}

      <aside
        className={`md:hidden fixed top-0 right-0 h-screen w-72 max-w-[80vw] bg-card border-l border-border/50 z-50 flex flex-col transition-transform duration-300 ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-5 flex items-center justify-between border-b border-border/50">
          <span className="font-bold text-lg tracking-tight text-foreground">Menu</span>
          <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg text-muted-foreground hover:bg-muted" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <NavLinks onNavigate={() => setDrawerOpen(false)} />
        </nav>

        <div className="p-4 border-t border-border/50">
          <div className="flex items-center justify-between bg-slate-900/50 border border-border/80 p-3 rounded-2xl">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">{me?.username || 'Administrator'}</span>
              <span className="text-xs text-emerald-500 font-medium">{me?.is_super_admin ? 'Super Admin' : 'Session Active'}</span>
            </div>
            <div className="flex items-center gap-2">
              <AdminSettingsDialog />
              <AdminLogoutButton />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
