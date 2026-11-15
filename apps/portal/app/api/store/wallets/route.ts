import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch(`${backendUrl}/purchases/wallets`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch wallets' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
