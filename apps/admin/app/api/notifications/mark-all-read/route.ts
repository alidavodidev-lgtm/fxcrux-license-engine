import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { adminAuthHeader } from '@/lib/admin-auth-header';

export async function POST() {
  try {
    const res = await fetch(`${backendUrl}/notifications/admin/mark-all-read`, {
      method: 'POST',
      headers: await adminAuthHeader(),
    });
    if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
