import { backendUrl } from "@/lib/backend-url";
import { WalletsClient } from "@/components/wallets-client";
import { requirePermission } from "@/lib/require-permission";

async function getWallets() {
  try {
    const res = await fetch(`${backendUrl}/purchases/wallets`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    console.error("Failed to fetch wallets:", error);
    return [];
  }
}

export default async function WalletsPage() {
  await requirePermission("wallets");
  const wallets = await getWallets();
  return <WalletsClient initialWallets={wallets} />;
}