import { backendUrl } from "@/lib/backend-url";
import { SettingsClient } from "@/components/settings-client";
import { adminAuthHeader } from "@/lib/admin-auth-header";
import { requireSuperAdmin } from "@/lib/require-permission";

async function fetchJson(path: string) {
  try {
    const res = await fetch(`${backendUrl}${path}`, { cache: "no-store", headers: await adminAuthHeader() });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    return null;
  }
}

export default async function SettingsPage() {
  await requireSuperAdmin();
  const settings = await fetchJson("/settings");
  return <SettingsClient initialSettings={settings} />;
}
