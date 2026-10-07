/**
 * Kleurfoto's ophalen bij FHB (met toestemming van FHB, okt 2026). Elke kleur
 * heeft op fhb.de een eigen pagina (/de/produkt/<artikel>/<kleurcode>/) met een
 * vrijstaande voorkant-foto, herkenbaar aan alt="Produkt Ansicht vorn".
 * Puur: geen netwerk, alleen URL's bouwen en HTML lezen, zodat het te testen is.
 */

export const FHB_HOST = 'https://www.fhb.de';

/** De kleurcode is het laatste getal in de kleurnaam: 'Antraciet/Zwart 1220' geeft '1220'. */
export function fhbKleurCode(kleur: string): string | null {
  const m = kleur.trim().match(/(\d{2,5})\s*$/);
  return m ? m[1] : null;
}

function fhbSlug(artNr: string): string {
  return artNr
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Pagina-URL voor artikel en kleur, of null als er geen kleurcode is. */
export function fhbPaginaUrl(artNr: string, kleur: string): string | null {
  return fhbPaginaUrls(artNr, kleur)[0] ?? null;
}

/**
 * Kandidaat-pagina's, in volgorde. FHB zet damesmodellen soms onder '<naam>-f'
 * (Julia, Kira, Marieke, Andrea); de oude naam stuurt dan door naar een
 * standaardkleur van dat damesmodel. Daarom proberen we beide.
 */
export function fhbPaginaUrls(artNr: string, kleur: string): string[] {
  const code = fhbKleurCode(kleur);
  const slug = fhbSlug(artNr);
  if (!code || !slug) return [];
  const urls = [`${FHB_HOST}/de/produkt/${slug}/${code}/`];
  if (!slug.endsWith('-f')) urls.push(`${FHB_HOST}/de/produkt/${slug}-f/${code}/`);
  return urls;
}

/** Telt alleen als FHB ons niet heeft doorgestuurd: de pagina moet precies op die kleurcode eindigen. */
export function isFhbKleurPagina(eindUrl: string, kleur: string): boolean {
  const code = fhbKleurCode(kleur);
  if (!code) return false;
  try {
    const u = new URL(eindUrl);
    return u.hostname === 'www.fhb.de' && /^\/de\/produkt\/[a-z0-9-]+\/\d+\/$/.test(u.pathname) && u.pathname.endsWith(`/${code}/`);
  } catch {
    return false;
  }
}

/** Zoek in de HTML de voorkant-foto. Alleen een afbeelding op www.fhb.de telt. */
export function fhbVoorkantUit(html: string): string | null {
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const alt = tag.match(/\balt\s*=\s*"([^"]*)"/i)?.[1] ?? '';
    if (!/\bvorn\b/i.test(alt)) continue;
    const src = tag.match(/\bsrc\s*=\s*"([^"]+)"/i)?.[1];
    if (!src) continue;
    try {
      const u = new URL(src, FHB_HOST);
      if (u.protocol === 'https:' && u.hostname === 'www.fhb.de' && /\.(jpe?g|png|webp)$/i.test(u.pathname)) return u.toString();
    } catch {
      /* ongeldige URL: volgende */
    }
  }
  return null;
}
