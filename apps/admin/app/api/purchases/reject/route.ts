import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { adminAuthHeader } from '@/lib/admin-auth-header';

export async function POST(req: Request) {
  try {
    const { purchaseId, reason } = await req.json();
    const res = await fetch(`${backendUrl}/purchases/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await adminAuthHeader()) },
      body: JSON.stringify({ purchaseId, reason }),
    });
    return NextResponse.json(await res.json());
  } catch (error) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
