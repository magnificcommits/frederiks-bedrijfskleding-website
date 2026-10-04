import { NextResponse } from 'next/server';
import { z } from 'zod';
import { vraagInschrijvingAan } from '@/lib/nieuwsbrief/optin';
import { publiekeLimiet, clientIp } from '@/lib/ratelimit';

export const runtime = 'nodejs';

/**
 * Nieuwsbrief-inschrijving met double opt-in (AVG). Zet de aanmelding klaar in
 * nieuwsbrief_inschrijvingen en stuurt een bevestigingsmail; pas na de klik op
 * de link telt het adres mee in de verzendlijst. Het antwoord is altijd
 * hetzelfde: de bezoeker hoeft niet te weten dat hij al ingeschreven stond.
 */
const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  naam: z.string().trim().max(120).optional().nullable(),
  bron: z.string().trim().max(200).optional().nullable(),
  website: z.string().max(200).optional().nullable(), // honeypot
});

export async function POST(req: Request) {
  // auth: publiek (nieuwsbriefinschrijving); beschermd met rate limit, honeypot en Zod.
  if (!(await publiekeLimiet('nieuwsbrief', clientIp(req), 5, 600_000))) {
    return NextResponse.json({ error: 'Te veel verzoeken. Probeer het later opnieuw.' }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { website?: unknown } | null;
  if (!body) {
    return NextResponse.json({ error: 'Ongeldige aanvraag.' }, { status: 400 });
  }

  // Honeypot: gevuld = bot, stil negeren.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Vul een geldig e-mailadres in.' }, { status: 422 });
  }
  const email = parsed.data.email;
  const naam = parsed.data.naam || null;
  const bron = parsed.data.bron || null;

  const res = await vraagInschrijvingAan({ email, naam, bron });
  if (!res.ok) {
    return NextResponse.json({ error: res.fout ?? 'Inschrijven lukte niet. Probeer het later opnieuw.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
