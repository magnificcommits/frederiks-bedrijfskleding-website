/**
 * Maattabellen voor werkkleding. Richtlijnen om zelf de juiste maat te bepalen.
 * Single source of truth voor de publieke /maattabellen-pagina.
 *
 * Let op: de getallen zijn richtwaarden. Maten verschillen per merk en model.
 * Twijfel je? Frederiks komt langs om te passen, ook in grote maten.
 */

export type Maattabel = {
  /** Slug-vriendelijke id, ook bruikbaar als anchor. */
  id: string;
  /** Titel van de tabel. */
  titel: string;
  /** Korte intro: waar is deze tabel voor. */
  intro: string;
  /** Toelichting: hoe meet je voor deze tabel. */
  hoeMeten: string;
  /** Kolomkoppen, in volgorde. */
  kolommen: string[];
  /** Rijen met cellen, in dezelfde volgorde als de kolommen. */
  rijen: string[][];
};

/**
 * 1. Bovenkleding (shirts, polo's, sweaters, jassen).
 * Confectiematen S t/m 3XL met borstomvang in cm en bijbehorende EU-maat.
 */
const bovenkleding: Maattabel = {
  id: 'bovenkleding',
  titel: 'Bovenkleding (shirts, polo’s, jassen)',
  intro:
    'Voor T-shirts, polo’s, sweaters, bodywarmers en jassen. Maat S t/m 3XL met de bijbehorende borstomvang en EU-confectiemaat.',
  hoeMeten:
    'Meet de borstomvang rond het breedste deel van de borst, onder de armen door en horizontaal rond de rug. Houd het meetlint vlak en niet te strak. Twijfel je tussen twee maten, kies dan de grootste.',
  kolommen: ['Maat', 'EU-maat', 'Borstomvang (cm)'],
  rijen: [
    ['S', '46–48', '88–96'],
    ['M', '50–52', '97–104'],
    ['L', '54', '105–112'],
    ['XL', '56', '113–120'],
    ['2XL', '58–60', '121–128'],
    ['3XL', '62', '129–136'],
  ],
};

/**
 * 2. Werkbroeken.
 * Confectiematen 44 t/m 64 met taille- en heupomvang in cm.
 */
const broeken: Maattabel = {
  id: 'broeken',
  titel: 'Werkbroeken',
  intro:
    'Voor werkbroeken, kniestukbroeken en korte broeken. Maat 44 t/m 64 met de bijbehorende taille- en heupomvang.',
  hoeMeten:
    'Meet de tailleomvang rond het smalste deel van je middel, daar waar de broek normaal blijft zitten. Meet de heupomvang rond het breedste deel van je heupen. Draag bij het meten dunne kleding, niet je werkkleding.',
  kolommen: ['Confectiemaat', 'Tailleomvang (cm)', 'Heupomvang (cm)'],
  rijen: [
    ['44', '74–77', '90–93'],
    ['46', '78–81', '94–97'],
    ['48', '82–85', '98–101'],
    ['50', '86–89', '102–105'],
    ['52', '90–93', '106–109'],
    ['54', '94–98', '110–114'],
    ['56', '99–103', '115–119'],
    ['58', '104–108', '120–124'],
    ['60', '109–113', '125–129'],
    ['62', '114–119', '130–135'],
    ['64', '120–125', '136–141'],
  ],
};

/**
 * 3. Werkschoenen en veiligheidsschoenen.
 * EU-maten 36 t/m 48 met voetlengte in mm en cm.
 */
const schoenen: Maattabel = {
  id: 'schoenen',
  titel: 'Werk- en veiligheidsschoenen',
  intro:
    'Voor veiligheidsschoenen en werkschoenen. EU-maat 36 t/m 48 met de bijbehorende voetlengte.',
  hoeMeten:
    'Ga aan het eind van de dag staan op een vel papier en teken je voet af, met je gewicht op de voet. Meet de afstand van je hiel tot je langste teen. Meet bij voorkeur met de werksok aan die je gaat dragen, en neem de grootste voet als maat.',
  kolommen: ['EU-maat', 'Voetlengte (mm)', 'Voetlengte (cm)'],
  rijen: [
    ['36', '230', '23,0'],
    ['37', '237', '23,7'],
    ['38', '243', '24,3'],
    ['39', '250', '25,0'],
    ['40', '257', '25,7'],
    ['41', '263', '26,3'],
    ['42', '270', '27,0'],
    ['43', '277', '27,7'],
    ['44', '283', '28,3'],
    ['45', '290', '29,0'],
    ['46', '297', '29,7'],
    ['47', '303', '30,3'],
    ['48', '310', '31,0'],
  ],
};

export const maattabellen: Maattabel[] = [bovenkleding, broeken, schoenen];
