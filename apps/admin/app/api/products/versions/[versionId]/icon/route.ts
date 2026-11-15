import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from "next/server";
import { adminAuthHeader } from "@/lib/admin-auth-header";

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    const contentType = request.headers.get("content-type") || "";
    const res = await fetch(`${backendUrl}/products/versions/${versionId}/icon`, {
      method: "POST",
      headers: { "content-type": contentType, ...(await adminAuthHeader()) },
      body: request.body,
      duplex: "half",
    } as any);
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || "Failed to upload icon" }, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    const res = await fetch(`${backendUrl}/products/versions/${versionId}/icon`, {
      method: "DELETE",
      headers: await adminAuthHeader(),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || "Failed to remove icon" }, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
