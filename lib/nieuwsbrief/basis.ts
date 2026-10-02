/**
 * De basistemplate "Frederiks Bedrijfskleding basis" en de standaard header- en
 * footer-module. Puur (alleen content-imports), dus ook in de editor bruikbaar.
 *
 * De opbouw volgt de brief die Jessi nu in Mailblue maakt (webversie-link, logo,
 * kopbalk, grote foto, titelbalk, persoonlijke aanhef, tekstblokken met lijnen,
 * 2x2 productfoto's, een kader met contactgegevens, een knop naar de webshop en
 * een footer met social media en afmeldlink), maar dan in de eigen huisstijl:
 * charcoal #1c1c1c, oranje #ec6726 en de wordmark FREDERIKS / BEDRIJFSKLEDING.
 */
import { bedrijf } from '@/content/bedrijf';
import { site } from '@/content/site';
import {
  HUISSTIJL,
  defaultBlok,
  defaultInstellingen,
  defaultSectie,
  defaultSectieStijl,
  padding,
  ONTWERP_VERSIE,
  type Blok,
  type Ontwerp,
  type Sectie,
} from './types';

export const BASIS_TEMPLATE_NAAM = 'Frederiks Bedrijfskleding basis';
export const HEADER_MODULE_NAAM = 'Header Frederiks';
export const FOOTER_MODULE_NAAM = 'Footer Frederiks';

/** Zachte, warme tint voor het tekstvlak (in plaats van Mailblue-crème). */
const WARM = '#fbf4ef';
const KADER = '#f3ebe4';

type SectieOver = Omit<Partial<Sectie>, 'stijl'> & { stijl?: Partial<Sectie['stijl']> };

function sectie(blokken: Blok[], over: SectieOver = {}): Sectie {
  const s = defaultSectie(1);
  s.kolommen[0].blokken = blokken;
  const { stijl, ...rest } = over;
  return { ...s, ...rest, stijl: defaultSectieStijl(stijl ?? {}) };
}

function tweeKolommen(links: Blok[], rechts: Blok[], stijl: Partial<Sectie['stijl']> = {}): Sectie {
  const s = defaultSectie([50, 50]);
  s.kolommen[0].blokken = links;
  s.kolommen[1].blokken = rechts;
  return { ...s, stijl: defaultSectieStijl(stijl) };
}

function kop(tekst: string, over: Partial<Extract<Blok, { type: 'kop' }>> = {}, stijl: Partial<Blok['stijl']> = {}): Blok {
  const b = defaultBlok('kop');
  return { ...b, tekst, ...over, stijl: { ...b.stijl, ...stijl } };
}

function tekst(html: string, stijl: Partial<Blok['stijl']> = {}): Blok {
  const b = defaultBlok('tekst');
  return { ...b, html, stijl: { ...b.stijl, ...stijl } };
}

function lijn(over: Partial<Extract<Blok, { type: 'scheiding' }>> = {}, stijl: Partial<Blok['stijl']> = {}): Blok {
  const b = defaultBlok('scheiding');
  return { ...b, ...over, stijl: { ...b.stijl, ...stijl } };
}

function product(): Blok {
  return defaultBlok('product');
}

/** Header: webversie-link, wordmark en de oranje stiksellijn. */
export function headerSectie(): Sectie {
  const web = defaultBlok('webversie');
  return sectie(
    [
      { ...web, stijl: { ...web.stijl, padding: padding(10, 24, 6, 24) } },
      kop(
        'FREDERIKS',
        { niveau: 1, letterafstand: 0.02 },
        { uitlijning: 'midden', lettergrootte: 28, regelafstand: 1, tekstkleur: HUISSTIJL.charcoal, padding: padding(22, 24, 0, 24) },
      ),
      kop(
        'BEDRIJFSKLEDING',
        { niveau: 2, letterafstand: 0.32 },
        { uitlijning: 'midden', lettergrootte: 11, regelafstand: 1.2, tekstkleur: HUISSTIJL.oranje, padding: padding(6, 24, 14, 24) },
      ),
      lijn({ kleur: HUISSTIJL.oranje, dikte: 2, breedte: 100, lijnstijl: 'dashed' }, { padding: padding(0, 24, 0, 24) }),
    ],
    { naam: 'Header', stijl: { padding: padding(0, 0, 14, 0) } },
  );
}

/** Footer: "Volg ons", social-iconen, bedrijfsgegevens en de afmeldregel. */
export function footerSectie(): Sectie {
  const social = defaultBlok('social');
  const afmelden = defaultBlok('afmelden');
  return sectie(
    [
      kop('Volg ons', { niveau: 2 }, { uitlijning: 'midden', lettergrootte: 16, tekstkleur: HUISSTIJL.wit, padding: padding(22, 24, 4, 24) }),
      {
        ...social,
        links: {
          facebook: site.social.facebook || '',
          instagram: '',
          linkedin: site.social.linkedin || '',
          whatsapp: site.whatsapp || '',
          email: bedrijf.email,
        },
        iconKleur: HUISSTIJL.oranje,
        stijl: { ...social.stijl, padding: padding(8, 24, 14, 24) },
      },
      tekst(
        `<p><strong>${bedrijf.naam}</strong><br>${bedrijf.adres}, ${bedrijf.postcode} ${bedrijf.plaats}<br>${bedrijf.telefoon} · <a href="mailto:${bedrijf.email}">${bedrijf.email}</a></p>`,
        { uitlijning: 'midden', lettergrootte: 12, regelafstand: 1.6, tekstkleur: '#d6d3d0', padding: padding(4, 24, 8, 24) },
      ),
      { ...afmelden, stijl: { ...afmelden.stijl, tekstkleur: HUISSTIJL.grijs, padding: padding(4, 24, 24, 24) } },
    ],
    { naam: 'Footer', stijl: { achtergrond: HUISSTIJL.charcoal, padding: padding(0) } },
  );
}

/** Het volledige basisontwerp. `siteUrl` voor de knop naar het assortiment. */
export function basisOntwerp(siteUrl: string = site.url): Ontwerp {
  const basis = siteUrl.replace(/\/$/, '');

  const hero = defaultBlok('afbeelding');
  const knop = defaultBlok('knop');

  const secties: Sectie[] = [
    headerSectie(),

    // Kopbalk, zoals de donkere balk boven de foto in Mailblue.
    sectie(
      [kop('Nieuws van Frederiks Bedrijfskleding', { niveau: 2, balk: true }, { uitlijning: 'midden', lettergrootte: 15, regelafstand: 1.3, padding: padding(10, 24) })],
      { naam: 'Kopbalk' },
    ),

    // Grote foto. Vervang door een eigen foto van de maand.
    sectie(
      [{ ...hero, src: '/Frederiks-bedrijfskleding-1.jpg', alt: 'Frederiks Bedrijfskleding', link: basis }],
      { naam: 'Grote foto' },
    ),

    // Titelbalk.
    sectie(
      [
        kop(
          'Titel van deze nieuwsbrief',
          { niveau: 1, balk: true },
          { uitlijning: 'midden', lettergrootte: 26, regelafstand: 1.25, achtergrond: HUISSTIJL.oranje, tekstkleur: HUISSTIJL.wit, padding: padding(18, 24) },
        ),
      ],
      { naam: 'Titelbalk' },
    ),

    // Intro en twee tekstonderdelen met lijnen ertussen, op een warme achtergrond.
    sectie(
      [
        lijn({ kleur: HUISSTIJL.charcoal, dikte: 1, breedte: 15 }, { padding: padding(18, 24, 6, 24) }),
        tekst('<p>Beste {{naam}},</p><p>Hier komt een korte inleiding. Wat is er nieuw, en waarom is dit interessant voor jouw bedrijf?</p>', {
          padding: padding(16, 32, 10, 32),
        }),
        lijn({ kleur: '#cfc8c2' }, { padding: padding(12, 32) }),
        kop('Eerste onderwerp', { niveau: 3, vet: false }, { lettergrootte: 18, padding: padding(14, 32, 4, 32) }),
        tekst('<p>Vertel hier over een nieuw artikel, een actie of een klant die je onlangs hebt geholpen.</p>', { padding: padding(4, 32, 10, 32) }),
        lijn({ kleur: '#cfc8c2' }, { padding: padding(12, 32) }),
        kop('Tweede onderwerp', { niveau: 3, vet: false }, { lettergrootte: 18, padding: padding(14, 32, 4, 32) }),
        tekst('<p>Nog een onderwerp. Bijvoorbeeld:</p><ul><li>Passen op locatie, wij komen bij je langs</li><li>Bedrukken en borduren met jullie logo</li></ul>', {
          padding: padding(4, 32, 22, 32),
        }),
      ],
      { naam: 'Tekst', stijl: { achtergrond: WARM } },
    ),

    // 2x2 productfoto's.
    tweeKolommen([product()], [product()], { padding: padding(14, 14, 0, 14) }),
    tweeKolommen([product()], [product()], { padding: padding(0, 14, 14, 14) }),

    // Kader: bezoek ons en contact.
    sectie(
      [
        kop(`Bezoek onze showroom in ${bedrijf.plaats}`, { niveau: 3 }, { lettergrootte: 17, padding: padding(22, 26, 6, 26) }),
        tekst(
          `<p>Kom langs voor persoonlijk advies, of laat ons bij jou langskomen om te passen. Een afspraak maken kan altijd.</p><p><strong>Adres</strong><br>${bedrijf.adres}<br>${bedrijf.postcode} ${bedrijf.plaats}</p><p><strong>Vragen?</strong><br>Bel of app ons: ${bedrijf.telefoon}<br>Mail: <a href="mailto:${bedrijf.email}">${bedrijf.email}</a></p>`,
          { lettergrootte: 14, padding: padding(4, 26, 6, 26) },
        ),
        { ...knop, tekst: 'Bekijk het assortiment', link: `${basis}/assortiment`, stijl: { ...knop.stijl, padding: padding(10, 26, 24, 26) } },
      ],
      { naam: 'Bezoek ons', stijl: { padding: padding(6, 24, 22, 24), inhoudAchtergrond: KADER, radius: 8 } },
    ),

    footerSectie(),
  ];

  return { versie: ONTWERP_VERSIE, instellingen: defaultInstellingen(), secties };
}
