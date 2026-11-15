import { backendUrl } from "@/lib/backend-url";
import { redirect } from "next/navigation";
import { adminAuthHeader } from "@/lib/admin-auth-header";

type PermissionSection = "purchases" | "products" | "users" | "licenses" | "wallets" | "logs" | "tickets" | "reports";

// Server-side guard for admin pages: hiding a nav link is UX only, this is the
// real check. Redirects home if the signed-in admin can't see this section -
// the backend's PermissionGuard is still the actual enforcement for the data
// itself, this just stops the page shell from rendering at all.
export async function requirePermission(section: PermissionSection) {
  const res = await fetch(`${backendUrl}/admin/me`, {
    cache: "no-store",
    headers: await adminAuthHeader(),
  });

  if (!res.ok) redirect("/admin-login");

  const me = await res.json();
  if (me.is_super_admin) return me;
  if (!me.permissions?.[section]) redirect("/");

  return me;
}

// Same as requirePermission() but passes if the admin has ANY of the listed
// sections - used where a page is reachable from more than one section (e.g.
// a ticket thread linked from both Tickets and the Reports > Tickets drill-down).
export async function requireAnyPermission(sections: PermissionSection[]) {
  const res = await fetch(`${backendUrl}/admin/me`, {
    cache: "no-store",
    headers: await adminAuthHeader(),
  });

  if (!res.ok) redirect("/admin-login");

  const me = await res.json();
  if (me.is_super_admin) return me;
  if (!sections.some((s) => me.permissions?.[s])) redirect("/");

  return me;
}

export async function requireSuperAdmin() {
  const res = await fetch(`${backendUrl}/admin/me`, {
    cache: "no-store",
    headers: await adminAuthHeader(),
  });

  if (!res.ok) redirect("/admin-login");

  const me = await res.json();
  if (!me.is_super_admin) redirect("/");

  return me;
}
