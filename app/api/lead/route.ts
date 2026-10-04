import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail, escapeHtml, emailLayout } from '@/lib/email';
import { env } from '@/lib/env';
import { publiekeLimiet, clientIp } from '@/lib/ratelimit';
import { logoBijlage } from '@/lib/bijlagen';
import { site } from '@/content/site';
import { neemWebleadIn, type WebleadUitkomst } from '@/lib/kms/leadInname';
import { isLeadsDbConfigured } from '@/lib/env';
import {
  BRON_KANAAL_LABEL,
  herkomstTekst,
  heeftHerkomst,
  schoonBronKanaal,
} from '@/lib/leadHerkomst';
import { herkomstSchema, leadRegelsSchema, schoneHerkomst, schoneRegels } from '@/lib/leadHerkomstValidatie';

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
  logo: z.string().max(3_500_000).optional().or(z.literal('')), // base64 data-URL uit de configurator
  logoNaam: z.string().max(200).optional().or(z.literal('')),
  ontwerp: z.string().max(8_000_000).optional().or(z.literal('')), // PNG van het samengestelde ontwerp
  consent: z.union([z.literal('on'), z.boolean()]).optional(),
  website: z.string().max(200).optional(), // honeypot
  // Ingang en gestructureerde herkomst (lib/herkomst.ts) en gekozen artikelen.
  bron_kanaal: z.string().max(40).optional().or(z.literal('')),
  herkomst: herkomstSchema.optional().nullable(),
  regels: leadRegelsSchema.optional().nullable(),
});

export async function POST(req: Request) {
  // auth: publiek (offerteformulier); beschermd met rate limit, honeypot en Zod.
  if (!(await publiekeLimiet('lead', clientIp(req), 5, 600_000))) {
    return NextResponse.json({ error: 'Te veel verzoeken. Probeer het later opnieuw.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Controleer de ingevulde gegevens.' }, { status: 422 });
  }
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true }); // honeypot: stil negeren
  // Elk formulier dat hierheen post heeft een verplicht akkoord-vinkje.
  if (d.consent !== true && d.consent !== 'on') {
    return NextResponse.json({ error: 'Zet een vinkje bij het akkoord, dan kunnen we je aanvraag beantwoorden.' }, { status: 422 });
  }

  const herkomst = schoneHerkomst(d.herkomst);
  const regels = schoneRegels(d.regels);
  const kanaal = schoonBronKanaal(d.bron_kanaal) ?? (regels.length ? 'selectie' : 'formulier');

  // Opslaan in het KMS: lead + regels + logo + opvolgtaak + concept-offerte.
  // Mislukt de database, dan gaat de mail toch (met een waarschuwing erin).
  const inname = await neemWebleadIn({
    lead: {
      name: d.name,
      company: d.company || null,
      email: d.email,
      phone: d.phone || null,
      branche: d.branche || null,
      aantal: d.aantal || null,
      bericht: d.bericht || null,
      bron: (d.bron || (heeftHerkomst(herkomst) ? herkomstTekst(herkomst) : '')).slice(0, 400) || null,
      bron_kanaal: kanaal,
      ...herkomst,
    },
    regels,
    logo: d.logo ? { dataUrl: d.logo, naam: d.logoNaam || null } : null,
  }).catch((e): WebleadUitkomst => {
    console.error('[lead] inname mislukt:', e);
    return { opgeslagen: false, id: null, fout: e instanceof Error ? e.message : 'Onbekende fout', waarschuwingen: [] };
  });
  const dbFout = isLeadsDbConfigured && !inname.opgeslagen;
  const kmsLink = inname.id ? `${env.siteUrl.replace(/\/$/, '')}/dashboard/leads/${inname.id}` : null;
  const regelsHtml = regels.length
    ? `<p><strong>Gekozen artikelen:</strong></p><ul>${regels
        .map((r) => `<li>${escapeHtml([r.omschrijving, r.kleur, r.maat ? `maat ${r.maat}` : null, r.aantal ? `${r.aantal}x` : null].filter(Boolean).join(', '))}${r.opmerking ? ` <em>(${escapeHtml(r.opmerking)})</em>` : ''}</li>`)
        .join('')}</ul>`
    : '';

  // Logo uit de configurator: als bijlage meesturen naar Frederiks.
  const attachments: { filename: string; content: string }[] = [];
  // Publieke route: geen SVG (kan script bevatten), en alleen wat aan de eerste bytes een afbeelding is.
  const logo = logoBijlage(d.logo, d.logoNaam, { svgToegestaan: false });
  if (logo) attachments.push(logo);
  if (d.ontwerp) {
    const mo = /^data:image\/png;base64,(.+)$/i.exec(d.ontwerp);
    if (mo) attachments.push({ filename: 'Ontwerp-configurator.png', content: mo[1] });
  }

  // Notificatie naar Frederiks (de lead).
  const sent = await sendEmail({
    to: env.notifyEmail,
    replyTo: d.email,
    attachments,
    subject: `${dbFout ? 'LET OP, niet in het KMS: ' : ''}Nieuwe offerte-/adviesaanvraag${d.company ? ` voor ${d.company}` : ''}`,
    html: `
      ${dbFout ? `<p style="padding:10px 12px;background:#fdecea;border:1px solid #f5c2c0;color:#8a1c14;"><strong>Deze aanvraag staat niet in het KMS.</strong> Opslaan in de database lukte niet${inname.fout ? ` (${escapeHtml(inname.fout)})` : ''}. Voer hem met de hand in bij Leads, anders valt hij buiten de opvolging.</p>` : ''}
      ${!dbFout && inname.waarschuwingen.length ? `<p style="padding:10px 12px;background:#fff6e5;border:1px solid #f3d9a4;">Staat in het KMS, maar: ${escapeHtml(inname.waarschuwingen.join(' '))}</p>` : ''}
      <h3>Nieuwe aanvraag via de website</h3>
      ${kmsLink ? `<p><a href="${kmsLink}">Open in het KMS</a>${inname.taak ? ` · taak voor ${escapeHtml(inname.taak.persoon ?? 'het team')} op ${escapeHtml(inname.taak.datum)} ${escapeHtml(inname.taak.tijd)}` : ''}${inname.offerte ? ` · concept-offerte ${inname.offerte.nummer ?? ''} klaargezet` : ''}</p>` : ''}
      <p><strong>Ingang:</strong> ${escapeHtml(BRON_KANAAL_LABEL[kanaal])}</p>
      <p><strong>Naam:</strong> ${escapeHtml(d.name)}</p>
      <p><strong>Bedrijf:</strong> ${escapeHtml(d.company ?? '')}</p>
      <p><strong>E-mail:</strong> ${escapeHtml(d.email)}</p>
      <p><strong>Telefoon:</strong> ${escapeHtml(d.phone ?? '')}</p>
      <p><strong>Branche:</strong> ${escapeHtml(d.branche ?? '')}</p>
      <p><strong>Aantal medewerkers:</strong> ${escapeHtml(d.aantal ?? '')}</p>
      <p><strong>Herkomst:</strong> ${escapeHtml(d.bron ?? '')}</p>
      ${herkomst.landingspagina ? `<p><strong>Eerste pagina:</strong> ${escapeHtml(herkomst.landingspagina)}${herkomst.paginas_bekeken ? ` · ${herkomst.paginas_bekeken} pagina's bekeken` : ''}</p>` : ''}
      <p><strong>Bericht:</strong><br>${escapeHtml(d.bericht ?? '').replace(/\n/g, '<br>')}</p>
      ${regelsHtml}
    `,
  }).catch((e) => ({ sent: false, error: e instanceof Error ? e.message : 'onbekend' }));

  // Niet opgeslagen en niet gemaild: dan is de aanvraag echt nergens. Zeg dat eerlijk.
  if (dbFout && !sent.sent) {
    console.error('[lead] aanvraag nergens vastgelegd:', inname.fout, 'error' in sent ? sent.error : '');
    return NextResponse.json(
      { error: `Je aanvraag kon niet worden verstuurd. Probeer het zo nog eens, of bel ons op ${site.phone}.` },
      { status: 502 },
    );
  }

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

  return NextResponse.json({ ok: true, emailed: sent.sent, opgeslagen: inname.opgeslagen });
}
