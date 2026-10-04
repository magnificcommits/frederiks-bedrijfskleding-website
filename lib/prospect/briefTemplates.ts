import { STANDAARD_BRIEFTEKST } from '@/content/kennismaking';
import { site } from '@/content/site';
import {
  BRIEF_VERSIE,
  BRIEF_KLEUREN,
  nieuwBriefBlok,
  standaardInstellingen,
  type BriefBlok,
  type BriefOntwerp,
} from './briefTypes';

/**
 * Ingebouwde brieftemplates. Die zijn er altijd, ook zonder de tabel
 * brief_templates. Eigen templates (uit de editor bewaard) komen er in de
 * database bij. Puur: ook in de browser te gebruiken.
 *
 * De teksten zijn bewust kort. Een brief die op de mat valt wordt in tien
 * seconden gescand: wie stuurt het, wat heb ik eraan, wat moet ik doen.
 */

export type IngebouwdTemplate = {
  sleutel: string;
  naam: string;
  omschrijving: string;
  maak: () => BriefOntwerp;
};

function blok<T extends BriefBlok['type']>(type: T, over: Partial<Extract<BriefBlok, { type: T }>> = {}): Extract<BriefBlok, { type: T }> {
  return { ...nieuwBriefBlok(type), ...over } as Extract<BriefBlok, { type: T }>;
}

const KORTE_TEKST = `Beste {{contactpersoon}},

Ik ben Jessi Frederiks en lever vanuit Hengelo werkkleding aan bedrijven in de Achterhoek. Het logo zetten we er zelf op, geborduurd of bedrukt.

Hieronder zie je hoe jullie logo op een paar artikelen staat die ik voor {{bedrijf}} heb uitgezocht. Op je telefoon zie je meer, met een eerlijke prijsindicatie.

Zin in een pasdag? Ik kom langs in {{plaats}} met alle maten. Bellen kan ook: ${site.phone}.`;

const GROTE_QR_TEKST = `Beste {{contactpersoon}},

Werkkleding uitzoeken kost vaak meer tijd dan het waard is. Daarom heb ik het voor {{bedrijf}} alvast gedaan.

Scan de code hieronder. Je ziet meteen jullie eigen logo op de kleding, met prijzen erbij. Geen account, geen formulier.

Bevalt het? Dan kom ik met pasmodellen naar {{plaats}}, zodat iedereen op de zaak kan passen.`;

const AFGEVEN_TEKST = `Beste {{contactpersoon}},

Ik kwam vandaag langs in {{plaats}} en wilde deze brief even persoonlijk afgeven. Ik ben Jessi van Frederiks Bedrijfskleding uit Hengelo.

Voor {{bedrijf}} heb ik een paar artikelen uitgezocht en jullie logo erop gezet. Scan de code en je ziet het op je telefoon.

Een keer passen op de zaak kost jullie niets. Bel of app me gerust: ${site.phone}.`;

export const INGEBOUWDE_TEMPLATES: IngebouwdTemplate[] = [
  {
    sleutel: 'klassiek',
    naam: 'Klassiek',
    omschrijving: 'De zakelijke brief zoals hij nu ook gaat: tekst, handtekening en onderaan kleding met QR-code.',
    maak: () => ({
      versie: BRIEF_VERSIE,
      instellingen: standaardInstellingen(),
      blokken: [
        blok('betreft'),
        blok('tekst', { tekst: STANDAARD_BRIEFTEKST, boven: 4 }),
        blok('handtekening'),
        blok('ruimte', { vul: true }),
        blok('qr', { kledingErnaast: 3, grootte: 30, uitlijning: 'rechts' }),
      ],
    }),
  },
  {
    sleutel: 'kleding-voorop',
    naam: 'Kleding voorop',
    omschrijving: 'Een kop en drie grote foto’s met hun logo. Minder tekst, de kleding doet het werk.',
    maak: () => ({
      versie: BRIEF_VERSIE,
      instellingen: { ...standaardInstellingen(), accent: BRIEF_KLEUREN.charcoal },
      blokken: [
        blok('betreft', { betreft: '' }),
        blok('kop', { tekst: 'Zo ziet {{bedrijf}} eruit in werkkleding', grootte: 16, boven: 3 }),
        blok('tekst', { tekst: KORTE_TEKST, boven: 3 }),
        blok('handtekening', { boven: 3 }),
        blok('mockups', { aantal: 3, grootte: 38, namen: true, boven: 5 }),
        blok('ruimte', { vul: true }),
        blok('qr', { kop: 'Bekijk het op je telefoon', tekst: 'Scan de code, dan zie je\nmeer artikelen en prijzen', grootte: 24, kledingErnaast: 0, uitlijning: 'links', kader: true, boven: 4 }),
      ],
    }),
  },
  {
    sleutel: 'grote-qr',
    naam: 'Kort, met grote QR-code',
    omschrijving: 'Drie korte alinea’s en een grote QR-code in het midden. Voor wie weinig tijd heeft.',
    maak: () => ({
      versie: BRIEF_VERSIE,
      instellingen: standaardInstellingen(),
      blokken: [
        blok('betreft'),
        blok('tekst', { tekst: GROTE_QR_TEKST, boven: 4 }),
        blok('ruimte', { vul: true }),
        blok('qr', { kop: 'Scan voor jullie logo op de kleding', tekst: '', grootte: 42, kledingErnaast: 0, uitlijning: 'midden', kader: true, boven: 4 }),
        blok('handtekening', { boven: 6 }),
      ],
    }),
  },
  {
    sleutel: 'afgeven',
    naam: 'Zelf afgeven',
    omschrijving: 'Zonder adresvenster, met een smal briefhoofd. Voor brieven die Jessi zelf langsbrengt.',
    maak: () => ({
      versie: BRIEF_VERSIE,
      instellingen: { ...standaardInstellingen(), briefhoofd: 'compact' },
      blokken: [
        blok('kop', { tekst: 'Voor {{bedrijf}}', grootte: 18, boven: 0 }),
        blok('tekst', { tekst: AFGEVEN_TEKST, boven: 5 }),
        blok('handtekening', { boven: 4 }),
        blok('mockups', { aantal: 3, grootte: 46, namen: true, boven: 6 }),
        blok('ruimte', { vul: true }),
        blok('qr', { kledingErnaast: 0, grootte: 32, uitlijning: 'rechts', boven: 4 }),
      ],
    }),
  },
];

export const STANDAARD_TEMPLATE = 'klassiek';

export function ingebouwdTemplate(sleutel: string | null | undefined): IngebouwdTemplate | null {
  return INGEBOUWDE_TEMPLATES.find((t) => t.sleutel === sleutel) ?? null;
}

/**
 * Terugval voor de oude flow: de vrije brieftekst uit de textarea in het klassieke
 * template. Zo levert "Brieven tonen" dezelfde brief als vroeger.
 */
export function klassiekMetTekst(tekst: string): BriefOntwerp {
  const o = INGEBOUWDE_TEMPLATES[0].maak();
  const t = o.blokken.find((b) => b.type === 'tekst');
  if (t && t.type === 'tekst') t.tekst = tekst;
  return o;
}
