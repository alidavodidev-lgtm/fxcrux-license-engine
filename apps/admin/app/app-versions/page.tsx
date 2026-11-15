import { backendUrl } from "@/lib/backend-url";
import { AppVersionsProductPickerClient } from "@/components/app-versions-product-picker-client";
import { requirePermission } from "@/lib/require-permission";

async function getProducts() {
  try {
    const res = await fetch(`${backendUrl}/products/list`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function AppVersionsPage() {
  await requirePermission("products");
  const products = await getProducts();
  return <AppVersionsProductPickerClient products={products} />;
}
