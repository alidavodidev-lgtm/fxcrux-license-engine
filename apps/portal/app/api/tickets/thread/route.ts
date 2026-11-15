import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { userAuthHeader } from '@/lib/user-auth-header';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${backendUrl}/tickets/thread`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await userAuthHeader()) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || 'Failed to load ticket' }, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
