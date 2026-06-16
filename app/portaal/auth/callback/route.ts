import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  if (code) {
    const sb = await getServerSupabase();
    if (sb) await sb.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}/portaal`);
}
