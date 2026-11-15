import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { userAuthHeader } from '@/lib/user-auth-header';
export async function GET() {
  const token = (await cookies()).get('fxcrux_user_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const res = await fetch(`${backendUrl}/licenses/my-licenses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await userAuthHeader()) }, cache: 'no-store'
    });
    return NextResponse.json(await res.json());
  } catch { return NextResponse.json({ error: 'Server Error' }, { status: 500 }); }
}
