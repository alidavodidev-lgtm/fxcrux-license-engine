import { backendUrl } from "@/lib/backend-url";
import { LicensesClient } from "@/components/licenses-client";
import { adminAuthHeader } from "@/lib/admin-auth-header";
import { requirePermission } from "@/lib/require-permission";

async function fetchData(endpoint: string) {
  try {
    const res = await fetch(`${backendUrl}${endpoint}`, { cache: "no-store", headers: await adminAuthHeader() });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.data || []);
  } catch (error) { return []; }
}

export default async function LicensesPage() {
  await requirePermission("licenses");
  const [licenses, users, products] = await Promise.all([
    fetchData('/licenses/list'),
    fetchData('/users/list'),
    fetchData('/products/list')
  ]);

  return <LicensesClient initialLicenses={licenses} users={users} products={products} />;
}