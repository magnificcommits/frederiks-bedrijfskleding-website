import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail, escapeHtml, emailLayout } from '@/lib/email';
import { env } from '@/lib/env';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { site } from '@/content/site';
import { saveLead } from '@/lib/supabase';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().min(2).max(120),
  company: z.string().max(160).optional().or(z.literal('')),
  email: z.string().email(),
  phone: z.string().max(40).optional().or(z.literal('')),
  branche: z.string().max(80).optional().or(z.literal('')),
  aantal: z.string().max(40).optional().or(z.literal('')),
  bericht: z.string().max(2000).optional().or(z.literal('')),
  bron: z.string().max(400).optional().or(z.literal('')),
  consent: z.union([z.literal('on'), z.boolean()]).optional(),
  website: z.string().max(200).optional(), // honeypot
});

export async function POST(req: Request) {
  if (!rateLimit(`lead:${clientIp(req)}`, 5, 600_000)) {
    return NextResponse.json({ error: 'Te veel verzoeken. Probeer het later opnieuw.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Controleer de ingevulde gegevens.' }, { status: 422 });
  }
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true }); // honeypot: stil negeren

  // Opslaan in de leaddatabase (best effort; faalt nooit de aanvraag).
  await saveLead({
    name: d.name,
    company: d.company || null,
    email: d.email,
    phone: d.phone || null,
    branche: d.branche || null,
    aantal: d.aantal || null,
    bericht: d.bericht || null,
    bron: d.bron || null,
  }).catch(() => ({ saved: false }));

  // Notificatie naar Frederiks (de lead).
  const sent = await sendEmail({
    to: env.notifyEmail,
    replyTo: d.email,
    subject: `Nieuwe offerte-/adviesaanvraag${d.company ? ` voor ${d.company}` : ''}`,
    html: `
      <h3>Nieuwe aanvraag via de website</h3>
      <p><strong>Naam:</strong> ${escapeHtml(d.name)}</p>
      <p><strong>Bedrijf:</strong> ${escapeHtml(d.company ?? '')}</p>
      <p><strong>E-mail:</strong> ${escapeHtml(d.email)}</p>
      <p><strong>Telefoon:</strong> ${escapeHtml(d.phone ?? '')}</p>
      <p><strong>Branche:</strong> ${escapeHtml(d.branche ?? '')}</p>
      <p><strong>Aantal medewerkers:</strong> ${escapeHtml(d.aantal ?? '')}</p>
      <p><strong>Herkomst:</strong> ${escapeHtml(d.bron ?? '')}</p>
      <p><strong>Bericht:</strong><br>${escapeHtml(d.bericht ?? '').replace(/\n/g, '<br>')}</p>
    `,
  }).catch(() => ({ sent: false }));

  // Bevestiging naar de klant (best effort).
  await sendEmail({
    to: d.email,
    subject: 'Bedankt voor je aanvraag bij Frederiks Bedrijfskleding',
    html: emailLayout({
      heading: 'Bedankt voor je aanvraag',
      preheader: 'We nemen zo snel mogelijk persoonlijk contact met je op.',
      bodyHtml: `
        <p style="margin:0;">Beste ${escapeHtml(d.name)},</p>
        <p style="margin:14px 0 0;">Bedankt voor je bericht aan Frederiks Bedrijfskleding. We nemen zo snel mogelijk persoonlijk contact met je op om je wensen door te nemen en passend advies te geven.</p>
        <p style="margin:14px 0 0;">Heb je een dringende vraag? Bel of WhatsApp gerust: <strong style="color:#1c1c1c;">${escapeHtml(site.phone)}</strong>.</p>
      `,
    }),
  }).catch(() => {});

  return NextResponse.json({ ok: true, emailed: sent.sent });
}
