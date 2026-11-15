import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from "next/server";
import { adminAuthHeader } from "@/lib/admin-auth-header";

export async function GET(request: Request) {
  try {
    const { search } = new URL(request.url);
    const res = await fetch(`${backendUrl}/analytics/financial/by-tier${search}`, {
      cache: "no-store",
      headers: await adminAuthHeader(),
    });
    if (!res.ok) return NextResponse.json({ error: "Failed to load tier breakdown" }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
