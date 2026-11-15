import { cookies } from 'next/headers';

// Reads the admin session JWT from the httpOnly cookie and returns the
// Authorization header to forward to backend endpoints protected by AdminAuthGuard.
export async function adminAuthHeader(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token = cookieStore.get('fxcrux_admin_session')?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
