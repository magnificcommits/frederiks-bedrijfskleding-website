import { randomBytes } from 'node:crypto';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { env } from '@/lib/env';
import { site } from '@/content/site';
import { emailLayout, escapeHtml, sendEmail } from '@/lib/email';

/**
 * Double opt-in voor de nieuwsbrief (AVG). Een aanmelding via de site is pas
 * actief na een klik op de link in de bevestigingsmail (bevestigd_op). Tot die
 * tijd staat het adres niet in de verzendlijst (zie lib/kms/nieuwsbrief.ts).
 *
 * Rijen zonder bevestig_token komen van vóór de double opt-in, van het dashboard
 * of van een afmelding; die gelden niet als "wacht op bevestiging".
 */

const TOKEN = /^[A-Za-z0-9_-]{20,80}$/;
/** Niet vaker dan dit een nieuwe bevestigingsmail naar hetzelfde adres. */
const OPNIEUW_NA_MS = 10 * 60_000;

type Rij = {
  id: string;
  email: string | null;
  naam: string | null;
  afgemeld: boolean | null;
  bevestigd_op: string | null;
  bevestig_token: string | null;
  bevestiging_verstuurd_op: string | null;
};

function kolomOntbreekt(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42703' || error.code === 'PGRST204' || /bevestig/i.test(error.message ?? '');
}

export function bevestigUrl(token: string): string {
  return `${env.siteUrl.replace(/\/$/, '')}/nieuwsbrief/bevestigen?t=${encodeURIComponent(token)}`;
}

async function stuurBevestiging(email: string, naam: string | null, token: string): Promise<boolean> {
  const voornaam = (naam ?? '').trim().split(/\s+/)[0];
  const html = emailLayout({
    heading: 'Klopt dit adres?',
    preheader: 'Eén klik en je staat op de lijst voor de nieuwsbrief.',
    bodyHtml: `
      <p style="margin:0;">${voornaam ? `Hoi ${escapeHtml(voornaam)},` : 'Hoi,'}</p>
      <p style="margin:14px 0 0;">Je hebt je aangemeld voor de nieuwsbrief van Frederiks Bedrijfskleding. Bevestig even dat dit jouw adres is, dan zetten we je op de lijst.</p>
      <p style="margin:18px 0 0;"><a href="${escapeHtml(bevestigUrl(token))}" style="display:inline-block;background-color:#ec6726;color:#ffffff;font-weight:700;text-decoration:none;padding:11px 18px;border-radius:8px;">Ja, schrijf me in</a></p>
      <p style="margin:18px 0 0;">Heb je je niet aangemeld? Dan hoef je niets te doen. Zonder bevestiging sturen we je niets.</p>
      <p style="margin:18px 0 0;">Groet,<br/>Jessi Frederiks</p>
    `,
  });
  const res = await sendEmail({ to: email, replyTo: site.email, subject: 'Bevestig je aanmelding voor de nieuwsbrief', html }).catch(() => ({ sent: false }));
  return res.sent;
}

/**
 * Aanmelding verwerken. Geeft altijd hetzelfde antwoord terug (ok), zodat de
 * site niet verraadt of een adres al op de lijst staat.
 */
export async function vraagInschrijvingAan(invoer: { email: string; naam: string | null; bron: string | null }): Promise<{ ok: boolean; fout?: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: true };
  const email = invoer.email.trim().toLowerCase();
  const patroon = email.replace(/[\\%_]/g, (t) => `\\${t}`);

  const res = await sb
    .from('nieuwsbrief_inschrijvingen')
    .select('id, email, naam, afgemeld, bevestigd_op, bevestig_token, bevestiging_verstuurd_op')
    .ilike('email', patroon);

  if (res.error && kolomOntbreekt(res.error)) {
    // Migratie nog niet gedraaid: oude gedrag (direct inschrijven).
    const { error } = await sb.from('nieuwsbrief_inschrijvingen').insert({ email, naam: invoer.naam, bron: invoer.bron });
    if (error && error.code !== '23505') return { ok: false, fout: 'Inschrijven lukte niet. Probeer het later opnieuw.' };
    return { ok: true };
  }
  if (res.error) return { ok: false, fout: 'Inschrijven lukte niet. Probeer het later opnieuw.' };

  const rij = ((res.data as Rij[]) ?? []).find((r) => (r.email ?? '').trim().toLowerCase() === email);
  const actief = rij && rij.afgemeld !== true && (rij.bevestigd_op !== null || rij.bevestig_token === null);
  if (actief) return { ok: true };

  const nu = Date.now();
  if (rij?.bevestiging_verstuurd_op && nu - new Date(rij.bevestiging_verstuurd_op).getTime() < OPNIEUW_NA_MS) return { ok: true };

  const token = rij?.bevestig_token && TOKEN.test(rij.bevestig_token) ? rij.bevestig_token : randomBytes(24).toString('base64url');
  const stempel = new Date(nu).toISOString();
  if (rij) {
    const { error } = await sb
      .from('nieuwsbrief_inschrijvingen')
      .update({ bevestig_token: token, bevestiging_verstuurd_op: stempel, ...(invoer.naam && !rij.naam ? { naam: invoer.naam } : {}) })
      .eq('id', rij.id);
    if (error) return { ok: false, fout: 'Inschrijven lukte niet. Probeer het later opnieuw.' };
  } else {
    const { error } = await sb.from('nieuwsbrief_inschrijvingen').insert({
      email,
      naam: invoer.naam,
      bron: invoer.bron,
      bevestig_token: token,
      bevestiging_verstuurd_op: stempel,
    });
    if (error && error.code !== '23505') return { ok: false, fout: 'Inschrijven lukte niet. Probeer het later opnieuw.' };
  }
  await stuurBevestiging(email, invoer.naam ?? rij?.naam ?? null, token);
  return { ok: true };
}

export type BevestigStand = 'onbekend' | 'te-bevestigen' | 'bevestigd';

export async function inschrijvingStand(token: string): Promise<BevestigStand> {
  const sb = kmsAdmin();
  if (!sb || !TOKEN.test(String(token ?? ''))) return 'onbekend';
  const { data } = await sb.from('nieuwsbrief_inschrijvingen').select('afgemeld, bevestigd_op').eq('bevestig_token', token).maybeSingle();
  const r = data as { afgemeld: boolean | null; bevestigd_op: string | null } | null;
  if (!r) return 'onbekend';
  return r.bevestigd_op && r.afgemeld !== true ? 'bevestigd' : 'te-bevestigen';
}

/** Klik op de bevestiglink: actief maken (en een eerdere afmelding via de nieuwsbrieflijst opheffen). */
export async function bevestigInschrijving(token: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !TOKEN.test(String(token ?? ''))) return false;
  const { data, error } = await sb
    .from('nieuwsbrief_inschrijvingen')
    .update({ bevestigd_op: new Date().toISOString(), afgemeld: false })
    .eq('bevestig_token', token)
    .select('id');
  return !error && ((data as unknown[]) ?? []).length > 0;
}
