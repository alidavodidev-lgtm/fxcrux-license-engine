import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { userAuthHeader } from '@/lib/user-auth-header';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const res = await fetch(`${backendUrl}/tickets/upload`, {
      method: 'POST',
      headers: { 'content-type': contentType, ...(await userAuthHeader()) },
      body: request.body,
      duplex: 'half',
    } as any);
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || 'Failed to upload image' }, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
