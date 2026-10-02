import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import { ADMIN_SESSIE_COOKIE, maakAdminSessieToken, sessieCookieOpties } from '@/lib/kms/adminClient';

export const dynamic = 'force-dynamic';

/** Leest het aal-niveau uit een access token (alleen voor de doorverwijzing hieronder). */
function aal(accessToken: string | undefined): string {
  try {
    const deel = accessToken?.split('.')[1];
    if (!deel) return 'aal1';
    const p = JSON.parse(Buffer.from(deel, 'base64url').toString('utf8')) as { aal?: string };
    return p.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard?fout=link`);
  }
  const sb = await getServerSupabase();
  if (!sb) {
    return NextResponse.redirect(`${origin}/dashboard?fout=link`);
  }
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data?.user) {
    return NextResponse.redirect(`${origin}/dashboard?fout=link`);
  }

  // Eigen ondertekend sessiecookie met de inlogtijd: na 8 uur opnieuw inloggen.
  const token = maakAdminSessieToken(data.user.id);
  if (token) (await cookies()).set(ADMIN_SESSIE_COOKIE, token, sessieCookieOpties());

  // Tweestapsverificatie aan? Dan eerst de 6-cijferige code invoeren.
  let factoren = data.user.factors ?? [];
  try {
    const { data: vers } = await sb.auth.getUser();
    if (vers.user?.factors) factoren = vers.user.factors;
  } catch {
    // Valt terug op de gebruiker uit de sessie.
  }
  const heeftFactor = factoren.some((f) => f.status === 'verified');
  if (heeftFactor && aal(data.session?.access_token) !== 'aal2') {
    return NextResponse.redirect(`${origin}/dashboard/auth/2fa`);
  }
  return NextResponse.redirect(`${origin}/dashboard`);
}
