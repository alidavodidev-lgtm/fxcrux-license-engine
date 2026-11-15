import { ReportsTicketDayDetailClient } from "@/components/reports-ticket-day-detail-client";
import { requirePermission } from "@/lib/require-permission";

export default async function ReportsTicketDayDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePermission("reports");
  const { date } = await params;
  const sp = await searchParams;
  const filters = {
    status: typeof sp.status === "string" ? sp.status : undefined,
    groupId: typeof sp.groupId === "string" ? sp.groupId : undefined,
    adminId: typeof sp.adminId === "string" ? sp.adminId : undefined,
    userSearch: typeof sp.userSearch === "string" ? sp.userSearch : undefined,
    search: typeof sp.search === "string" ? sp.search : undefined,
  };
  return <ReportsTicketDayDetailClient date={date} filters={filters} />;
}
