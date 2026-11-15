import { backendUrl } from "@/lib/backend-url";
import { ProductsClient } from "@/components/products-client";
import { adminAuthHeader } from "@/lib/admin-auth-header";
import { requirePermission } from "@/lib/require-permission";

async function getProducts() {
  try {
    const res = await fetch(`${backendUrl}/products/list`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    return [];
  }
}

async function getGroups() {
  try {
    const res = await fetch(`${backendUrl}/products/groups/all`, { cache: "no-store", headers: await adminAuthHeader() });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    return [];
  }
}

export default async function ProductsPage() {
  await requirePermission("products");
  const [products, groups] = await Promise.all([getProducts(), getGroups()]);
  return <ProductsClient initialProducts={products} groups={groups} />;
}