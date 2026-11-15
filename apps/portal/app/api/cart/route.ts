import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { userAuthHeader } from '@/lib/user-auth-header';

export async function GET() {
  try {
    const res = await fetch(`${backendUrl}/cart`, {
      cache: 'no-store',
      headers: await userAuthHeader(),
    });
    if (!res.ok) return NextResponse.json([], { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
