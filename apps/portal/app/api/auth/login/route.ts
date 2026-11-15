import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { username, password, rememberMe } = await req.json();

    const res = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, rememberMe }), // Fixed: Sending 'password' instead of 'pass' to match your controller
    });

    const data = await res.json();

    if (!res.ok || (data && data.success === false)) {
      return NextResponse.json({ error: data.message || 'Invalid username or password' }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set('fxcrux_user_session', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      // Remembered sessions get a 30-day cookie matching the longer-lived JWT;
      // otherwise a session cookie (no maxAge) so it clears when the browser closes.
      ...(rememberMe ? { maxAge: 60 * 60 * 24 * 30 } : {}),
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
