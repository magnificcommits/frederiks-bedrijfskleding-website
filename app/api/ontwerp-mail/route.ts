import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail, escapeHtml, emailLayout } from '@/lib/email';
import { env } from '@/lib/env';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { site } from '@/content/site';
import { saveLead } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * Zachte lead-capture vanuit de pakketsamensteller: de bezoeker mailt zichzelf
 * het ontwerp met een hervat-link, en Frederiks krijgt een warme lead binnen,
 * ook als de bezoeker de offerteaanvraag (nog) niet afrondt.
 */
const schema = z.object({
  name: z.string().max(120).optional().or(z.literal('')),
  email: z.string().email(),
  bericht: z.string().max(2000).optional().or(z.literal('')),
  resumeUrl: z.string().max(2000).optional().or(z.literal('')),
  logo: z.string().max(3_500_000).optional().or(z.literal('')),
  logoNaam: z.string().max(200).optional().or(z.literal('')),
  ontwerp: z.string().max(8_000_000).optional().or(z.literal('')), // PNG van het ontwerp uit de configurator
  bron: z.string().max(400).optional().or(z.literal('')),
  consent: z.union([z.literal('on'), z.boolean()]).optional(),
  website: z.string().max(200).optional(), // honeypot
});

export async function POST(req: Request) {
  if (!rateLimit(`ontwerp:${clientIp(req)}`, 5, 600_000)) {
    return NextResponse.json({ error: 'Te veel verzoeken. Probeer het later opnieuw.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Controleer je e-mailadres.' }, { status: 422 });
  }
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true }); // honeypot: stil negeren

  // Logo (optioneel) als bijlage meesturen.
  const attachments: { filename: string; content: string }[] = [];
  if (d.logo) {
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(d.logo);
    if (m) {
      const ext = m[1].split('/')[1].replace('svg+xml', 'svg').replace('jpeg', 'jpg');
      attachments.push({ filename: (d.logoNaam && d.logoNaam.trim()) || `logo.${ext}`, content: m[2] });
    }
  }
  if (d.ontwerp) {
    const mo = /^data:image\/png;base64,(.+)$/i.exec(d.ontwerp);
    if (mo) attachments.push({ filename: 'Jouw-ontwerp-Frederiks.png', content: mo[1] });
  }

  const berichtHtml = escapeHtml(d.bericht ?? '').replace(/\n/g, '<br>');
  // Alleen een hervat-link op de eigen site toestaan (geen open redirect in de mail).
  const veiligeResume = d.resumeUrl && d.resumeUrl.startsWith(site.url) ? d.resumeUrl : '';

  // Warme lead opslaan (best effort; faalt nooit het verzoek).
  await saveLead({
    name: d.name || 'Onbekend (ontwerp gemaild)',
    company: null,
    email: d.email,
    phone: null,
    branche: null,
    aantal: null,
    bericht: d.bericht || null,
    bron: `${d.bron ?? ''} | ontwerp gemaild, nog niet afgerond`.trim(),
  }).catch(() => ({ saved: false }));

  // Notificatie naar Frederiks: warme lead om proactief op te volgen.
  await sendEmail({
    to: env.notifyEmail,
    replyTo: d.email,
    attachments,
    subject: 'Ontwerp gemaild via de configurator (nog niet afgerond)',
    html: `
      <h3>Ontwerp gemaild via de pakketsamensteller</h3>
      <p>Deze bezoeker heeft zichzelf het ontwerp gemaild, maar nog geen offerte aangevraagd. Een mooi moment om proactief te bellen of mailen.</p>
      <p><strong>E-mail:</strong> ${escapeHtml(d.email)}</p>
      <p><strong>Naam:</strong> ${escapeHtml(d.name ?? '')}</p>
      <p><strong>Herkomst:</strong> ${escapeHtml(d.bron ?? '')}</p>
      <p><strong>Ontwerp:</strong><br>${berichtHtml}</p>
    `,
  }).catch(() => ({ sent: false }));

  // Het ontwerp plus hervat-link naar de bezoeker.
  await sendEmail({
    to: d.email,
    attachments,
    subject: 'Je samengestelde pakket bij Frederiks Bedrijfskleding',
    html: emailLayout({
      heading: 'Je samengestelde pakket',
      preheader: 'Ga verder waar je gebleven was en vraag je offerte vrijblijvend aan.',
      bodyHtml: `
        <p style="margin:0;">${d.name ? `Beste ${escapeHtml(d.name)},` : 'Hallo,'}</p>
        <p style="margin:14px 0 0;">Hier is het pakket dat je hebt samengesteld. Wil je verder of het als offerte aanvragen? We denken vrijblijvend mee en komen langs om te passen.</p>
        <div style="margin:16px 0;padding:14px 16px;background-color:#f6f5f4;border-radius:10px;color:#1c1c1c;font-size:14px;line-height:1.6;">${berichtHtml}</div>
        ${d.ontwerp ? `<p style="margin:14px 0 0;">Je volledige ontwerp met je logo op de kleding zie je in de bijgevoegde afbeelding.</p>` : ''}
        ${veiligeResume ? `<p style="margin:14px 0 0;"><a href="${veiligeResume}" style="display:inline-block;background-color:#ec6726;color:#ffffff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:8px;">Ga verder met je ontwerp</a></p>` : ''}
        <p style="margin:16px 0 0;">Liever even bellen of WhatsAppen? <strong style="color:#1c1c1c;">${escapeHtml(site.phone)}</strong>.</p>
      `,
    }),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
