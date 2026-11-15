import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('fxcrux_user_session');

    return NextResponse.json({ success: true, message: 'Session terminated' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to terminate session' }, { status: 500 });
  }
}
