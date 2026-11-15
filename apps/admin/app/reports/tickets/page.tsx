import { ReportsTicketsClient } from "@/components/reports-tickets-client";
import { requirePermission } from "@/lib/require-permission";

export default async function ReportsTicketsPage() {
  await requirePermission("reports");
  return <ReportsTicketsClient />;
}
