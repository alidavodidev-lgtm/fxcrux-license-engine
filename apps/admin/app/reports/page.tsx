import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/require-permission";

export default async function ReportsPage() {
  await requirePermission("reports");
  redirect("/reports/financial");
}
