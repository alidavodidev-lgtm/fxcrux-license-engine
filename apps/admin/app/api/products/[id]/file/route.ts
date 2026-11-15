import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { adminAuthHeader } from '@/lib/admin-auth-header';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const contentType = request.headers.get('content-type') || '';
    const res = await fetch(`${backendUrl}/products/${id}/file`, {
      method: 'POST',
      headers: { 'content-type': contentType, ...(await adminAuthHeader()) },
      body: request.body,
      duplex: 'half',
    } as any);
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || 'Failed to upload file' }, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await fetch(`${backendUrl}/products/${id}/file`, {
      method: 'DELETE',
      headers: await adminAuthHeader(),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || 'Failed to remove file' }, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
