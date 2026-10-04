import { normaliseerKleur, normaliseerMaat, STANDAARD_LIJSTEN, type VariantLijsten } from '@/lib/kms/variantenStandaard';

/**
 * Kleur en maat uit een importbestand naar de vaste lijst (Instellingen > Maten en kleuren).
 *
 * - Herkend (naam of alias, ook "0404 - Black\Black" of "XXL"): de standaardnaam.
 * - Niet herkend: de opgeschoonde ruwe waarde blijft staan, en komt in de lijst
 *   met onbekende waarden die de import na afloop meldt. Zo kan Jessi ze in de
 *   opschoontool koppelen of als alias toevoegen.
 * - De ruwe leverancierswaarde gaat altijd mee (kleur_leverancier, maat_leverancier),
 *   zodat een volgende import of de opschoontool kan terugzien wat er stond.
 *
 * Puur, zonder database: de lijst komt van laadVariantLijsten() of is de standaardlijst.
 */

export type GenormaliseerdeVariant = {
  kleur: string | null;
  maat: string | null;
  kleurLeverancier: string | null;
  maatLeverancier: string | null;
  /** Gezet als de kleur niet in de vaste lijst staat (ook geen alias of tweekleur). */
  onbekendeKleur: string | null;
  onbekendeMaat: string | null;
};

const schoon = (s: string | null | undefined) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t || null;
};

export function normaliseerImportVariant(
  ruweKleur: string | null | undefined,
  ruweMaat: string | null | undefined,
  lijst: VariantLijsten = STANDAARD_LIJSTEN,
): GenormaliseerdeVariant {
  const kleurRuw = schoon(ruweKleur);
  const maatRuw = schoon(ruweMaat);
  const k = kleurRuw ? normaliseerKleur(kleurRuw, lijst) : null;
  const m = maatRuw ? normaliseerMaat(maatRuw, lijst) : null;
  const kleur = k?.zeker && k.naam ? k.naam : kleurRuw;
  const maat = m?.zeker && m.naam ? m.naam : maatRuw;
  return {
    kleur,
    maat,
    kleurLeverancier: kleurRuw,
    maatLeverancier: maatRuw,
    onbekendeKleur: kleurRuw && !(k?.zeker && k.naam) ? kleurRuw : null,
    onbekendeMaat: maatRuw && !(m?.zeker && m.naam) ? maatRuw : null,
  };
}

/** Telt onbekende waarden en maakt er een korte melding van (hooguit `max` voorbeelden). */
export function meldOnbekend(soort: 'kleuren' | 'maten', waarden: Map<string, number>, max = 8): string | null {
  if (waarden.size === 0) return null;
  const voorbeelden = [...waarden.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'nl'))
    .slice(0, max)
    .map(([w, n]) => (n > 1 ? `${w} (${n}x)` : w));
  const rest = waarden.size > max ? ` en nog ${waarden.size - max}` : '';
  return `${waarden.size} ${soort} niet in de vaste lijst, ongewijzigd overgenomen: ${voorbeelden.join(', ')}${rest}. Koppel ze via Instellingen > Maten en kleuren.`;
}
