import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from "next/server";
import { adminAuthHeader } from "@/lib/admin-auth-header";

export async function GET() {
  try {
    const res = await fetch(`${backendUrl}/admin/me`, {
      cache: "no-store",
      headers: await adminAuthHeader(),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
