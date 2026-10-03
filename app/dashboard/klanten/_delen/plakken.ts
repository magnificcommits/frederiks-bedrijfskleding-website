/**
 * Een lijst namen uit Excel (of Word, of een e-mail) omzetten naar werknemers.
 * Puur rekenwerk, geen database: werkt in de browser en op de server.
 *
 * Per regel één werknemer. Kolommen gescheiden door een tab (zo plakt Excel)
 * of een puntkomma. Een cel met een @ is het e-mailadres, waar die ook staat.
 */

export type GeplakteRij = { voornaam: string; achternaam: string; afdeling: string; email: string };

/** Wat staat er in de kolommen? 'auto' kiest zelf op basis van het aantal kolommen. */
export type Indeling = 'auto' | 'naam' | 'voorachter';

const KOPTEKSTEN = ['naam', 'voornaam', 'name', 'medewerker', 'werknemer', 'voor- en achternaam'];

/** 'Jan de Vries' → Jan + de Vries. 'Vries, Jan de' → Jan de + Vries. */
export function splitsNaam(naam: string): { voornaam: string; achternaam: string } {
  const schoon = naam.replace(/\s+/g, ' ').trim();
  if (!schoon) return { voornaam: '', achternaam: '' };
  const komma = schoon.indexOf(',');
  if (komma > 0) {
    return { voornaam: schoon.slice(komma + 1).trim(), achternaam: schoon.slice(0, komma).trim() };
  }
  const delen = schoon.split(' ');
  if (delen.length === 1) return { voornaam: delen[0], achternaam: '' };
  return { voornaam: delen[0], achternaam: delen.slice(1).join(' ') };
}

function cellen(regel: string): string[] {
  const scheiding = regel.includes('\t') ? '\t' : regel.includes(';') ? ';' : null;
  const ruw = scheiding ? regel.split(scheiding) : [regel];
  return ruw.map((c) => c.replace(/^"|"$/g, '').trim());
}

export function leesGeplakt(tekst: string, indeling: Indeling = 'auto'): GeplakteRij[] {
  const regels = tekst
    .split(/\r?\n/)
    .map((r) => r.trimEnd())
    .filter((r) => r.trim().length > 0);
  const uit: GeplakteRij[] = [];
  regels.forEach((regel, i) => {
    const alle = cellen(regel);
    if (i === 0 && KOPTEKSTEN.includes((alle[0] ?? '').toLowerCase())) return;
    const emailCel = alle.find((c) => c.includes('@')) ?? '';
    const rest = alle.filter((c) => c !== emailCel && c.length > 0);
    if (rest.length === 0) return;
    const gebruik: Indeling = indeling === 'auto' ? (rest.length >= 3 ? 'voorachter' : 'naam') : indeling;
    if (gebruik === 'voorachter') {
      uit.push({
        voornaam: rest[0] ?? '',
        achternaam: rest[1] ?? '',
        afdeling: rest[2] ?? '',
        email: emailCel,
      });
    } else {
      const { voornaam, achternaam } = splitsNaam(rest[0]);
      uit.push({ voornaam, achternaam, afdeling: rest[1] ?? '', email: emailCel });
    }
  });
  return uit;
}
