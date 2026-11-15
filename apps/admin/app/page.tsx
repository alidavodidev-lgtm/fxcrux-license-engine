import { backendUrl } from "@/lib/backend-url";
import { AdminDashboardClient } from "@/components/admin-dashboard-client";
import { adminAuthHeader } from "@/lib/admin-auth-header";

async function getMe() {
  try {
    const res = await fetch(`${backendUrl}/admin/me`, { cache: "no-store", headers: await adminAuthHeader() });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchJson(path: string, headers: Record<string, string>) {
  try {
    const res = await fetch(`${backendUrl}${path}`, { cache: "no-store", headers });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const me = await getMe();
  const can = (section: string) => !!me && (me.is_super_admin || me.permissions?.[section]);
  const headers = await adminAuthHeader();

  const [users, licenses, purchases, products, revenue] = await Promise.all([
    can("users") ? fetchJson("/users/list", headers) : null,
    can("licenses") ? fetchJson("/licenses/list", headers) : null,
    can("purchases") ? fetchJson("/purchases/pending", headers) : null,
    can("products") ? fetchJson("/products/list", headers) : null,
    can("purchases") ? fetchJson("/purchases/stats", headers) : null,
  ]);

  const usersList = Array.isArray(users) ? users : users?.data || [];
  const licensesList = Array.isArray(licenses) ? licenses : licenses?.data || [];
  const purchasesList = Array.isArray(purchases) ? purchases : purchases?.data || [];
  const productsList = Array.isArray(products) ? products : products?.data || [];

  return (
    <AdminDashboardClient
      me={me}
      stats={{
        totalUsers: usersList.length,
        activeLicenses: licensesList.filter((l: any) => l.status === 'active' && new Date(l.expires_at) > new Date()).length,
        pendingPurchases: purchasesList.length,
        totalProducts: productsList.length,
      }}
      revenue={revenue}
    />
  );
}
