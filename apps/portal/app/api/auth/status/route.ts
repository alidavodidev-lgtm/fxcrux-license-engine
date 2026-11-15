import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { userAuthHeader } from '@/lib/user-auth-header';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('fxcrux_user_session')?.value;

    if (!token) {
      return NextResponse.json({ is_bound: false, error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetch(`${backendUrl}/auth/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await userAuthHeader()) },
      cache: 'no-store'
    });

    if (!res.ok) {
      // Expired/invalid token behaves the same as no session at all - the
      // caller (HardwareGuard) treats any non-2xx here as "redirect to login".
      return NextResponse.json({ is_bound: false, error: 'Unauthorized' }, { status: 401 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ is_bound: false, error: 'Server Error' }, { status: 500 });
  }
}
