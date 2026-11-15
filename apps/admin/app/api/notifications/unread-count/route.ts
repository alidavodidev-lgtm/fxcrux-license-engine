import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { adminAuthHeader } from '@/lib/admin-auth-header';

export async function GET() {
  try {
    const res = await fetch(`${backendUrl}/notifications/admin/unread-count`, {
      cache: 'no-store',
      headers: await adminAuthHeader(),
    });
    if (!res.ok) return NextResponse.json({ count: 0 }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
