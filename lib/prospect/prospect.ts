import type { SupabaseClient } from '@supabase/supabase-js';
import { site } from '@/content/site';

/**
 * Gedeelde serverlogica voor de kennismakingsflow: prospect op token, bezoeken
 * loggen, de ene prospecttaak aanmaken of bijwerken. Alleen server-side.
 */

export type ProspectRij = {
  id: string;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  email: string | null;
  telefoon: string | null;
  branche: string | null;
  plaats: string | null;
  website: string | null;
  status: string;
  token: string;
  adres: string | null;
  postcode: string | null;
  logo_url: string | null;
  huisstijl_kleur: string | null;
  mockup_artikelen: unknown;
  eerste_scan_op: string | null;
  laatste_scan_op: string | null;
  aantal_scans: number | null;
  brief_verstuurd_op: string | null;
  afgemeld_op: string | null;
};

export const PROSPECT_VELDEN =
  'id, bedrijfsnaam, contactpersoon, email, telefoon, branche, plaats, website, status, token, adres, postcode, logo_url, huisstijl_kleur, mockup_artikelen, eerste_scan_op, laatste_scan_op, aantal_scans, brief_verstuurd_op, afgemeld_op';

/** Cookie waaraan de landingspagina ziet dat de bezoeker net via de QR-code kwam. */
export const QR_COOKIE = 'fb_qr';

/** Website uit de prospectlijst ("www.bedrijf.nl") als klikbare url. */
export function websiteHref(w: string): string {
  const t = w.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
}

/** Tokens zijn 10 hexadecimale tekens. Alles anders hoeft de database niet te zien. */
export const isGeldigToken = (t: string) => /^[0-9a-f]{10}$/i.test(t);

export async function prospectOpToken(sb: SupabaseClient, token: string): Promise<ProspectRij | null> {
  if (!isGeldigToken(token)) return null;
  const { data } = await sb.from('prospecten').select(PROSPECT_VELDEN).eq('token', token.toLowerCase()).maybeSingle();
  return (data as ProspectRij | null) ?? null;
}

/**
 * Link-previews (WhatsApp, Outlook, Slack), zoekmachines en scripts. Die tellen
 * niet als scan: anders belt Jessi iemand van wie alleen de mailscanner keek.
 */
const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|preview|facebookexternalhit|meta-externalagent|whatsapp|telegram|slack|discord|linkedin|twitter|skype|embedly|quora|pinterest|vkshare|w3c_validator|headless|lighthouse|python|curl|wget|go-http|okhttp|axios|node-fetch|undici|java\/|libwww|httpclient|scrapy|safebrowsing|google-read-aloud|bingpreview|microsoft office|ms-office|barracuda|proofpoint|mimecast|symantec|trendmicro|zgrab|nmap|monitor|uptime|pingdom/i;

export function isBot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? '').trim();
  if (ua.length < 12) return true;
  return BOT_UA.test(ua);
}

export type BezoekSoort = 'qr' | 'link' | 'portaal' | 'aanvraag';

export async function logBezoek(sb: SupabaseClient, prospectId: string, soort: BezoekSoort, pad: string): Promise<void> {
  try {
    await sb.from('prospect_bezoeken').insert({ prospect_id: prospectId, soort, pad: pad.slice(0, 300) });
  } catch {
    // Loggen mag de bezoeker nooit hinderen.
  }
}

/** Datum (YYYY-MM-DD) in Nederlandse tijd, met optioneel een aantal dagen erbij. */
export function datumNL(plusDagen = 0, nu = new Date()): string {
  const d = new Date(nu.getTime() + plusDagen * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function tijdNL(iso: string | Date = new Date()): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const dashboardProspectUrl = (id: string) => `${site.url}/dashboard/prospects/${id}`;
export const kennismakingUrl = (token: string) => `${site.url}/kennismaking/${token}`;
export const korteUrl = (token: string) => `${site.url}/k/${token}`;

type TaakVelden = {
  titel: string;
  omschrijving: string;
  prioriteit: 'laag' | 'normaal' | 'hoog';
  werkstatus: string;
  vervaldatum: string;
};

/**
 * Er is precies één taak per prospect (unieke index op prospect_id waar
 * bron = 'prospect'). Bestaat hij al, dan werken we hem bij als `bijwerken`
 * aan staat; anders laten we hem met rust. Geeft terug of er iets veranderde.
 */
export async function zetProspectTaak(
  sb: SupabaseClient,
  prospectId: string,
  velden: TaakVelden,
  opties: { bijwerken: boolean; omschrijvingAanvullen?: boolean },
): Promise<'aangemaakt' | 'bijgewerkt' | 'bestond' | 'fout'> {
  const { data: bestaand } = await sb
    .from('taken')
    .select('id, omschrijving')
    .eq('bron', 'prospect')
    .eq('prospect_id', prospectId)
    .maybeSingle();

  if (!bestaand) {
    const { error } = await sb.from('taken').insert({
      titel: velden.titel,
      omschrijving: velden.omschrijving,
      prioriteit: velden.prioriteit,
      werkstatus: velden.werkstatus,
      vervaldatum: velden.vervaldatum,
      toegewezen_aan: 'Jessi',
      status: 'open',
      soort: 'taak',
      bron: 'prospect',
      prospect_id: prospectId,
    });
    if (!error) return 'aangemaakt';
    // 23505: een gelijktijdige scan was ons net voor. Dan valt hij onder "bestond".
    if (error.code !== '23505') return 'fout';
    if (!opties.bijwerken) return 'bestond';
    const { data: alsnog } = await sb.from('taken').select('id, omschrijving').eq('bron', 'prospect').eq('prospect_id', prospectId).maybeSingle();
    if (!alsnog) return 'fout';
    return werkBij(sb, alsnog as { id: string; omschrijving: string | null }, velden, opties.omschrijvingAanvullen);
  }
  if (!opties.bijwerken) return 'bestond';
  return werkBij(sb, bestaand as { id: string; omschrijving: string | null }, velden, opties.omschrijvingAanvullen);
}

async function werkBij(
  sb: SupabaseClient,
  taak: { id: string; omschrijving: string | null },
  velden: TaakVelden,
  aanvullen?: boolean,
): Promise<'bijgewerkt' | 'fout'> {
  const omschrijving = aanvullen && taak.omschrijving
    ? `${velden.omschrijving}\n\n---\n${taak.omschrijving}`.slice(0, 8000)
    : velden.omschrijving;
  const { error } = await sb
    .from('taken')
    .update({
      titel: velden.titel,
      omschrijving,
      prioriteit: velden.prioriteit,
      werkstatus: velden.werkstatus,
      vervaldatum: velden.vervaldatum,
      status: 'open',
      afgerond_op: null,
    })
    .eq('id', taak.id);
  return error ? 'fout' : 'bijgewerkt';
}
