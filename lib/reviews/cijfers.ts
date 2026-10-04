/**
 * Het cijfer dat de website toont ("gemiddeld een 8,7 uit 10") en dat in de
 * structured data komt. Telt over ALLE beantwoorde beoordelingen, niet alleen
 * de gepubliceerde: anders zou het gemiddelde alleen de reviews tellen die we
 * zelf hebben uitgekozen. Onder de vijf antwoorden tonen we geen gemiddelde.
 * Puur, zonder imports, zodat het los te testen is.
 */

export const MIN_REVIEWS_VOOR_GEMIDDELDE = 5;

export type ReviewCijfers = {
  /** Aantal beantwoorde beoordelingen (met een score). */
  aantal: number;
  /** Gemiddelde op één decimaal, schaal 0-10; null zonder antwoorden. */
  gemiddelde: number | null;
  /** Genoeg antwoorden om het gemiddelde te tonen en als aggregateRating te publiceren. */
  toonbaar: boolean;
};

export function reviewCijfers(scores: readonly (number | null | undefined)[]): ReviewCijfers {
  const geldig = scores.filter((s): s is number => typeof s === 'number' && Number.isFinite(s) && s >= 0 && s <= 10);
  const aantal = geldig.length;
  const gemiddelde = aantal ? Math.round((geldig.reduce((a, b) => a + b, 0) / aantal) * 10) / 10 : null;
  return { aantal, gemiddelde, toonbaar: aantal >= MIN_REVIEWS_VOOR_GEMIDDELDE };
}
