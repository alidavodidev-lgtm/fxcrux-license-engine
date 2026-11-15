import { backendUrl } from "@/lib/backend-url";
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { userAuthHeader } from '@/lib/user-auth-header';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Retrieve user session cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('fxcrux_user_session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const payload = {
      tierId: body.tier_id,
      walletId: body.wallet_id || "default_wallet",
      txId: body.txid,
    };

    const res = await fetch(`${backendUrl}/purchases/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await userAuthHeader()) },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return NextResponse.json({ error: errorData.message || 'Transaction failed' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
