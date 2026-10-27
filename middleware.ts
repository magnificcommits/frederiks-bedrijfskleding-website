import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieRow = { name: string; value: string; options: CookieOptions };

export async function middleware(req: NextRequest) {
  // Het opgevraagde pad voor de rolcontrole in dashAuthed (magazijnmedewerker).
  // Altijd overschrijven, zodat een meegestuurde waarde van buiten niet telt.
  const kop = new Headers(req.headers);
  kop.set('x-fb-pad', req.nextUrl.pathname);
  if (req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next({ request: { headers: kop } });

  let res = NextResponse.next({ request: { headers: kop } });
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
        list.forEach(({ name, value }) => {
          req.cookies.set(name, value);
        });
        // Bijgewerkte cookies ook in de doorgegeven kopregels, naast x-fb-pad.
        kop.set('cookie', req.cookies.toString());
        res = NextResponse.next({ request: { headers: kop } });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return res;
}

export const config = { matcher: ['/portaal/:path*', '/dashboard/:path*', '/api/dashboard/:path*'] };
