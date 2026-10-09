'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { neemWebleadIn } from '@/lib/kms/leadInname';
import { sendEmail } from '@/lib/email';
import { pasdagBevestigingHtml, pasdagMeldingHtml, prospectAfgemeldHtml } from '@/lib/mailSjablonen';
import { env } from '@/lib/env';
import { publiekeLimiet, rateLimit } from '@/lib/ratelimit';
import { site } from '@/content/site';
import { meldAdres } from '@/content/kennismaking';
import {
  dashboardProspectUrl,
  datumNL,
  isGeldigToken,
  logBezoek,
  prospectOpToken,
  tijdNL,
  zetProspectTaak,
} from '@/lib/prospect/prospect';

/**
 * Publieke acties op de kennismakingspagina. Geen dashboard-login: de bezoeker
 * is de prospect zelf. Daarom rate limit, honeypot en strakke validatie.
 */

export type PasdagStaat = { ok: boolean; fout: string | null };

const schema = z.object({
  naam: z.string().trim().min(2, 'Vul je naam in.').max(120),
  telefoon: z.string().trim().max(40).optional().default(''),
  email: z.union([z.string().trim().email('Dat e-mailadres klopt niet helemaal.').max(160), z.literal('')]).optional().default(''),
  aantal: z.string().trim().max(40).optional().default(''),
  opmerking: z.string().trim().max(2000).optional().default(''),
});

async function ipAdres(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'onbekend';
}

export async function pasdagAanvraagActie(_vorige: PasdagStaat, formData: FormData): Promise<PasdagStaat> {
  const token = String(formData.get('token') ?? '').trim().toLowerCase();
  if (!isGeldigToken(token)) return { ok: false, fout: 'Deze link klopt niet. Bel ons gerust even.' };

  // Honeypot: mensen zien dit veld niet, bots vullen het in.
  if (String(formData.get('bedrijfswebsite') ?? '').trim()) return { ok: true, fout: null };

  const ip = await ipAdres();
  if (!rateLimit(`pasdag-token:${token}`, 10, 3_600_000) || !(await publiekeLimiet('pasdag', ip, 5, 600_000))) {
    return { ok: false, fout: `Er kwamen net al een paar aanvragen binnen. Probeer het later nog eens, of bel ${site.phone}.` };
  }

  const parsed = schema.safeParse({
    naam: formData.get('naam') ?? '',
    telefoon: formData.get('telefoon') ?? '',
    email: formData.get('email') ?? '',
    aantal: formData.get('aantal') ?? '',
    opmerking: formData.get('opmerking') ?? '',
  });
  if (!parsed.success) return { ok: false, fout: parsed.error.issues[0]?.message ?? 'Controleer de ingevulde gegevens.' };
  const d = parsed.data;
  if (!d.telefoon && !d.email) return { ok: false, fout: 'Vul een telefoonnummer of e-mailadres in, dan kan ik je bereiken.' };

  const sb = kmsAdmin();
  const p = sb ? await prospectOpToken(sb, token).catch(() => null) : null;
  if (sb && (!p || p.afgemeld_op)) return { ok: false, fout: `Deze link werkt niet meer. Bel ons gerust: ${site.phone}.` };

  const bedrijf = p?.bedrijfsnaam ?? 'Onbekend bedrijf';
  const bericht = [
    'Pasdag-aanvraag via de kennismakingsbrief.',
    d.aantal ? `Aantal medewerkers: ${d.aantal}` : null,
    d.opmerking ? `Voorkeur / opmerking: ${d.opmerking}` : null,
  ].filter(Boolean).join('\n');

  // 1. Lead in het KMS. De opvolgtaak maakt zetProspectTaak hieronder al, dus hier niet nog een.
  const inname = await neemWebleadIn({
    lead: {
      name: d.naam,
      company: bedrijf,
      email: d.email || p?.email || '',
      phone: d.telefoon || null,
      branche: p?.branche ?? null,
      aantal: d.aantal || null,
      bericht,
      bron: `Kennismakingsbrief (QR) | ${token}`,
      bron_kanaal: 'kennismaking',
      utm_source: 'brief',
      utm_medium: 'qr',
      landingspagina: '/kennismaking',
      conversiepagina: '/kennismaking',
    },
    opties: { taak: false, offerte: false },
  }).catch((e) => {
    console.error('[kennismaking] lead opslaan mislukt:', e);
    return null;
  });
  if (inname && !inname.opgeslagen) console.error('[kennismaking] lead niet opgeslagen:', inname.fout);

  if (sb && p) {
    try {
      await logBezoek(sb, p.id, 'aanvraag', `/kennismaking/${token}`);

      await zetProspectTaak(
        sb,
        p.id,
        {
          titel: `Pasdag-aanvraag ${bedrijf}`,
          omschrijving: [
            `Pasdag aangevraagd op ${tijdNL()}.`,
            `Naam: ${d.naam}`,
            d.telefoon ? `Telefoon: ${d.telefoon}` : null,
            d.email ? `E-mail: ${d.email}` : null,
            d.aantal ? `Aantal medewerkers: ${d.aantal}` : null,
            d.opmerking ? `Voorkeur / opmerking: ${d.opmerking}` : null,
            `Prospect: ${dashboardProspectUrl(p.id)}`,
          ].filter(Boolean).join('\n'),
          prioriteit: 'hoog',
          werkstatus: 'Pasafspraak plannen',
          vervaldatum: datumNL(0),
        },
        { bijwerken: true, omschrijvingAanvullen: true },
      );

      // Prospect bijwerken: alleen velden die we echt willen zetten (geen nulls).
      const patch: Record<string, unknown> = { laatste_contact: new Date().toISOString() };
      if (!['klant', 'gekwalificeerd'].includes(p.status)) patch.status = 'reageerde';
      if (!p.contactpersoon) patch.contactpersoon = d.naam;
      if (!p.telefoon && d.telefoon) patch.telefoon = d.telefoon;
      if (!p.email && d.email) patch.email = d.email;
      await sb.from('prospecten').update(patch).eq('id', p.id);

      await logAudit('prospect.pasdag_aanvraag', { entiteit: 'prospect', entiteitId: p.id, actor: 'kennismakingspagina', details: { naam: d.naam } });
    } catch {
      // Niet erg: de lead en de mail hieronder dragen de aanvraag ook.
    }
  }

  // 2. Melding naar Jessi.
  await sendEmail({
    to: meldAdres(env.notifyEmail),
    ...(d.email ? { replyTo: d.email } : {}),
    subject: `Pasdag-aanvraag: ${bedrijf}${d.telefoon ? ` (${d.telefoon})` : ''}`,
    html: pasdagMeldingHtml({ bedrijf, naam: d.naam, telefoon: d.telefoon, email: d.email, aantal: d.aantal, opmerking: d.opmerking, prospectUrl: p ? dashboardProspectUrl(p.id) : null }),
  }).catch(() => ({ sent: false }));

  // 3. Bevestiging naar de aanvrager (als er een e-mailadres is).
  if (d.email) {
    await sendEmail({
      to: d.email,
      subject: 'Je pasdag-aanvraag is binnen',
      html: pasdagBevestigingHtml({ naam: d.naam, bedrijf }),
    }).catch(() => ({ sent: false }));
  }

  revalidatePath('/dashboard/prospects');
  return { ok: true, fout: null };
}

/** "Geen interesse": prospect afmelden. Daarna krijgt hij geen brief of mail meer. */
export async function afmeldenActie(formData: FormData) {
  const token = String(formData.get('token') ?? '').trim().toLowerCase();
  if (!isGeldigToken(token)) redirect('/');
  const ip = await ipAdres();
  if (!rateLimit(`afmelden:${ip}`, 10, 600_000)) redirect(`/kennismaking/${token}/afmelden`);

  const sb = kmsAdmin();
  if (sb) {
    try {
      const p = await prospectOpToken(sb, token);
      if (p && !p.afgemeld_op) {
        await sb.from('prospecten').update({ afgemeld_op: new Date().toISOString(), status: 'afgemeld' }).eq('id', p.id);
        // Openstaande beltaak heeft geen zin meer.
        await sb.from('taken').update({ status: 'klaar', werkstatus: 'Afgerond', afgerond_op: new Date().toISOString() })
          .eq('bron', 'prospect').eq('prospect_id', p.id).eq('status', 'open');
        await logAudit('prospect.afgemeld', { entiteit: 'prospect', entiteitId: p.id, actor: 'kennismakingspagina' });
        await sendEmail({
          to: meldAdres(env.notifyEmail),
          subject: `${p.bedrijfsnaam} heeft geen interesse`,
          html: prospectAfgemeldHtml(p.bedrijfsnaam),
        }).catch(() => ({ sent: false }));
        revalidatePath('/dashboard/prospects');
      }
    } catch {
      // Stil: de bevestiging hieronder tonen we hoe dan ook.
    }
  }
  redirect(`/kennismaking/${token}/afmelden?klaar=1`);
}
