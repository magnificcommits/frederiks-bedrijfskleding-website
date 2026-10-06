import { NextResponse } from 'next/server';
import { dashAuthed } from '@/lib/kms/adminClient';
import { isDemoRol, logInAlsDemo } from '@/lib/demo';

export const dynamic = 'force-dynamic';

/**
 * Opent de demo vanuit het KMS: /dashboard/demo?rol=beheerder|leidinggevende|medewerker.
 * auth: KMS-login vereist (dashAuthed). De KMS-sessie blijft staan; het portaal krijgt
 * een eigen sessie als demo-account.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!(await dashAuthed())) return NextResponse.redirect(new URL('/dashboard', url));
  const rolParam = url.searchParams.get('rol') ?? 'beheerder';
  const rol = isDemoRol(rolParam) ? rolParam : 'beheerder';
  const r = await logInAlsDemo(rol);
  if (!r.ok) return NextResponse.redirect(new URL(`/dashboard?melding=${encodeURIComponent(r.fout)}`, url));
  return NextResponse.redirect(new URL('/portaal', url));
}
