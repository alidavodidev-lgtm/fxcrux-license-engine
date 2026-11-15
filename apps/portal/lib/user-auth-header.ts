import { cookies } from 'next/headers';

// Reads the user session JWT from the httpOnly cookie and returns the
// Authorization header to forward to backend endpoints protected by AuthGuard('jwt').
export async function userAuthHeader(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token = cookieStore.get('fxcrux_user_session')?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
