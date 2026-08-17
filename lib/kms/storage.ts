import { createClient } from '@supabase/supabase-js';
import { env, isLeadsDbConfigured } from '@/lib/env';

/**
 * Uploads naar de publieke opslag-bucket 'media'.
 *
 * De opslagnaam is en blijft bewust gegenereerd (tijdstempel + willekeurig stukje):
 * twee klanten die allebei 'logo.pdf' aanleveren mogen elkaar niet overschrijven.
 * Gevolg was wel dat een download 'logos/1718...-a3f9c1.pdf' heette. Daarom geeft
 * uploadMediaMetNaam() de ORIGINELE bestandsnaam apart terug; die bewaren we in de
 * database en plakken we bij het downloaden weer terug via downloadUrl().
 */

/** Vast stuk van elke publieke Supabase-Storage-URL. Zie downloadUrl(). */
const PUBLIEK_PAD = '/storage/v1/object/public/';

/**
 * Content-type per extensie, als terugval wanneer de browser zelf niets meestuurt.
 * Zonder dit valt Supabase terug op text/plain en weigert de PDF-preview te openen.
 */
const MIME_PER_EXTENSIE: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ai: 'application/postscript',
  eps: 'application/postscript',
};

export type Upload = {
  /** Publieke URL van het opgeslagen bestand. */
  url: string;
  /** De naam zoals het bestand op de computer van de gebruiker heette. */
  origineleNaam: string;
};

/** Knip een naam af maar houd de extensie heel, anders opent Windows hem niet meer. */
function kortNaam(naam: string, max = 120): string {
  if (naam.length <= max) return naam;
  const punt = naam.lastIndexOf('.');
  if (punt <= 0) return naam.slice(0, max);
  const extensie = naam.slice(punt);
  return naam.slice(0, Math.max(1, max - extensie.length)) + extensie;
}

/**
 * Maak een aangeleverde bestandsnaam veilig om in een Content-Disposition-header
 * te zetten. Accenten worden platgeslagen (é wordt e): een header met UTF-8 erin
 * levert in sommige browsers een onleesbare downloadnaam op, en een leesbare
 * benadering is beter dan een kapotte download.
 */
export function schoneBestandsnaam(ruw: string): string {
  const zonderPad = ruw.split(/[\\/]/).pop() ?? '';
  const plat = zonderPad.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const veilig = plat
    .replace(/[^A-Za-z0-9 ._()-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return kortNaam(veilig);
}

/**
 * Upload een bestand en geef zowel de publieke URL als de originele bestandsnaam
 * terug. Server-side via de service-role. Geeft null bij geen bestand of fout.
 */
export async function uploadMediaMetNaam(file: File | null, prefix: string): Promise<Upload | null> {
  if (!isLeadsDbConfigured || !file || file.size === 0) return null;
  const sb = createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false } });
  // Een naam zonder punt ('logo') heeft geen extensie. split('.').pop() geeft dan
  // de hele naam terug en we zouden het bestand als '.logo' wegschrijven; daarna
  // klopt het content-type niet meer en toont de preview alleen nog een blokje.
  const punt = file.name.lastIndexOf('.');
  const ext = (punt > 0 ? file.name.slice(punt + 1) : '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const veiligPrefix = prefix.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'overig';
  const naam = `${veiligPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || 'bin'}`;
  const buf = Buffer.from(await file.arrayBuffer());
  // application/octet-stream betekent "ik weet het niet" en telt dus als niets
  // meegestuurd. Zou dat als content-type blijven staan, dan weigert de browser
  // de PDF-preview te openen en biedt hij het bestand alleen nog aan als download.
  const meegestuurdType = file.type && file.type !== 'application/octet-stream' ? file.type : '';
  const { error } = await sb.storage.from('media').upload(naam, buf, {
    contentType: meegestuurdType || MIME_PER_EXTENSIE[ext] || undefined,
    upsert: false,
  });
  if (error) return null;
  const { data } = sb.storage.from('media').getPublicUrl(naam);
  const url = data.publicUrl;
  if (!url) return null;
  return { url, origineleNaam: schoneBestandsnaam(file.name) || `bestand.${ext || 'bin'}` };
}

/**
 * Zelfde upload, maar alleen de URL. Blijft bestaan voor de aanroepers die de
 * originele naam (nog) niet bewaren.
 */
export async function uploadMedia(file: File | null, prefix: string): Promise<string | null> {
  const resultaat = await uploadMediaMetNaam(file, prefix);
  return resultaat?.url ?? null;
}

/**
 * Maak van een opslag-URL een downloadlink die het bestand onder zijn originele
 * naam opslaat. Supabase Storage zet bij ?download=<naam> zelf een
 * Content-Disposition-header; dat werkt wel over domeinen heen, terwijl het
 * download-attribuut op een link juist genegeerd wordt zodra het bestand van een
 * ander domein komt. Bij een geplakte externe URL of een onbekende naam geven we
 * de URL onveranderd terug.
 */
export function downloadUrl(url: string | null | undefined, origineleNaam?: string | null): string | null {
  if (!url) return null;
  const naam = origineleNaam?.trim();
  if (!naam || !url.includes(PUBLIEK_PAD)) return url;
  const scheiding = url.includes('?') ? '&' : '?';
  return `${url}${scheiding}download=${encodeURIComponent(naam)}`;
}
