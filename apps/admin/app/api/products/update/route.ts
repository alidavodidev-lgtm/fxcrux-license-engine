import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { adminAuthHeader } from '@/lib/admin-auth-header';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${backendUrl}/products/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await adminAuthHeader()) },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return NextResponse.json({ error: errorData.message || 'Failed to update product' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}