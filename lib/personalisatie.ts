/**
 * Personalisatiekosten (bedrukken, borduren) automatisch uit de goedgekeurde
 * drukproeven (mail Jessi 21 okt 2026). Puur rekenwerk, geen database: zo is het
 * te testen en rekenen offerte, order en factuur precies hetzelfde.
 *
 * Regels:
 * - Elke logoplek op de drukproef van een artikel kost per kledingstuk de
 *   stukprijs van zijn techniek en formaat (borst + rug = twee prijzen).
 * - De staffel telt over de hele order: alle kledingstukken met hetzelfde logo,
 *   op dezelfde plek, in hetzelfde formaat en met dezelfde techniek tellen samen,
 *   of het nu een trui of een overhemd is.
 * - Heeft de klant afwijkende staffels voor die techniek en dat formaat, dan
 *   gelden die in plaats van de centrale prijslijst.
 * - Vaste kosten per order (instelkosten) komen er per gebruikte techniek bij.
 */

export type Tarief = { techniek: string; formaat: string; vanaf_aantal: number; stukprijs: number };
export type Formaat = { techniek: string; formaat: string; omschrijving: string | null; max_oppervlakte_cm2: number | null; volgorde: number | null };
export type Kosten = { techniek: string; soort: string; omschrijving: string | null; bedrag: number; eenheid: string | null };
export type PlekInvoer = { logo_url: string; label?: string; breedte_cm?: number | null; formaat?: string };
export type ProefInvoer = { techniek: string; plekken: PlekInvoer[] };
export type RegelInvoer = { product_id: string | null; kleur: string | null; aantal: number };

export type PersonalisatieRegel = {
  sleutel: string;
  omschrijving: string;
  aantal: number;
  stukprijs: number;
  techniek: string;
  formaat: string;
  /** Prijs uit de afwijkende staffel van de klant. */
  klantprijs: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const schoon = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase();

/** Formaten van één techniek, op volgorde. */
function formatenVan(formaten: Formaat[], techniek: string): Formaat[] {
  return formaten.filter((f) => schoon(f.techniek) === schoon(techniek)).sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));
}

/**
 * Formaat (prijscategorie) van een logoplek. Met de hand gekozen gaat voor.
 * Anders: bij formaten met een maximale oppervlakte (borduren) uit de breedte,
 * met een logo half zo hoog als breed; zonder oppervlakte (bedrukken) is een
 * rugplek het grootste formaat en de rest het kleinste.
 */
export function formaatVoorPlek(plek: PlekInvoer, techniek: string, formaten: Formaat[]): string | null {
  const lijst = formatenVan(formaten, techniek);
  if (plek.formaat && lijst.some((f) => schoon(f.formaat) === schoon(plek.formaat))) {
    return lijst.find((f) => schoon(f.formaat) === schoon(plek.formaat))!.formaat;
  }
  if (lijst.length === 0) return plek.formaat?.trim() || null;
  const metOppervlak = lijst.filter((f) => f.max_oppervlakte_cm2 != null);
  if (metOppervlak.length > 0) {
    const b = Number(plek.breedte_cm);
    if (!Number.isFinite(b) || b <= 0) return metOppervlak[Math.min(1, metOppervlak.length - 1)].formaat;
    const opp = b * b * 0.5;
    return (metOppervlak.find((f) => opp <= (f.max_oppervlakte_cm2 as number)) ?? metOppervlak[metOppervlak.length - 1]).formaat;
  }
  const rug = /rug|back/i.test(plek.label ?? '');
  return rug ? lijst[lijst.length - 1].formaat : lijst[0].formaat;
}

/** Stukprijs bij een aantal: de hoogste staffel waarvan "vanaf" niet boven het aantal ligt. */
export function stukprijsUitStaffel(tarieven: Tarief[], techniek: string, formaat: string, aantal: number): number | null {
  const passend = tarieven
    .filter((t) => schoon(t.techniek) === schoon(techniek) && schoon(t.formaat) === schoon(formaat) && t.vanaf_aantal <= Math.max(1, aantal))
    .sort((a, b) => b.vanaf_aantal - a.vanaf_aantal);
  return passend.length ? Number(passend[0].stukprijs) : null;
}

const hoofdletter = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function berekenPersonalisatie(d: {
  regels: RegelInvoer[];
  proefVoor: (r: RegelInvoer) => ProefInvoer | null;
  tarieven: Tarief[];
  klantTarieven: Tarief[];
  formaten: Formaat[];
  kosten: Kosten[];
}): { regels: PersonalisatieRegel[]; zonderPrijs: string[] } {
  type Groep = { techniek: string; formaat: string; label: string; logo: string; aantal: number };
  const groepen = new Map<string, Groep>();
  for (const r of d.regels) {
    const aantal = Math.max(0, Math.round(Number(r.aantal) || 0));
    if (!aantal) continue;
    const proef = d.proefVoor(r);
    if (!proef) continue;
    for (const p of proef.plekken) {
      const formaat = formaatVoorPlek(p, proef.techniek, d.formaten);
      if (!formaat) continue;
      const label = (p.label ?? '').trim() || 'Logo';
      const sleutel = [schoon(proef.techniek), schoon(formaat), p.logo_url, schoon(label)].join('|');
      const g = groepen.get(sleutel) ?? { techniek: proef.techniek, formaat, label, logo: p.logo_url, aantal: 0 };
      g.aantal += aantal;
      groepen.set(sleutel, g);
    }
  }

  const uit: PersonalisatieRegel[] = [];
  const zonderPrijs: string[] = [];
  const technieken = new Set<string>();
  for (const [sleutel, g] of groepen) {
    const heeftKlant = d.klantTarieven.some((t) => schoon(t.techniek) === schoon(g.techniek) && schoon(t.formaat) === schoon(g.formaat));
    const prijs = stukprijsUitStaffel(heeftKlant ? d.klantTarieven : d.tarieven, g.techniek, g.formaat, g.aantal);
    const fmt = formatenVan(d.formaten, g.techniek).find((f) => schoon(f.formaat) === schoon(g.formaat));
    const omschrijving = `${hoofdletter(g.techniek)} ${g.label.toLowerCase()} · formaat ${g.formaat}${fmt?.omschrijving ? ` (${fmt.omschrijving})` : ''}`;
    if (prijs == null) {
      zonderPrijs.push(omschrijving);
      continue;
    }
    technieken.add(schoon(g.techniek));
    uit.push({ sleutel, omschrijving, aantal: g.aantal, stukprijs: r2(prijs), techniek: g.techniek, formaat: g.formaat, klantprijs: heeftKlant });
  }
  uit.sort((a, b) => a.omschrijving.localeCompare(b.omschrijving, 'nl'));

  // Vaste kosten per order, één keer per gebruikte techniek.
  for (const k of d.kosten) {
    if (schoon(k.eenheid) !== 'order' || !technieken.has(schoon(k.techniek)) || !(Number(k.bedrag) > 0)) continue;
    uit.push({
      sleutel: `kosten|${schoon(k.techniek)}|${schoon(k.soort)}`,
      omschrijving: `${hoofdletter(k.techniek)}: ${(k.omschrijving ?? k.soort).toLowerCase()}`,
      aantal: 1,
      stukprijs: r2(Number(k.bedrag)),
      techniek: k.techniek,
      formaat: '',
      klantprijs: false,
    });
  }
  return { regels: uit, zonderPrijs };
}
