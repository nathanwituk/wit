import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes — always allow
  if (
    pathname === '/' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Check Supabase session
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in — back to login
  if (!user) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Wrong email — sign out and block
  if (user.email !== process.env.ALLOWED_EMAIL) {
    return NextResponse.redirect(new URL('/?error=unauthorized', req.url));
  }

  // Allow setup-2fa and verify-2fa without 2FA cookie
  if (pathname === '/setup-2fa' || pathname === '/verify-2fa') {
    return res;
  }

  // All other routes (including /dashboard) require 2FA cookie
  const twoFaVerified = req.cookies.get('wit_2fa_verified')?.value === 'true';
  if (!twoFaVerified) {
    return NextResponse.redirect(new URL('/verify-2fa', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-).*)'],
};
