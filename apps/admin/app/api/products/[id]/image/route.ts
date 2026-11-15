import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { adminAuthHeader } from '@/lib/admin-auth-header';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const contentType = request.headers.get('content-type') || '';
    const res = await fetch(`${backendUrl}/products/${id}/image`, {
      method: 'POST',
      headers: { 'content-type': contentType, ...(await adminAuthHeader()) },
      body: request.body,
      duplex: 'half',
    } as any);
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || 'Failed to upload image' }, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
