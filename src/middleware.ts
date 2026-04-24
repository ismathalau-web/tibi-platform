import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Public paths where we DON'T need to refresh the session — this avoids a
// Supabase round-trip on cold-start for public-facing routes (login, brand
// dashboards via token, onboarding via token, auth callbacks, PWA bits).
const PUBLIC_PREFIXES = ['/login', '/brand/', '/onboarding/', '/auth/', '/offline', '/api/brand/', '/api/onboarding/'];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) {
    return NextResponse.next({ request: { headers: req.headers } });
  }

  let res = NextResponse.next({ request: { headers: req.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  // Demo mode: skip session refresh until a real Supabase project is wired up.
  if (!url || url.includes('placeholder.supabase.co')) return res;

  const supabase = createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  // Best-effort session refresh — never block the page if Supabase is slow.
  // Edge functions on Netlify have tight timeouts; auth will be re-checked
  // by requireUser/requireAdmin in the page/layout anyway.
  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('auth timeout')), 1500)),
    ]);
  } catch {
    // ignore — page-level auth check will redirect if session is truly invalid
  }
  return res;
}

export const config = {
  matcher: [
    /*
     * Skip static, image, favicon, manifest, sw.
     * Auth-aware routes handle their own redirects in the layout/page.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|.*\\.svg|.*\\.png).*)',
  ],
};
