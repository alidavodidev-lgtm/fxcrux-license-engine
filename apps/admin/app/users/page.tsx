import { backendUrl } from "@/lib/backend-url";
import { UsersClient } from "@/components/users-client";
import { adminAuthHeader } from "@/lib/admin-auth-header";
import { requirePermission } from "@/lib/require-permission";

async function getUsers() {
  try {
    const res = await fetch(`${backendUrl}/users/list`, {
      cache: "no-store",
      headers: await adminAuthHeader(),
    });

    if (!res.ok) return [];

    const data = await res.json();

    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && Array.isArray(data.users)) return data.users;

    return [];
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

export default async function UsersPage() {
  await requirePermission("users");
  const users = await getUsers();
  return <UsersClient initialUsers={users} />;
}