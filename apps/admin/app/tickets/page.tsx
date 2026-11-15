import { backendUrl } from "@/lib/backend-url";
import { TicketsClient } from "@/components/tickets-client";
import { adminAuthHeader } from "@/lib/admin-auth-header";
import { requirePermission } from "@/lib/require-permission";

async function fetchJson(path: string) {
  try {
    const res = await fetch(`${backendUrl}${path}`, { cache: "no-store", headers: await adminAuthHeader() });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function TicketsPage() {
  const me = await requirePermission("tickets");
  const [tickets, groups] = await Promise.all([
    fetchJson("/tickets/admin/list"),
    fetchJson("/tickets/admin/groups"),
  ]);

  return <TicketsClient initialTickets={tickets} groups={groups} isSuperAdmin={!!me?.is_super_admin} />;
}
