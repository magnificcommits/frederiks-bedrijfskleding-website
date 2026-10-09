import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import { ONTWERP_CID, ontwerpKlantHtml, ontwerpMeldingHtml } from '@/lib/mailSjablonen';
import { env, isLeadsDbConfigured } from '@/lib/env';
import { publiekeLimiet, clientIp } from '@/lib/ratelimit';
import { eigenSiteUrl, logoBijlage } from '@/lib/bijlagen';
import { site } from '@/content/site';
import { neemWebleadIn, type WebleadUitkomst } from '@/lib/kms/leadInname';
import { herkomstTekst } from '@/lib/leadHerkomst';
import { herkomstSchema, leadRegelsSchema, schoneHerkomst, schoneRegels } from '@/lib/leadHerkomstValidatie';

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
  herkomst: herkomstSchema.optional().nullable(),
  regels: leadRegelsSchema.optional().nullable(),
});

export async function POST(req: Request) {
  // auth: publiek (zachte leadcapture); beschermd met rate limit, honeypot en Zod.
  if (!(await publiekeLimiet('ontwerp', clientIp(req), 5, 600_000))) {
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
  // Deze mail gaat naar een adres dat de bezoeker zelf invult: geen SVG (kan script
  // bevatten) en nooit een zelfgekozen extensie.
  const logo = logoBijlage(d.logo, d.logoNaam, { svgToegestaan: false });
  if (logo) attachments.push(logo);
  let ontwerpPng: string | null = null;
  if (d.ontwerp) {
    const mo = /^data:image\/png;base64,(.+)$/i.exec(d.ontwerp);
    if (mo) {
      ontwerpPng = mo[1];
      attachments.push({ filename: 'Jouw-ontwerp-Frederiks.png', content: ontwerpPng });
    }
  }

  // Alleen een hervat-link op de eigen site toestaan (geen open redirect in de mail).
  // startsWith(site.url) liet ook https://<onze-site>.evil.nl door: vergelijk de origin.
  const veiligeResume = eigenSiteUrl(d.resumeUrl, site.url);

  // Warme lead in het KMS: lead, gekozen kleding als regels, logo in de logobibliotheek
  // en een opvolgtaak. Geen concept-offerte: de bezoeker heeft nog niets aangevraagd.
  const herkomst = schoneHerkomst(d.herkomst);
  const regels = schoneRegels(d.regels);
  const inname = await neemWebleadIn({
    lead: {
      name: d.name || 'Onbekend (ontwerp gemaild)',
      company: null,
      email: d.email,
      phone: null,
      branche: null,
      aantal: null,
      bericht: d.bericht || null,
      bron: `${d.bron || herkomstTekst(herkomst)} | ontwerp gemaild, nog niet afgerond`.slice(0, 400),
      bron_kanaal: 'configurator',
      ...herkomst,
    },
    regels,
    logo: d.logo ? { dataUrl: d.logo, naam: d.logoNaam || null } : null,
    opties: { offerte: false },
  }).catch((e): WebleadUitkomst => {
    console.error('[ontwerp-mail] inname mislukt:', e);
    return { opgeslagen: false, id: null, fout: e instanceof Error ? e.message : 'Onbekende fout', waarschuwingen: [] };
  });
  const dbFout = isLeadsDbConfigured && !inname.opgeslagen;
  const kmsLink = inname.id ? `${env.siteUrl.replace(/\/$/, '')}/dashboard/leads/${inname.id}` : null;

  // Notificatie naar Frederiks: warme lead om proactief op te volgen.
  await sendEmail({
    to: env.notifyEmail,
    replyTo: d.email,
    attachments,
    subject: `${dbFout ? 'LET OP, niet in het KMS: ' : ''}Ontwerp gemaild via de configurator (nog niet afgerond)`,
    html: ontwerpMeldingHtml({ dbFout, fout: inname.fout, kmsLink, email: d.email, name: d.name, bron: d.bron, bericht: d.bericht, heeftOntwerp: Boolean(ontwerpPng) }),
  }).catch(() => ({ sent: false }));

  // Het ontwerp plus hervat-link naar de bezoeker. Dezelfde bijlagen, maar de
  // ontwerp-PNG krijgt een content-id zodat hij ook in de mail zelf te zien is.
  await sendEmail({
    to: d.email,
    attachments: attachments.map((a) => (ontwerpPng && a.content === ontwerpPng ? { ...a, contentId: ONTWERP_CID } : a)),
    subject: 'Je samengestelde pakket bij Frederiks Bedrijfskleding',
    html: ontwerpKlantHtml({ name: d.name, bericht: d.bericht, resumeUrl: veiligeResume, heeftOntwerp: Boolean(ontwerpPng), regels }),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
