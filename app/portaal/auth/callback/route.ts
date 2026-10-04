import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import { veiligVervolg } from '@/lib/sso';
import { bevestigdEmail, foutUitCallback, heeftPortaalToegang } from '@/lib/ssoToegang';

export const dynamic = 'force-dynamic';

/**
 * Terugkomst na de inlogmail (PKCE-code) of na inloggen met Microsoft/Google.
 * Wie inlogt moet een portaalgebruiker zijn (rij in portaal_gebruikers); zo niet,
 * dan meteen weer uitloggen. Zo geeft een Microsoft- of Google-account nooit
 * vanzelf toegang tot het portaal.
 */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const providerFout = foutUitCallback(searchParams);
  if (providerFout) {
    return NextResponse.redirect(`${origin}/portaal/login?fout=${providerFout}`);
  }
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(`${origin}/portaal/login?fout=link`);
  }
  const sb = await getServerSupabase();
  if (!sb) {
    return NextResponse.redirect(`${origin}/portaal/login?fout=config`);
  }
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data?.user) {
    return NextResponse.redirect(`${origin}/portaal/login?fout=link`);
  }
  const email = bevestigdEmail(data.user);
  if (!email || !(await heeftPortaalToegang(email, sb))) {
    await sb.auth.signOut({ scope: 'local' });
    return NextResponse.redirect(`${origin}/portaal/login?fout=geen-toegang`);
  }
  return NextResponse.redirect(`${origin}${veiligVervolg(searchParams.get('next'), 'portaal')}`);
}
