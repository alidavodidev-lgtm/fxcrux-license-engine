import { backendUrl } from "@/lib/backend-url";
import { AdminsClient } from "@/components/admins-client";
import { adminAuthHeader } from "@/lib/admin-auth-header";
import { requireSuperAdmin } from "@/lib/require-permission";

async function fetchJson(path: string) {
  try {
    const res = await fetch(`${backendUrl}${path}`, { cache: "no-store", headers: await adminAuthHeader() });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    return [];
  }
}

export default async function AdminsPage() {
  const me = await requireSuperAdmin();
  const [admins, groups, ratingStats] = await Promise.all([
    fetchJson("/admin/admins/list"),
    fetchJson("/tickets/admin/groups"),
    fetchJson("/tickets/admin/rating-stats"),
  ]);
  return <AdminsClient initialAdmins={admins} groups={groups} ratingStats={ratingStats} currentAdminId={me.id} />;
}
