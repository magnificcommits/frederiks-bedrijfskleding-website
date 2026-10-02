/**
 * Het ontwerp van een drukproef: waar elk logo op de voor- en achterkant staat.
 *
 * Alle maten zijn percentages ten opzichte van de foto van het kledingstuk, zodat
 * de proef er op elk scherm en op papier precies hetzelfde uitziet:
 * - x, y: het MIDDEN van het logo (0 = links/boven, 100 = rechts/onder)
 * - breedte: breedte van het logo als percentage van de fotobreedte
 * - rotatie: draaiing in graden (-180 t/m 180, positief = met de klok mee)
 *
 * Dit bestand is bewust puur (geen database, geen browser-API's) zodat zowel de
 * editor, de afdrukversie als de publieke goedkeurpagina hetzelfde rekenwerk delen.
 */

import type { CSSProperties } from 'react';

export type Plaatsing = {
  id: string;
  logo_url: string;
  x: number;
  y: number;
  breedte: number;
  rotatie: number;
  /** Plek op het kledingstuk, bv. "Linker borst". */
  label?: string;
  /** Breedte van het logo in het echt, in centimeters. */
  breedte_cm?: number | null;
  /** Extra maatvoering, bv. "3 cm onder de naad". */
  toelichting?: string;
};

export type Zijde = 'voor' | 'achter';

export type Ontwerp = { voor: Plaatsing[]; achter: Plaatsing[] };

export const LEEG_ONTWERP: Ontwerp = { voor: [], achter: [] };

export const MAX_PLAATSINGEN_PER_ZIJDE = 20;
export const MIN_BREEDTE = 1;
export const MAX_BREEDTE = 100;

export function begrens(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Rond af op twee decimalen; scheelt ruis in de database. */
function rond(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Hoek terugbrengen naar -180 t/m 180. */
export function normaliseerHoek(graden: number): number {
  if (!Number.isFinite(graden)) return 0;
  let g = graden % 360;
  if (g > 180) g -= 360;
  if (g <= -180) g += 360;
  return rond(g);
}

/**
 * Alleen een webadres (https/http) of een pad op onze eigen site mag als afbeelding.
 * Alles anders (javascript:, data: e.d.) weigeren we.
 */
export function veiligeAfbeeldingUrl(waarde: unknown): string | null {
  if (typeof waarde !== 'string') return null;
  const url = waarde.trim();
  if (!url || url.length > 2048) return null;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return null;
}

function tekst(waarde: unknown, max: number): string | undefined {
  if (typeof waarde !== 'string') return undefined;
  const t = waarde.replace(/\s+/g, ' ').trim().slice(0, max);
  return t || undefined;
}

export function nieuweId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function normaliseerPlaatsing(ruw: unknown): Plaatsing | null {
  if (!ruw || typeof ruw !== 'object') return null;
  const r = ruw as Record<string, unknown>;
  const logo = veiligeAfbeeldingUrl(r.logo_url);
  if (!logo) return null;
  const cm = Number(r.breedte_cm);
  const p: Plaatsing = {
    id: typeof r.id === 'string' && r.id.trim() ? r.id.trim().slice(0, 40) : nieuweId(),
    logo_url: logo,
    x: rond(begrens(Number(r.x), 0, 100)),
    y: rond(begrens(Number(r.y), 0, 100)),
    breedte: rond(begrens(Number(r.breedte), MIN_BREEDTE, MAX_BREEDTE)),
    rotatie: normaliseerHoek(Number(r.rotatie)),
  };
  const label = tekst(r.label, 80);
  if (label) p.label = label;
  if (r.breedte_cm != null && r.breedte_cm !== '' && Number.isFinite(cm) && cm > 0) p.breedte_cm = rond(begrens(cm, 0.1, 200));
  const toelichting = tekst(r.toelichting, 160);
  if (toelichting) p.toelichting = toelichting;
  return p;
}

/**
 * Maak van wat er in de database (of uit de browser) komt een geldig ontwerp.
 * Onbekende of kapotte onderdelen vallen weg; geeft null als er helemaal niets bruikbaars is.
 */
export function normaliseerOntwerp(ruw: unknown): Ontwerp | null {
  if (!ruw || typeof ruw !== 'object') return null;
  const r = ruw as Record<string, unknown>;
  const lijst = (v: unknown): Plaatsing[] =>
    (Array.isArray(v) ? v : [])
      .map(normaliseerPlaatsing)
      .filter((p): p is Plaatsing => Boolean(p))
      .slice(0, MAX_PLAATSINGEN_PER_ZIJDE);
  if (!Array.isArray(r.voor) && !Array.isArray(r.achter)) return null;
  return { voor: lijst(r.voor), achter: lijst(r.achter) };
}

/** CSS voor één logo op de foto. Editor en weergave gebruiken exact deze stijl. */
export function plaatsingStijl(p: Plaatsing): CSSProperties {
  return {
    position: 'absolute',
    left: `${p.x}%`,
    top: `${p.y}%`,
    width: `${p.breedte}%`,
    transform: `translate(-50%, -50%) rotate(${p.rotatie}deg)`,
    transformOrigin: 'center center',
  };
}

/** De maatvoering als één leesbare regel, bv. "Linker borst: 12 cm breed, 3 cm onder de naad". */
export function plaatsingTekst(p: Plaatsing): string {
  const delen: string[] = [];
  if (p.breedte_cm) delen.push(`${String(p.breedte_cm).replace('.', ',')} cm breed`);
  if (p.toelichting) delen.push(p.toelichting);
  const maat = delen.join(', ');
  if (p.label && maat) return `${p.label}: ${maat}`;
  return p.label || maat;
}

/** Snelkeuzes voor veelgebruikte plekken, met een startpositie op de foto. */
export type Voorinstelling = { label: string; zijde: Zijde; x: number; y: number; breedte: number };

export const VOORINSTELLINGEN: Voorinstelling[] = [
  // Op de voorkant kijk je naar de drager: zijn linkerborst staat rechts op de foto.
  { label: 'Linker borst', zijde: 'voor', x: 63, y: 32, breedte: 16 },
  { label: 'Rechter borst', zijde: 'voor', x: 37, y: 32, breedte: 16 },
  { label: 'Midden borst', zijde: 'voor', x: 50, y: 34, breedte: 32 },
  { label: 'Rechter mouw', zijde: 'voor', x: 15, y: 30, breedte: 10 },
  { label: 'Linker mouw', zijde: 'voor', x: 85, y: 30, breedte: 10 },
  { label: 'Rug', zijde: 'achter', x: 50, y: 30, breedte: 40 },
  { label: 'Nek', zijde: 'achter', x: 50, y: 16, breedte: 16 },
  { label: 'Rechter kuit', zijde: 'achter', x: 64, y: 78, breedte: 14 },
];

export function standaardPlek(zijde: Zijde): Voorinstelling {
  return VOORINSTELLINGEN.find((v) => v.zijde === zijde) ?? VOORINSTELLINGEN[0];
}

export function heeftPlaatsingen(o: Ontwerp | null | undefined): boolean {
  return Boolean(o && (o.voor.length > 0 || o.achter.length > 0));
}
