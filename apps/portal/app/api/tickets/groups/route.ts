import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { userAuthHeader } from '@/lib/user-auth-header';

export async function GET() {
  try {
    const res = await fetch(`${backendUrl}/tickets/groups`, {
      cache: 'no-store',
      headers: await userAuthHeader(),
    });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
