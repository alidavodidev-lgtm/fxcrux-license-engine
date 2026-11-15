import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from "next/server";
import { adminAuthHeader } from "@/lib/admin-auth-header";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${backendUrl}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await adminAuthHeader()) },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return NextResponse.json({ error: errorData.message || "Failed to update settings" }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
