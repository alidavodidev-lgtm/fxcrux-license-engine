import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${backendUrl}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const data = await res.json();

    // Store the signed admin JWT (not the raw username) as the session cookie.
    // Deliberately no maxAge/remember-me for admin accounts - a privileged
    // session should always require a fresh login, not persist for days. The
    // JWT's own 10h expiry (see AuthModule's JwtModule config) is the hard
    // cap; AdminIdleLogout enforces the practical 10-minute idle limit.
    const cookieStore = await cookies();
    cookieStore.set('fxcrux_admin_session', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}