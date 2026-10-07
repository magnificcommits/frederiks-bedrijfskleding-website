import { NextResponse } from 'next/server';
import { registreerKlik } from '@/lib/reviews/uitnodigingen';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Knop "Schrijf een review op Google" uit de uitnodigingsmail. Legt de klik vast
 * en stuurt door naar de Google-reviewlink. Onbekend token: naar de homepage.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doel = await registreerKlik(token).catch(() => null);
  return NextResponse.redirect(doel ?? env.siteUrl, 302);
}
