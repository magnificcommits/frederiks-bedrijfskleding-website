/**
 * Zakelijke gegevens die op factuur, offerte en pakbon horen te staan.
 *
 * Los van content/site.ts. Dat bestand is de bron voor de website (NAP, SEO,
 * JSON-LD); dit bestand is de bron voor documenten die naar de boekhouding gaan.
 * Het adres is hetzelfde als op de website. De factuurvoet die Jessi aanleverde
 * noemde nog de Spalstraat; zij bevestigde op 23-09-2026 dat Kruisbergseweg 9
 * het juiste adres is.
 */
export const bedrijf = {
  naam: 'Frederiks Bedrijfskleding',
  adres: 'Kruisbergseweg 9',
  postcode: '7255 AG',
  plaats: 'Hengelo Gld',
  telefoon: '06 15 21 50 29',
  email: 'info@frederiksbedrijfskleding.nl',
  website: 'www.frederiksbedrijfskleding.nl',
  iban: 'NL74 RABO 0367 4395 73',
  kvk: '57877637',
  btw: 'NL003713492B92',
  /** Betaaltermijn in dagen; ook gebruikt om de vervaldatum te berekenen. */
  betaaltermijnDagen: 15,
  betaalvoorwaarde:
    'Wij verzoeken u vriendelijk het bedrag binnen 15 dagen over te maken onder vermelding ' +
    'van factuurnummer en debiteurnummer. Op alle diensten zijn onze algemene voorwaarden van toepassing.',
} as const;
