import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from "next/server";
import { adminAuthHeader } from "@/lib/admin-auth-header";

export async function GET() {
  try {
    const res = await fetch(`${backendUrl}/tickets/admin/groups`, {
      cache: "no-store",
      headers: await adminAuthHeader(),
    });
    if (!res.ok) return NextResponse.json({ error: "Failed to load groups" }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${backendUrl}/tickets/admin/groups/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await adminAuthHeader()) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || "Failed to create group" }, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
