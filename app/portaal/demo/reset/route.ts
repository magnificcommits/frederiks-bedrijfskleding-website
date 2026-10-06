import { NextResponse } from 'next/server';
import { magDemo, resetDemo } from '@/lib/demo';

export const dynamic = 'force-dynamic';

/** Zet de demoklant terug. auth: KMS-login of een lopende demo-sessie. Alleen POST. */
export async function POST(req: Request) {
  // auth: token magDemo(): KMS-login of een lopende demo-sessie, anders terug naar /portaal.
  const url = new URL(req.url);
  if (!(await magDemo())) return NextResponse.redirect(new URL('/portaal', url), 303);
  const ok = await resetDemo();
  return NextResponse.redirect(new URL(`/portaal?demo=${ok ? 'gereset' : 'mislukt'}`, url), 303);
}
