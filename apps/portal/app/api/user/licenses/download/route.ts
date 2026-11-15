import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { userAuthHeader } from '@/lib/user-auth-header';

export async function GET(request: Request) {
  const token = (await cookies()).get('fxcrux_user_session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });

  try {
    const res = await fetch(`${backendUrl}/products/${productId}/download`, {
      headers: await userAuthHeader(),
      cache: 'no-store',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ error: data.message || 'Download failed' }, { status: res.status });
    }

    const headers = new Headers();
    const contentType = res.headers.get('content-type');
    const contentDisposition = res.headers.get('content-disposition');
    if (contentType) headers.set('content-type', contentType);
    if (contentDisposition) headers.set('content-disposition', contentDisposition);

    return new NextResponse(res.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
