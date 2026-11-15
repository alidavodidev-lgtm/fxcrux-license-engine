import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from "next/server";
import { adminAuthHeader } from "@/lib/admin-auth-header";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await fetch(`${backendUrl}/analytics/users/${id}/export`, {
      cache: "no-store",
      headers: await adminAuthHeader(),
    });
    if (!res.ok) return NextResponse.json({ error: "Failed to export user profile" }, { status: res.status });

    const headers = new Headers();
    const contentType = res.headers.get("content-type");
    const contentDisposition = res.headers.get("content-disposition");
    if (contentType) headers.set("content-type", contentType);
    if (contentDisposition) headers.set("content-disposition", contentDisposition);

    return new NextResponse(res.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
