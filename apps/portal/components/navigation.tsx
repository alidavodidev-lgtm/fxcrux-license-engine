"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, Key, Wallet, User, LifeBuoy, ChevronRight, ChevronLeft } from "lucide-react";
import { SessionButton } from "@/components/SessionButton";
import { NotificationBell } from "@/components/NotificationBell";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Market", href: "/store", icon: ShoppingCart },
  { name: "Licenses", href: "/licenses", icon: Key },
  { name: "Billing", href: "/billing", icon: Wallet },
  { name: "Support", href: "/tickets", icon: LifeBuoy },
  { name: "Profile", href: "/profile", icon: User },
];

export function Navigation() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  // Gate which single NotificationBell instance mounts - CSS hidden/lg:hidden
  // still mounts both, which double-fired toasts/polling (see useMediaQuery).
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetch("/api/tickets").then((r) => r.ok ? r.json() : []).then((data) => {
      if (Array.isArray(data)) setOpenTicketCount(data.filter((t: any) => t.status === 'OPEN').length);
    }).catch(() => {});
  }, [mounted, pathname]);

  if (!mounted) return null;

  // Do not render navigation on authentication pages
  if (pathname === "/" || pathname === "/login" || pathname === "/register") {
    return null;
  }

  return (
    <>
      {/* Mobile has no top bar, and the bottom nav has no room for a 7th
      icon - a small floating bell in the unused top-right corner covers it. */}
      {!isDesktop && <NotificationBell floating />}

      {/* DESKTOP LAYOUT: Right Collapsible Sidebar
      */}
      <aside
        className={`hidden lg:flex fixed top-0 right-0 h-screen bg-black-light/95 backdrop-blur-2xl border-l border-black-border flex-col transition-all duration-500 ease-in-out z-50 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="h-24 flex items-center justify-between gap-2 px-5 border-b border-black-border">
          {!isCollapsed && (
            <span className="flex items-center gap-2 min-w-0 font-black text-white tracking-wide text-lg animate-fade-in uppercase overflow-hidden">
              <img src="/brand/fxcrux-icon.png" alt="FXCRUX" className="w-8 h-8 flex-shrink-0" />
              <span className="truncate">Fxcrux <span className="text-gold">Hub</span></span>
            </span>
          )}
          <div className={`flex items-center gap-2 flex-shrink-0 ${isCollapsed ? 'flex-col' : ''}`}>
            {isDesktop && !isCollapsed && <NotificationBell />}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex-shrink-0 p-2 rounded-xl bg-black border border-black-border text-gold hover:bg-gold hover:text-black transition-all duration-300"
            >
              {isCollapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-3 py-3.5 rounded-xl transition-all duration-300 group ${
                  isActive
                    ? 'bg-gold/10 text-gold shadow-[inset_-3px_0_0_0_#D4AF37]'
                    : 'text-gray-400 hover:bg-black hover:text-white'
                }`}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-gold' : 'text-gray-500 group-hover:text-gold-light'}`} />
                {!isCollapsed && (
                  <span className="font-semibold text-sm tracking-wide whitespace-nowrap">{item.name}</span>
                )}
                {item.href === '/tickets' && openTicketCount > 0 && (
                  <span className={`bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center ${isCollapsed ? 'absolute top-2 right-2' : 'ml-auto'}`}>
                    {openTicketCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <SessionButton isCollapsed={isCollapsed} />
      </aside>

      {/* MOBILE LAYOUT: Bottom Navigation Bar (PWA Standard)
      */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full h-20 bg-black-light/95 backdrop-blur-3xl border-t border-black-border z-50 flex items-center justify-around px-2 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.6)]">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center w-full h-full gap-1.5"
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-gold-dark via-gold to-gold-light rounded-b-full shadow-[0_2px_15px_rgba(212,175,55,0.6)]" />
              )}
              <div className={`relative p-2 rounded-xl transition-all duration-500 ${isActive ? 'text-gold -translate-y-1' : 'text-gray-500'}`}>
                <item.icon className="w-6 h-6" />
                {item.href === '/tickets' && openTicketCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-bold min-w-[15px] h-[15px] px-0.5 rounded-full flex items-center justify-center">
                    {openTicketCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors duration-300 ${isActive ? 'text-gold' : 'text-gray-600'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
