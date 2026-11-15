"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Users, LifeBuoy } from "lucide-react";

export function ReportsTabs() {
  const pathname = usePathname();
  const isUsers = pathname.startsWith("/reports/users");
  const isTickets = pathname.startsWith("/reports/tickets");
  const isFinancial = !isUsers && !isTickets;

  return (
    <div className="flex items-center gap-2 border-b border-border/50">
      <Link
        href="/reports/financial"
        className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${isFinancial ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
      >
        <TrendingUp className="w-4 h-4" /> Financial
      </Link>
      <Link
        href="/reports/users"
        className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${isUsers ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
      >
        <Users className="w-4 h-4" /> Users
      </Link>
      <Link
        href="/reports/tickets"
        className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${isTickets ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
      >
        <LifeBuoy className="w-4 h-4" /> Tickets
      </Link>
    </div>
  );
}
