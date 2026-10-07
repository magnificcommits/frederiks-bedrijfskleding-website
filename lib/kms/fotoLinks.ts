/**
 * Foto's via link: een geplakte lijst 'artikelnummer ; kleur ; fotolink' lezen.
 * Kleur mag leeg zijn; dan wordt het de algemene productfoto. Puur, zodat het
 * te testen is.
 */

export type FotoLinkRegel = { regel: number; artNr: string; kleur: string; url: string };
export type FotoLinkFout = { regel: number; tekst: string; reden: string };

/** Alleen een openbare https-link naar een gewone hostnaam; geen IP-adres, localhost of intern domein. */
export function veiligeFotoUrl(ruw: string): string | null {
  let u: URL;
  try {
    u = new URL(ruw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || h.endsWith('.local') || h.endsWith('.internal') || h === 'localhost') return null;
  if (/^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')) return null;
  return u.toString();
}

export function leesFotoLinks(tekst: string): { regels: FotoLinkRegel[]; fouten: FotoLinkFout[] } {
  const regels: FotoLinkRegel[] = [];
  const fouten: FotoLinkFout[] = [];
  tekst.split(/\r?\n/).forEach((ruw, i) => {
    const t = ruw.trim();
    if (!t || t.startsWith('#')) return;
    const delen = t.split(/\s*[;\t]\s*/);
    if (delen.length < 2) return void fouten.push({ regel: i + 1, tekst: t, reden: 'Gebruik artikelnummer ; kleur ; link' });
    const url = veiligeFotoUrl(delen[delen.length - 1]);
    const artNr = delen[0].trim();
    const kleur = delen.length >= 3 ? delen.slice(1, -1).join(' ').trim() : '';
    if (!artNr) return void fouten.push({ regel: i + 1, tekst: t, reden: 'Artikelnummer ontbreekt' });
    if (!url) return void fouten.push({ regel: i + 1, tekst: t, reden: 'Geen geldige https-link' });
    regels.push({ regel: i + 1, artNr, kleur, url });
  });
  return { regels, fouten };
}
