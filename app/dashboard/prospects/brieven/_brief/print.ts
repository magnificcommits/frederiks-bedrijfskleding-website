import { site } from '@/content/site';

/**
 * Printinstellingen en de live-controle van de QR-route, gedeeld door de
 * snelle printpagina en de print-stap van een verzending.
 */

/** A4 zonder marges; bij printen alleen de brieven, elk op een eigen vel. */
export const PRINT_CSS = `
  @page { size: A4; margin: 0; }
  @media print {
    html, body { background: #fff !important; padding: 0 !important; margin: 0 !important; }
    body * { visibility: hidden !important; }
    #brieven-print, #brieven-print * { visibility: visible !important; }
    aside { display: none !important; }
    #brieven-print { margin: 0 !important; padding: 0 !important; gap: 0 !important; }
    .brief { box-shadow: none !important; border: 0 !important; margin: 0 !important; break-after: page; page-break-after: always; }
    .brief:last-child { break-after: auto; page-break-after: auto; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

/**
 * Controleert of het domein uit de QR-code al live is en de korte /k-route kent.
 * Een onbekend token hoort naar de homepage door te sturen (3xx); een 404 betekent
 * dat deze versie van de site nog niet gedeployed is.
 */
export async function controleerLive(): Promise<{ ok: boolean; melding: string | null }> {
  try {
    const res = await fetch(`${site.url}/k/0000000000`, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (res.status >= 300 && res.status < 400) return { ok: true, melding: null };
    if (res.status === 404) return { ok: false, melding: `${site.url} is bereikbaar, maar de QR-route /k/ staat er nog niet op. Zet eerst deze versie live.` };
    return { ok: false, melding: `${site.url} gaf status ${res.status} terug op de QR-route.` };
  } catch {
    return { ok: false, melding: `${site.url} is vanaf de server niet bereikbaar.` };
  }
}
