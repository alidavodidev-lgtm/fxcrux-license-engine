import { ReportsUserDetailClient } from "@/components/reports-user-detail-client";
import { requirePermission } from "@/lib/require-permission";

export default async function ReportsUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("reports");
  const { id } = await params;
  return <ReportsUserDetailClient userId={id} />;
}
