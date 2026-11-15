import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { userAuthHeader } from '@/lib/user-auth-header';

export async function POST(req: Request) {
  try {
    const { newPass } = await req.json();
    const token = (await cookies()).get('fxcrux_user_session')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const res = await fetch(`${backendUrl}/users/change-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await userAuthHeader()) }, body: JSON.stringify({ newPass })
    });
    return NextResponse.json(await res.json());
  } catch { return NextResponse.json({ error: 'Server Error' }, { status: 500 }); }
}
