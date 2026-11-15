import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, username, password } = await req.json();

    const res = await fetch(`${backendUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });

    const data = await res.json();

    if (!res.ok || (data && data.success === false)) {
      return NextResponse.json({ error: data.message || 'Registration failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
