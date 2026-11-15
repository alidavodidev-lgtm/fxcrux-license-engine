import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { userAuthHeader } from '@/lib/user-auth-header';

export async function POST() {
  try {
    const res = await fetch(`${backendUrl}/notifications/mark-all-read`, {
      method: 'POST',
      headers: await userAuthHeader(),
    });
    if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
