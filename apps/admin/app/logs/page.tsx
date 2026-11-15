import { backendUrl } from "@/lib/backend-url";
import { LogsClient } from "@/components/logs-client";
import { adminAuthHeader } from "@/lib/admin-auth-header";
import { requirePermission } from "@/lib/require-permission";

async function getLogs() {
  try {
    const res = await fetch(`${backendUrl}/licenses/logs`, { cache: "no-store", headers: await adminAuthHeader() });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    console.error("Error fetching logs:", error);
    return [];
  }
}

export default async function LogsPage() {
  await requirePermission("logs");
  const loginLogs = await getLogs();
  return <LogsClient initialLoginLogs={loginLogs} />;
}