import { NextResponse } from 'next/server';
import { z } from 'zod';
import { boekAfspraak } from '@/lib/afspraken/afspraken';
import { publiekeLimiet, clientIp } from '@/lib/ratelimit';
import { herkomstSchema, schoneHerkomst } from '@/lib/leadHerkomstValidatie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  soort: z.enum(['advies', 'showroom', 'pasdag']),
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tijd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  naam: z.string().min(2).max(120),
  bedrijf: z.string().max(160).optional().or(z.literal('')),
  email: z.string().email().max(200),
  telefoon: z.string().max(40).optional().or(z.literal('')),
  aantal: z.string().max(40).optional().or(z.literal('')),
  branche: z.string().max(80).optional().or(z.literal('')),
  opmerking: z.string().max(2000).optional().or(z.literal('')),
  locatie: z.string().max(300).optional().or(z.literal('')),
  vorm: z.enum(['bellen', 'video']).optional(),
  bron: z.string().max(400).optional().or(z.literal('')),
  consent: z.union([z.literal('on'), z.boolean()]).optional(),
  website: z.string().max(200).optional(), // honeypot
  // Gestructureerde herkomst (lib/herkomst.ts), zelfde vorm als bij /api/lead.
  herkomst: herkomstSchema.optional().nullable(),
});

/** Online afspraak boeken (AfspraakKiezer). */
export async function POST(req: Request) {
  // auth: publiek (online afspraak boeken); beschermd met databaselimiet, honeypot, Zod en verplicht akkoord.
  if (!(await publiekeLimiet('afspraak', clientIp(req), 6, 600_000))) {
    return NextResponse.json({ error: 'Te veel verzoeken. Probeer het later opnieuw of bel ons.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Controleer de ingevulde gegevens.' }, { status: 422 });
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true }); // honeypot: stil negeren
  // Het formulier heeft een verplicht akkoord-vinkje; zonder akkoord boeken we niet.
  if (d.consent !== true && d.consent !== 'on') {
    return NextResponse.json({ error: 'Zet een vinkje bij het akkoord, dan kunnen we je afspraak plannen.' }, { status: 422 });
  }

  const res = await boekAfspraak({
    soort: d.soort,
    datum: d.datum,
    tijd: d.tijd,
    naam: d.naam,
    bedrijf: d.bedrijf || undefined,
    email: d.email,
    telefoon: d.telefoon || undefined,
    aantal: d.aantal || undefined,
    branche: d.branche || undefined,
    opmerking: d.opmerking || undefined,
    locatie: d.locatie || undefined,
    vorm: d.vorm,
    bron: d.bron || undefined,
    herkomst: schoneHerkomst(d.herkomst),
  });
  if (!res.ok) return NextResponse.json({ error: res.fout, bezet: res.bezet ?? false }, { status: res.bezet ? 409 : 422 });
  return NextResponse.json({ ok: true, start: res.start, eind: res.eind });
}
