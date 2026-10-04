/**
 * Herkomst van een weblead: gedeelde vorm tussen de bezoekerstracker in de
 * browser (lib/herkomst.ts), de API-routes en het KMS. Bevat geen imports
 * (ook geen zod), zodat hij licht blijft in de publieke bundel. De validatie
 * van wat de browser meestuurt staat in lib/leadHerkomstValidatie.ts.
 *
 * Privacy: geen IP, geen user-agent, geen fingerprint. Paden zonder querystring,
 * verwijzer alleen als hostnaam.
 */

/**
 * Via welke ingang een lead binnenkwam. Zelfde lijst als de check in de database
 * ('afspraak' komt er pas bij met supabase/handmatig/20261006_afspraak_bron_kanaal.sql;
 * tot dan slaat saveLead() zo'n lead op zonder bron_kanaal).
 */
export const BRON_KANALEN = ['formulier', 'configurator', 'selectie', 'kennismaking', 'afspraak', 'telefoon', 'handmatig'] as const;
export type BronKanaal = (typeof BRON_KANALEN)[number];

export const BRON_KANAAL_LABEL: Record<BronKanaal, string> = {
  formulier: 'Adviesformulier',
  configurator: 'Pakketconfigurator',
  selectie: 'Artikelselectie',
  kennismaking: 'Kennismakingsbrief',
  afspraak: 'Online afspraak',
  telefoon: 'Telefonisch',
  handmatig: 'Handmatig ingevoerd',
};

export function schoonBronKanaal(v: unknown): BronKanaal | null {
  const s = String(v ?? '').trim();
  return (BRON_KANALEN as readonly string[]).includes(s) ? (s as BronKanaal) : null;
}

export function bronKanaalLabel(v: string | null | undefined): string {
  const k = schoonBronKanaal(v);
  return k ? BRON_KANAAL_LABEL[k] : 'Onbekend';
}

/** Ingangen die van de website komen (en dus een melding en opvolgtaak krijgen). */
export const WEB_KANALEN: readonly BronKanaal[] = ['formulier', 'configurator', 'selectie', 'kennismaking', 'afspraak'];

/** Eén bekeken pagina: pad en seconden sinds de eerste pagina van de sessie. */
export type PadStap = { p: string; s: number };

export type Herkomst = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  gclid: string | null;
  referrer: string | null;
  landingspagina: string | null;
  conversiepagina: string | null;
  paginas_bekeken: number | null;
  bezochte_paden: PadStap[] | null;
  eerste_bezoek_op: string | null;
  bezoeken: number | null;
};

export const MAX_PADEN = 30;

/** "/assortiment/polo?x=1#a" -> "/assortiment/polo". Alles wat geen pad is wordt null. */
export function schoonPad(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s.startsWith('/') || s.startsWith('//')) return null;
  let pad = s.split(/[?#]/)[0].replace(/[^\w\-./%~]/g, '').slice(0, 200);
  // Persoonlijke links (kennismakingsbrief, drukproef, retour, afspraak beheren,
  // beoordeling, nieuwsbrief) zonder het token bewaren.
  pad = pad.replace(/^\/(kennismaking|k|drukproef|retour|afmelden|afspraak\/beheer|beoordeling|nieuwsbrief)\/.*$/, '/$1');
  return pad || '/';
}

/**
 * Paden die de bezoekerstracker overslaat: het KMS, het klantportaal, de
 * technische routes en alle pagina's achter een persoonlijke link (token in de URL).
 */
const TRACKER_OVERSLAAN = /^\/(dashboard|portaal|api|drukproef|retour|afmelden|k\/|afspraak\/beheer|beoordeling|nieuwsbrief\/)/;

export function trackerSlaatOver(pad: string | null | undefined): boolean {
  return !pad || TRACKER_OVERSLAAN.test(pad);
}

/** Alleen de hostnaam van de verwijzer, zonder www. */
export function schoneReferrer(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  try {
    const host = (s.includes('://') ? new URL(s).hostname : s.split('/')[0]).toLowerCase().replace(/^www\./, '');
    return /^[a-z0-9.-]{2,120}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

export function heeftHerkomst(h: Herkomst): boolean {
  return Object.values(h).some((v) => v !== null);
}

/** Korte leesbare tekst voor de oude `bron`-kolom en de mail ("bron=google, medium=cpc, verwijzing: ..."). */
export function herkomstTekst(h: Partial<Herkomst>): string {
  const delen: string[] = [];
  if (h.utm_source) delen.push(`bron=${h.utm_source}`);
  if (h.utm_medium) delen.push(`medium=${h.utm_medium}`);
  if (h.utm_campaign) delen.push(`campagne=${h.utm_campaign}`);
  if (h.gclid) delen.push('Google Ads (gclid)');
  if (h.referrer) delen.push(`verwijzing: ${h.referrer}`);
  if (!delen.length) delen.push('direct of onbekend');
  return delen.join(', ');
}

/* ------------------------------------------------------------------ */
/* Marketingkanaal                                                     */
/* ------------------------------------------------------------------ */

const ZOEKMACHINES = /(^|\.)(google|bing|duckduckgo|ecosia|yahoo|startpage|qwant)\./;
const SOCIAL = /(^|\.)(facebook|instagram|fb|lnkd|linkedin|t\.co|twitter|x|tiktok|pinterest|youtube)\./;

/**
 * Kanaal uit de gestructureerde herkomst. Null als er niets gestructureerd is,
 * dan valt de aanroeper terug op het ontleden van de oude bron-tekst.
 */
export function kanaalUitHerkomst(h: Partial<Pick<Herkomst, 'utm_source' | 'utm_medium' | 'gclid' | 'referrer' | 'landingspagina'>>): string | null {
  const src = (h.utm_source ?? '').toLowerCase();
  const med = (h.utm_medium ?? '').toLowerCase();
  const ref = (h.referrer ?? '').toLowerCase();
  if (h.gclid || (/google/.test(src) && /(cpc|ppc|paid)/.test(med))) return 'Google Ads';
  if (/(cpc|ppc|paid)/.test(med)) return src ? `Advertentie ${src}` : 'Advertentie';
  if (/linkedin/.test(src) || /linkedin|lnkd/.test(ref)) return 'LinkedIn';
  if (/^(facebook|instagram|meta|fb|ig)$/.test(src) || med === 'social' || SOCIAL.test(`.${ref}`)) return 'Social media';
  if (/e-?mail|nieuwsbrief|newsletter/.test(med) || /nieuwsbrief|mailchimp|brevo/.test(src)) return 'Nieuwsbrief of mailing';
  if (/gbp|bedrijfsprofiel|maps/.test(src) || /maps\.google|business\.google/.test(ref)) return 'Google Bedrijfsprofiel';
  if (/qr|brief|print|flyer/.test(src) || /qr|print|offline/.test(med)) return 'Brief of drukwerk';
  if (src) return src.charAt(0).toUpperCase() + src.slice(1);
  if (ref && ZOEKMACHINES.test(`.${ref}`)) return 'Zoekmachine';
  if (ref) return 'Andere website';
  if (h.landingspagina) return 'Direct of onbekend';
  return null;
}

/** Zet een pad om naar een korte groepsnaam voor de rapportage ("/branches/bouw" -> "/branches/bouw"). */
export function landingsGroep(pad: string | null | undefined): string {
  const p = schoonPad(pad);
  if (!p) return 'Onbekend';
  if (p === '/') return 'Homepage';
  const delen = p.split('/').filter(Boolean);
  // Productpagina's samenvoegen per categorie, anders wordt de lijst eindeloos.
  if (delen[0] === 'assortiment' && delen.length > 2) return `/assortiment/${delen[1]}/…`;
  return `/${delen.slice(0, 2).join('/')}`;
}

/* ------------------------------------------------------------------ */
/* Productregels                                                       */
/* ------------------------------------------------------------------ */

export type LeadRegelInvoer = {
  product_id: string | null;
  omschrijving: string;
  kleur: string | null;
  maat: string | null;
  aantal: number | null;
  opmerking: string | null;
};

/** Pagina's die op koopintentie wijzen, voor de leadscore. */
export function padSoort(p: string): 'prijs' | 'assortiment' | 'configurator' | 'branche' | 'overig' {
  if (/^\/(offerte|prijzen|tarieven|kledingbeheer|bedrukken-borduren)(\/|$)/.test(p)) return 'prijs';
  if (/^\/(pakket-samenstellen|kledingadvies)(\/|$)/.test(p)) return 'configurator';
  if (/^\/(assortiment|merk|werkkleding|werkschoenen|normen|maattabellen)(\/|$)/.test(p)) return 'assortiment';
  if (/^\/(branches|regio|voor|referenties)(\/|$)/.test(p)) return 'branche';
  return 'overig';
}
