import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(`${origin}/portaal/login?fout=link`);
  }
  const sb = await getServerSupabase();
  if (!sb) {
    return NextResponse.redirect(`${origin}/portaal/login?fout=config`);
  }
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/portaal/login?fout=link`);
  }
  return NextResponse.redirect(`${origin}/portaal`);
}
