import { ReportsUsersClient } from "@/components/reports-users-client";
import { requirePermission } from "@/lib/require-permission";

export default async function ReportsUsersPage() {
  await requirePermission("reports");
  return <ReportsUsersClient />;
}
