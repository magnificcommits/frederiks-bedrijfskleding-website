import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail, escapeHtml } from '@/lib/email';
import { env } from '@/lib/env';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { site } from '@/content/site';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().min(2).max(120),
  company: z.string().max(160).optional().or(z.literal('')),
  email: z.string().email(),
  phone: z.string().max(40).optional().or(z.literal('')),
  branche: z.string().max(80).optional().or(z.literal('')),
  aantal: z.string().max(40).optional().or(z.literal('')),
  bericht: z.string().max(2000).optional().or(z.literal('')),
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
      <p><strong>Bericht:</strong><br>${escapeHtml(d.bericht ?? '').replace(/\n/g, '<br>')}</p>
    `,
  }).catch(() => ({ sent: false }));

  // Bevestiging naar de klant (best effort).
  await sendEmail({
    to: d.email,
    subject: 'Bedankt voor je aanvraag bij Frederiks Bedrijfskleding',
    html: `
      <div style="font-family:Inter,Arial,sans-serif;color:#1b2430;max-width:560px;margin:0 auto">
        <h2 style="color:#2f4a6b">Bedankt voor je aanvraag</h2>
        <p>Beste ${escapeHtml(d.name)},</p>
        <p>Bedankt voor je bericht aan Frederiks Bedrijfskleding. We nemen zo snel mogelijk persoonlijk contact met je op om je wensen door te nemen en passend advies te geven.</p>
        <p>Heb je een dringende vraag? Bel of WhatsApp gerust: <strong>${escapeHtml(site.phone)}</strong>.</p>
        <p style="color:#4a4f57;font-size:13px;margin-top:24px">${escapeHtml(site.name)} · ${escapeHtml(site.address.street)}, ${escapeHtml(site.address.postalCode)} ${escapeHtml(site.address.city)} · ${escapeHtml(site.phone)}</p>
      </div>
    `,
  }).catch(() => {});

  return NextResponse.json({ ok: true, emailed: sent.sent });
}
