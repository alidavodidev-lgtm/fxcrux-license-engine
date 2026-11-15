import { backendUrl } from "@/lib/backend-url";
import { PurchasesClient } from "@/components/purchases-client";
import { adminAuthHeader } from "@/lib/admin-auth-header";
import { requirePermission } from "@/lib/require-permission";

async function getPendingPurchases() {
  try {
    const res = await fetch(`${backendUrl}/purchases/pending`, {
      cache: "no-store",
      headers: await adminAuthHeader(),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching purchases:", error);
    return [];
  }
}

export default async function PurchasesPage() {
  await requirePermission("purchases");
  const pendingPurchases = await getPendingPurchases();
  return <PurchasesClient initialPurchases={pendingPurchases} />;
}