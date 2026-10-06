import { NextResponse } from 'next/server';
import { isDemoRol, logInAlsDemo, magDemo } from '@/lib/demo';

export const dynamic = 'force-dynamic';

/** Wisselt binnen de demo van rol. auth: KMS-login of een lopende demo-sessie. */
export async function GET(req: Request) {
  // auth: token magDemo(): KMS-login of een lopende demo-sessie, anders terug naar /portaal.
  const url = new URL(req.url);
  const rol = url.searchParams.get('rol');
  if (!isDemoRol(rol) || !(await magDemo())) return NextResponse.redirect(new URL('/portaal', url));
  await logInAlsDemo(rol);
  return NextResponse.redirect(new URL('/portaal', url));
}
