/**
 * Lokale landingspagina's (/regio/[plaats]). Combinatie bedrijfskleding + plaats
 * matcht het zoekgedrag van ondernemers in de regio. Houd teksten uniek per plaats.
 */
export type Plaats = {
  slug: string;
  name: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  afstand: string;
};

export const plaatsen: Plaats[] = [
  {
    slug: 'hengelo-gld',
    name: 'Hengelo (Gld)',
    metaTitle: 'Bedrijfskleding Hengelo (Gld)',
    metaDescription:
      'Bedrijfskleding en werkkleding in Hengelo (Gld). Onze showroom en bedrukkerij zitten in de Brouwersmolen. Persoonlijk advies en passen op locatie.',
    intro:
      'In Hengelo zijn we thuis. Onze showroom en bedrukkerij zitten in de Brouwersmolen. Loop op afspraak binnen of laat ons bij je langskomen om te passen.',
    afstand: 'Onze thuisbasis',
  },
  {
    slug: 'doetinchem',
    name: 'Doetinchem',
    metaTitle: 'Bedrijfskleding Doetinchem',
    metaDescription:
      'Werkkleding en bedrijfskleding in Doetinchem. Persoonlijk advies, passen op locatie en logo bedrukken of borduren door Frederiks Bedrijfskleding.',
    intro:
      'Veel Doetinchemse bouw-, techniek- en horecabedrijven werken al met ons. We komen graag langs om te passen en stellen samen een pakket samen dat klopt.',
    afstand: 'Ongeveer 15 minuten vanaf Hengelo',
  },
  {
    slug: 'zutphen',
    name: 'Zutphen',
    metaTitle: 'Bedrijfskleding Zutphen',
    metaDescription:
      'Bedrijfskleding en werkkleding in Zutphen. Maatwerk met persoonlijk advies, en bedrukken of borduren in eigen huis.',
    intro:
      'Voor bedrijven in Zutphen en omgeving leveren we werkkleding met persoonlijke aandacht. Eén aanspreekpunt, advies op maat en snelle nalevering.',
    afstand: 'Ongeveer 25 minuten vanaf Hengelo',
  },
  {
    slug: 'doesburg',
    name: 'Doesburg',
    metaTitle: 'Bedrijfskleding Doesburg',
    metaDescription:
      'Werkkleding en bedrijfskleding in Doesburg met persoonlijk advies. Logo bedrukken of borduren door Frederiks Bedrijfskleding.',
    intro:
      'Ondernemers in Doesburg en de Liemers helpen we aan praktische, verzorgde bedrijfskleding. Van advies tot bedrukken, alles op één plek.',
    afstand: 'Ongeveer 25 minuten vanaf Hengelo',
  },
  {
    slug: 'lichtenvoorde',
    name: 'Lichtenvoorde',
    metaTitle: 'Bedrijfskleding Lichtenvoorde',
    metaDescription:
      'Bedrijfskleding en werkkleding in Lichtenvoorde. Maatwerk, persoonlijk advies en bedrukken of borduren in eigen huis.',
    intro:
      'Voor de Oost-Achterhoek rond Lichtenvoorde en Groenlo leveren we werkkleding voor bouw, techniek, agri en horeca, inclusief bedrukken in eigen huis.',
    afstand: 'Ongeveer 25 minuten vanaf Hengelo',
  },
  {
    slug: 'winterswijk',
    name: 'Winterswijk',
    metaTitle: 'Bedrijfskleding Winterswijk',
    metaDescription:
      'Werkkleding en bedrijfskleding in Winterswijk met persoonlijk advies. Maatwerk, bedrukken en borduren door Frederiks Bedrijfskleding.',
    intro:
      'Ook in Winterswijk en omgeving zijn we actief. We stellen samen een kledinglijn samen die past bij je branche en uitstraling, en we komen langs om te passen.',
    afstand: 'Ongeveer 35 minuten vanaf Hengelo',
  },
];

export const plaatsenBySlug = Object.fromEntries(plaatsen.map((p) => [p.slug, p]));
