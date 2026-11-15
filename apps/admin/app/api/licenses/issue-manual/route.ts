import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { adminAuthHeader } from '@/lib/admin-auth-header';
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${backendUrl}/licenses/issue-manual`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await adminAuthHeader()) }, body: JSON.stringify(body) });
    if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) { return NextResponse.json({ error: 'Error' }, { status: 500 }); }
}