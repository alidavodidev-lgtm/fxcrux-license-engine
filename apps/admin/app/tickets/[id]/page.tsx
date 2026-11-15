import { backendUrl } from "@/lib/backend-url";
import { TicketThreadClient } from "@/components/ticket-thread-client";
import { adminAuthHeader } from "@/lib/admin-auth-header";
import { requireAnyPermission } from "@/lib/require-permission";

async function fetchGroups() {
  try {
    const res = await fetch(`${backendUrl}/tickets/admin/groups`, { cache: "no-store", headers: await adminAuthHeader() });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function AdminTicketThreadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnyPermission(["tickets", "reports"]);
  const { id } = await params;
  const groups = await fetchGroups();
  return <TicketThreadClient ticketId={id} groups={groups} />;
}
