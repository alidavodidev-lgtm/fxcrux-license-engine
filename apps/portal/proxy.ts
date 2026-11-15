import { NextRequest, NextResponse } from 'next/server';

// Optimistic check only (cookie presence, no signature verification) - runs
// before any page renders, so a logged-out visit to a protected route never
// flashes the sidebar/page content before redirecting. The real, secure check
// still happens server-side per request (HardwareGuard -> /api/auth/status ->
// backend JWT validation) for the case of a present-but-invalid/expired cookie.
const PROTECTED_ROUTES = ['/dashboard', '/store', '/licenses', '/billing', '/tickets', '/profile'];

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtected = PROTECTED_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
  if (!isProtected) return NextResponse.next();

  const session = req.cookies.get('fxcrux_user_session')?.value;
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/store/:path*', '/licenses/:path*', '/billing/:path*', '/tickets/:path*', '/profile/:path*'],
};
