import { uploadMediaMetNaam } from '@/lib/kms/storage';

/**
 * Uploads voor de drukproef-editor: logo's (PNG met doorzichtige achtergrond) en
 * foto's van de voor- of achterkant van een kledingstuk.
 *
 * We accepteren alleen PNG, JPG en WebP tot 10 MB. Behalve naar de bestandsnaam en
 * het opgegeven type kijken we ook naar de eerste bytes van het bestand: een
 * hernoemd ander bestand komt er zo niet doorheen. SVG weigeren we bewust, omdat
 * daar code in kan zitten.
 *
 * De bestanden gaan via de gewone opslag-helper naar bucket 'media', map drukproeven/.
 */

export const DRUKPROEF_MAX_BYTES = 10 * 1024 * 1024;

export const DRUKPROEF_SOORTEN = ['logo', 'voorkant', 'achterkant'] as const;
export type DrukproefBestandSoort = (typeof DRUKPROEF_SOORTEN)[number];

const TOEGESTAAN: Record<string, 'png' | 'jpg' | 'webp'> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/webp': 'webp',
};

const EXTENSIES: Record<string, 'png' | 'jpg' | 'webp'> = { png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp' };

/** Herken het echte bestandstype aan de eerste bytes. */
function soortUitBytes(b: Uint8Array): 'png' | 'jpg' | 'webp' | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) return 'webp';
  return null;
}

export type UploadUitkomst =
  | { ok: true; url: string; naam: string }
  | { ok: false; melding: string };

/**
 * Controleer een bestand. Geeft een melding in gewone taal terug als het niet goed is,
 * anders null.
 */
export async function controleerDrukproefBestand(file: File | null): Promise<string | null> {
  return (await herkenBestand(file)).fout;
}

const MIME: Record<'png' | 'jpg' | 'webp', string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

async function herkenBestand(file: File | null): Promise<{ fout: string | null; soort: 'png' | 'jpg' | 'webp' | null }> {
  const fout = (melding: string) => ({ fout: melding, soort: null });
  if (!file || typeof file === 'string' || file.size === 0) return fout('Kies eerst een bestand.');
  if (file.size > DRUKPROEF_MAX_BYTES) return fout('Dit bestand is groter dan 10 MB. Kies een kleiner bestand.');

  const punt = file.name.lastIndexOf('.');
  const ext = punt > 0 ? file.name.slice(punt + 1).toLowerCase() : '';
  const opgegeven = TOEGESTAAN[(file.type || '').toLowerCase()] ?? EXTENSIES[ext] ?? null;
  if (!opgegeven) return fout('Dit bestandstype kan niet. Gebruik een PNG, JPG of WebP.');

  const kop = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const echt = soortUitBytes(kop);
  if (!echt) return fout('Dit bestand is geen geldige PNG, JPG of WebP afbeelding.');
  return { fout: null, soort: echt };
}

/** Valideer en upload. De map hangt af van de soort: drukproeven/logos, drukproeven/fotos. */
export async function uploadDrukproefAfbeelding(file: File | null, soort: DrukproefBestandSoort): Promise<UploadUitkomst> {
  const { fout, soort: echt } = await herkenBestand(file);
  if (fout || !file || !echt) return { ok: false, melding: fout ?? 'Kies eerst een bestand.' };

  // Opslaan met het type dat de bytes zelf aangeven, zodat de browser hem altijd
  // als afbeelding toont (ook als iemand een JPG als .png heeft opgeslagen).
  const punt = file.name.lastIndexOf('.');
  const basis = (punt > 0 ? file.name.slice(0, punt) : file.name) || 'afbeelding';
  const schoon = new File([file], `${basis}.${echt}`, { type: MIME[echt] });

  const map = soort === 'logo' ? 'drukproeven/logos' : 'drukproeven/fotos';
  const resultaat = await uploadMediaMetNaam(schoon, map);
  if (!resultaat) return { ok: false, melding: 'Uploaden is niet gelukt. Probeer het nog een keer.' };
  return { ok: true, url: resultaat.url, naam: resultaat.origineleNaam };
}
