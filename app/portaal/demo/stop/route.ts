import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';

export const dynamic = 'force-dynamic';

/** Sluit de demo: alleen de portaalsessie uitloggen, het KMS blijft ingelogd. auth: publiek (logt alleen uit). */
export async function POST(req: Request) {
  const sb = await getServerSupabase('portaal');
  await sb?.auth.signOut();
  return NextResponse.redirect(new URL('/dashboard', req.url), 303);
}
