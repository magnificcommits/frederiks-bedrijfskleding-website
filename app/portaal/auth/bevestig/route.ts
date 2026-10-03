import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';

export const dynamic = 'force-dynamic';

/**
 * Inloggen met een token_hash (zonder PKCE-code). Gebruikt door de inloglinks die
 * het dashboard maakt via "Inloglink maken". Zet de sessiecookies en stuurt door
 * naar het portaal.
 */
const TYPES: EmailOtpType[] = ['magiclink', 'email', 'signup', 'invite', 'recovery'];

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  if (!tokenHash || !type || !TYPES.includes(type)) {
    return NextResponse.redirect(`${origin}/portaal/login?fout=link`);
  }
  const sb = await getServerSupabase();
  if (!sb) return NextResponse.redirect(`${origin}/portaal/login?fout=config`);
  const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return NextResponse.redirect(`${origin}/portaal/login?fout=link`);
  return NextResponse.redirect(`${origin}/portaal`);
}
