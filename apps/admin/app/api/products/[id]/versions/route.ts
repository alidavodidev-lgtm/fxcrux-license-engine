import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from "next/server";
import { adminAuthHeader } from "@/lib/admin-auth-header";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await fetch(`${backendUrl}/products/${id}/versions`, {
      cache: "no-store",
      headers: await adminAuthHeader(),
    });
    if (!res.ok) return NextResponse.json({ error: "Failed to load versions" }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const res = await fetch(`${backendUrl}/products/${id}/versions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await adminAuthHeader()) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || "Failed to create version" }, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
