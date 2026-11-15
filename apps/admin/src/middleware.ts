import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('fxcrux_admin_session');
  const isLoginPage = request.nextUrl.pathname === '/admin-login';
  const isLoginApi = request.nextUrl.pathname === '/api/admin/login';

  if (isLoginApi) {
    return NextResponse.next();
  }

  // If trying to access protected routes without a session, redirect (pages) or 401 (API)
  if (!session && !isLoginPage) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/admin-login', request.url));
  }

  // If already logged in and trying to access login page, redirect to dashboard
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// Specify which routes this middleware should protect.
// This is a presence-only check (Edge runtime) — real JWT verification happens
// in the backend's AdminAuthGuard when each /api proxy route forwards the token.
export const config = {
  matcher: ['/', '/users', '/products', '/licenses', '/purchases', '/wallets', '/logs', '/admin-login', '/api/:path*'],
};