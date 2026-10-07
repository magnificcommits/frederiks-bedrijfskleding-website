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

/**
 * Snickers zet in zijn prijslijsten een maatcode in plaats van de maat bij
 * bovenkleding: 003 = XS, 004 = S ... 009 = 3XL. Broekmaten (44 en hoger) zijn
 * gewone maten en blijven staan. De code zelf blijft bewaard als maat_leverancier.
 */
export const SNICKERS_MAATCODES: Record<number, string> = {
  2: 'XXS', 3: 'XS', 4: 'S', 5: 'M', 6: 'L', 7: 'XL', 8: '2XL', 9: '3XL', 10: '4XL', 11: '5XL', 12: '6XL',
};

/** Vertaalt een merkeigen maatcode naar de echte maat; anders ongewijzigd. */
export function merkMaat(merk: string | null | undefined, maat: string | null): string | null {
  if (!maat || !/snickers/i.test(merk ?? '')) return maat;
  const m = /^0*(\d{1,2})$/.exec(maat.trim());
  return m ? SNICKERS_MAATCODES[Number(m[1])] ?? maat : maat;
}

export function normaliseerImportVariant(
  ruweKleur: string | null | undefined,
  ruweMaat: string | null | undefined,
  lijst: VariantLijsten = STANDAARD_LIJSTEN,
  merk?: string | null,
): GenormaliseerdeVariant {
  const kleurRuw = schoon(ruweKleur);
  const maatRuw = schoon(ruweMaat);
  const k = kleurRuw ? normaliseerKleur(kleurRuw, lijst) : null;
  const maatVertaald = merkMaat(merk, maatRuw);
  const m = maatVertaald ? normaliseerMaat(maatVertaald, lijst) : null;
  const kleur = k?.zeker && k.naam ? k.naam : kleurRuw;
  const maat = m?.zeker && m.naam ? m.naam : maatVertaald;
  return {
    kleur,
    maat,
    kleurLeverancier: kleurRuw,
    maatLeverancier: maatRuw,
    onbekendeKleur: kleurRuw && !(k?.zeker && k.naam) ? kleurRuw : null,
    onbekendeMaat: maatVertaald && !(m?.zeker && m.naam) ? maatVertaald : null,
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
