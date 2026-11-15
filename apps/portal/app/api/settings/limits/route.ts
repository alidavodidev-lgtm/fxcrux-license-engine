import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch(`${backendUrl}/settings/public-limits`, { cache: 'no-store' });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
