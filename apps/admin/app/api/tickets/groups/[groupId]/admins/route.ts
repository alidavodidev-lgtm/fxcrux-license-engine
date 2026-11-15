import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from "next/server";
import { adminAuthHeader } from "@/lib/admin-auth-header";

export async function GET(_request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params;
    const res = await fetch(`${backendUrl}/tickets/admin/groups/${groupId}/admins`, {
      cache: "no-store",
      headers: await adminAuthHeader(),
    });
    if (!res.ok) return NextResponse.json({ error: "Failed to load category access" }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
