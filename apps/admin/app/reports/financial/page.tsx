import { backendUrl } from "@/lib/backend-url";
import { ReportsFinancialClient } from "@/components/reports-financial-client";
import { requirePermission } from "@/lib/require-permission";
import { adminAuthHeader } from "@/lib/admin-auth-header";

async function getProducts() {
  try {
    const res = await fetch(`${backendUrl}/products/list`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    return [];
  }
}

async function getCategories() {
  try {
    const res = await fetch(`${backendUrl}/products/groups/all`, { cache: "no-store", headers: await adminAuthHeader() });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    return [];
  }
}

export default async function ReportsFinancialPage() {
  await requirePermission("reports");
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  return <ReportsFinancialClient products={products} categories={categories} />;
}
