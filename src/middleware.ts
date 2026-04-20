import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
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

  await supabase.auth.getUser();
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
