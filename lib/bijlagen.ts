/**
 * Logo-bijlage uit een data-URL van de configurator (lead- en ontwerpformulier).
 *
 * Beveiliging: de bestandsnaam komt van de bezoeker. Zonder controle kon iemand een
 * "afbeelding" als `factuur.html` laten mailen vanaf ons domein. Daarom:
 *  - alleen png, jpg, webp, gif (en svg als dat expliciet mag);
 *  - de eerste bytes moeten bij dat soort bestand horen (controleerLogo);
 *  - de extensie volgt altijd het gecontroleerde type, nooit de opgegeven naam;
 *  - de naam wordt opgeschoond (letters, cijfers, spatie, punt, streepje).
 */
const EXTENSIE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

export type BestandSoort = 'png' | 'jpg' | 'webp' | 'gif' | 'pdf';

const MIME_VAN_SOORT: Record<BestandSoort, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
};

/**
 * Wat een bestand echt is, afgelezen aan de eerste bytes. Het type dat de
 * browser meestuurt is door de afzender te kiezen; deze bytes niet zonder dat
 * het bestand onbruikbaar wordt als afbeelding.
 */
export function herkenBestand(b: Uint8Array): BestandSoort | null {
  const begint = (...bytes: number[]) => b.length >= bytes.length && bytes.every((v, i) => b[i] === v);
  if (begint(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
  if (begint(0xff, 0xd8, 0xff)) return 'jpg';
  if (begint(0x47, 0x49, 0x46, 0x38) && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return 'gif';
  // RIFF....WEBP
  if (begint(0x52, 0x49, 0x46, 0x46) && b.length >= 12 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  if (begint(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'pdf';
  return null;
}

export type GecontroleerdLogo = {
  /** Het gecontroleerde type, niet wat de afzender opgaf. */
  mime: string;
  /** Extensie die bij dat type hoort. */
  ext: string;
  /** De inhoud, base64 zonder witruimte. */
  base64: string;
  bytes: Buffer;
};

/**
 * Controleert een logo uit een data-URL: toegestaan type, niet te groot, en de
 * eerste bytes moeten bij een afbeelding horen. Type en extensie in de uitkomst
 * komen uit die bytes. SVG is tekst (kan script bevatten) en mag alleen als de
 * aanroeper dat expliciet toestaat; op publieke routes dus niet.
 */
export function controleerLogo(
  dataUrl: string | undefined | null,
  opties: { svgToegestaan?: boolean; maxBytes?: number } = {},
): GecontroleerdLogo | null {
  if (!dataUrl) return null;
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!m) return null;
  const opgegeven = EXTENSIE[m[1].toLowerCase()];
  if (!opgegeven) return null;
  const base64 = m[2].replace(/\s+/g, '');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length) return null;
  if (opties.maxBytes && bytes.length > opties.maxBytes) return null;
  if (opgegeven === 'svg') {
    if (!opties.svgToegestaan) return null;
    if (!/<svg[\s>]/i.test(bytes.subarray(0, 4096).toString('utf8'))) return null;
    return { mime: 'image/svg+xml', ext: 'svg', base64, bytes };
  }
  const soort = herkenBestand(bytes);
  // PDF is geen logo-afbeelding; een bestand dat zich als afbeelding voordoet maar iets anders is, weigeren we.
  if (!soort || soort === 'pdf') return null;
  return { mime: MIME_VAN_SOORT[soort], ext: soort, base64, bytes };
}

/** Bestandsnaam van de bezoeker opschonen; de extensie komt altijd van het gecontroleerde type. */
export function logoBestandsnaam(naamRuw: string | undefined | null, ext: string): string {
  const basis = String(naamRuw ?? '')
    .replace(/\.[^.]*$/, '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9 ._-]+/g, '-')
    .replace(/^[.\s-]+/, '')
    .slice(0, 80)
    .trim();
  return `${basis || 'logo'}.${ext}`;
}

export function logoBijlage(
  dataUrl: string | undefined | null,
  naamRuw: string | undefined | null,
  opties: { svgToegestaan?: boolean } = { svgToegestaan: true },
): { filename: string; content: string } | null {
  const logo = controleerLogo(dataUrl, { svgToegestaan: opties.svgToegestaan });
  if (!logo) return null;
  return { filename: logoBestandsnaam(naamRuw, logo.ext), content: logo.base64 };
}

/** Alleen een link naar onze eigen site (vergelijkt de origin, niet alleen het begin van de tekst). */
export function eigenSiteUrl(ruw: string | undefined | null, siteUrl: string): string {
  if (!ruw) return '';
  try {
    const u = new URL(ruw);
    const s = new URL(siteUrl);
    return u.origin === s.origin ? u.toString() : '';
  } catch {
    return '';
  }
}
