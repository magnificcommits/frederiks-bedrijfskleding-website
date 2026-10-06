import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieRow = { name: string; value: string; options: CookieOptions };

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return res;

  // Portaal en KMS hebben elk een eigen sessiecookie (zie lib/portaal/supabaseServer.ts).
  const portaal = req.nextUrl.pathname.startsWith('/portaal');
  const supabase = createServerClient(url, key, {
    cookieOptions: portaal ? { name: 'sb-fb-portaal' } : undefined,
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(list: CookieRow[]) {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return res;
}

export const config = { matcher: ['/portaal/:path*', '/dashboard/:path*'] };
