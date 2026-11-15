import { backendUrl } from "@/lib/backend-url";
import { notFound } from "next/navigation";
import { ProductVersionsClient } from "@/components/product-versions-client";
import { requirePermission } from "@/lib/require-permission";
import { adminAuthHeader } from "@/lib/admin-auth-header";

async function getProduct(productId: string) {
  try {
    const res = await fetch(`${backendUrl}/products/list`, { cache: "no-store" });
    if (!res.ok) return null;
    const products = await res.json();
    return products.find((p: any) => p.id === productId) || null;
  } catch {
    return null;
  }
}

async function getVersions(productId: string) {
  try {
    const res = await fetch(`${backendUrl}/products/${productId}/versions`, {
      cache: "no-store",
      headers: await adminAuthHeader(),
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function ProductVersionsPage({ params }: { params: Promise<{ productId: string }> }) {
  await requirePermission("products");
  const { productId } = await params;
  const [product, versions] = await Promise.all([getProduct(productId), getVersions(productId)]);
  if (!product) notFound();
  return <ProductVersionsClient product={product} initialVersions={versions} />;
}
