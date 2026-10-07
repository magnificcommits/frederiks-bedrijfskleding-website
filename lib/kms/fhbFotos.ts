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

/** Pagina-URL voor artikel en kleur, of null als er geen kleurcode is. */
export function fhbPaginaUrl(artNr: string, kleur: string): string | null {
  const code = fhbKleurCode(kleur);
  const slug = artNr
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!code || !slug) return null;
  return `${FHB_HOST}/de/produkt/${slug}/${code}/`;
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
