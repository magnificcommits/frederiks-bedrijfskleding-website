/**
 * Lokale landingspagina's (/regio/[plaats]). Unieke, diepere content per plaats
 * (geen duplicate content). Geen em-dashes of clichéwoorden.
 */
export type Plaats = {
  slug: string;
  name: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  body: string[];
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
      'In Hengelo zijn we thuis. Onze showroom en bedrukkerij zitten in de Brouwersmolen aan de Kruisbergseweg. Loop op afspraak binnen of laat ons bij je langskomen.',
    body: [
      'Omdat we hier zelf zitten, ken je ons en kennen wij de bedrijven in het dorp. Veel Hengelose ondernemers in de bouw, techniek en horeca halen hier hun kleding, laten het logo aanbrengen en bestellen later moeiteloos bij. Je hebt één aanspreekpunt dat weet wat je draagt.',
      'Het bedrukken en borduren doen we ter plekke in de molen. Daardoor zie je vooraf hoe je logo eruit komt en kunnen we snel schakelen, ook bij een spoedklus of een extra jas die nog gepast moet worden.',
    ],
    afstand: 'Onze thuisbasis',
  },
  {
    slug: 'doetinchem',
    name: 'Doetinchem',
    metaTitle: 'Bedrijfskleding Doetinchem',
    metaDescription:
      'Werkkleding en bedrijfskleding in Doetinchem. Persoonlijk advies, passen op locatie en logo bedrukken of borduren door Frederiks Bedrijfskleding.',
    intro:
      'Doetinchem is de grootste stad van de Achterhoek en daarmee een belangrijke thuisbasis voor onze klanten in bouw, techniek, transport en horeca.',
    body: [
      'Op de bedrijventerreinen rond Doetinchem, van Wijnbergen tot Verheulsweide, zitten veel bedrijven die hun team herkenbaar en veilig willen kleden. We komen langs om te passen, stellen samen een pakket samen en regelen het bedrukken in eigen huis.',
      'Of het nu gaat om hi-vis voor werk langs de weg, een representatieve lijn voor de buitendienst of horecakleding voor een zaak in het centrum, we stemmen het af op het werk. Nabestellen voor een nieuwe medewerker is daarna zo geregeld.',
    ],
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
    body: [
      'Zutphen kent een mix van industrie, bouw en een levendig centrum met horeca en winkels. Die verschillende werelden vragen elk om andere kleding, en daar denken we in mee: stevig en veilig waar het moet, verzorgd en representatief waar dat telt.',
      'We komen naar je toe om te passen, ook in grotere maten. Het logo brengen we slijtvast aan, bedrukt of geborduurd, zodat je team er maanden later nog net zo verzorgd uitziet.',
    ],
    afstand: 'Ongeveer 25 minuten vanaf Hengelo',
  },
  {
    slug: 'zelhem',
    name: 'Zelhem',
    metaTitle: 'Bedrijfskleding Zelhem',
    metaDescription:
      'Werkkleding en bedrijfskleding in Zelhem met persoonlijk advies. Maatwerk, bedrukken en borduren door Frederiks Bedrijfskleding.',
    intro:
      'Zelhem ligt bij ons om de hoek. Voor de bouw-, techniek- en agrarische bedrijven hier zijn we snel ter plaatse om te passen en te leveren.',
    body: [
      'De korte afstand betekent korte lijnen. Een nieuwe medewerker die kleding nodig heeft, of een nabestelling die snel moet, regelen we zonder gedoe. Je hoeft niet te wachten op een anonieme webshop.',
      'Voor agrarische en groene bedrijven rond Zelhem leveren we weerbestendige, stevige kleding die tegen modder en machines kan, met de juiste schoenen of laarzen erbij.',
    ],
    afstand: 'Ongeveer 10 minuten vanaf Hengelo',
  },
  {
    slug: 'vorden',
    name: 'Vorden',
    metaTitle: 'Bedrijfskleding Vorden',
    metaDescription:
      'Bedrijfskleding en werkkleding in Vorden. Persoonlijk advies, passen op locatie en eigen bedrukkerij door Frederiks Bedrijfskleding.',
    intro:
      'Vorden ligt vlak bij onze showroom. Voor de ondernemers in dit kastelendorp zijn we zo langs om kleding te passen en advies te geven.',
    body: [
      'Van bouwbedrijven en hoveniers tot horeca en zorg: we kleden uiteenlopende bedrijven in en rond Vorden. Doordat we dichtbij zitten, kennen we de klanten en is meedenken vanzelfsprekend.',
      'We stellen per bedrijf een vaste kledinglijn samen en leggen die vast. Zo weet je precies wat je bestelt als er iemand bij komt, en gaat een nabestelling met een belletje.',
    ],
    afstand: 'Ongeveer 10 minuten vanaf Hengelo',
  },
  {
    slug: 'ruurlo',
    name: 'Ruurlo',
    metaTitle: 'Bedrijfskleding Ruurlo',
    metaDescription:
      'Werkkleding en bedrijfskleding in Ruurlo. Maatwerk, persoonlijk advies en bedrukken of borduren in eigen huis.',
    intro:
      'Voor bedrijven in Ruurlo en omgeving leveren we werkkleding, veiligheidsschoenen en maatwerk met persoonlijke aandacht.',
    body: [
      'Ruurlo heeft een sterke mix van maakindustrie, bouw en agrarisch werk. We kiezen kleding die past bij het werk: slijtvast en veilig waar dat nodig is, comfortabel voor lange dagen.',
      'Passen doen we bij je op de zaak. Het logo brengen we in eigen huis aan, dus snel en met grip op de kwaliteit. Verbleekte hi-vis of versleten schoenen vervangen we op tijd.',
    ],
    afstand: 'Ongeveer 15 minuten vanaf Hengelo',
  },
  {
    slug: 'borculo',
    name: 'Borculo',
    metaTitle: 'Bedrijfskleding Borculo',
    metaDescription:
      'Bedrijfskleding en werkkleding in Borculo met persoonlijk advies. Logo bedrukken of borduren door Frederiks Bedrijfskleding.',
    intro:
      'Borculo en omgeving bedienen we met dezelfde persoonlijke aanpak: langskomen, passen en een pakket samenstellen dat klopt.',
    body: [
      'De industrie- en bouwbedrijven rond Borculo vragen om stevige, functionele kleding. We leveren werkbroeken, jassen, hi-vis en veiligheidsschoenen in de juiste normklasse, afgestemd op het werk.',
      'Doordat we de hele lijn vastleggen, blijft je team uniform en gaat nabestellen snel. Eén aanspreekpunt voor advies, bedrukken en levering.',
    ],
    afstand: 'Ongeveer 20 minuten vanaf Hengelo',
  },
  {
    slug: 'doesburg',
    name: 'Doesburg',
    metaTitle: 'Bedrijfskleding Doesburg',
    metaDescription:
      'Werkkleding en bedrijfskleding in Doesburg met persoonlijk advies. Logo bedrukken of borduren door Frederiks Bedrijfskleding.',
    intro:
      'Ondernemers in Doesburg en de Liemers helpen we aan praktische, verzorgde bedrijfskleding. Van advies tot bedrukken, alles op één plek.',
    body: [
      'Het historische centrum van Doesburg telt veel horeca en winkels, terwijl er daarbuiten bouw- en technische bedrijven zitten. Voor allebei hebben we een passende lijn, van koksbuis en schort tot werkbroek en hi-vis.',
      'We komen langs om te passen en stemmen kleur en logo af op je huisstijl. Zo komt je merk overal hetzelfde over, binnen en buiten.',
    ],
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
    body: [
      'Lichtenvoorde heeft een actieve ondernemersgemeenschap en veel maakbedrijven. We kiezen kleding die lang meegaat en comfortabel blijft over een hele werkdag, met de veiligheidsnormen die bij het werk horen.',
      'Het logo brengen we slijtvast aan en we leggen de kledinglijn per bedrijf vast. Een nieuwe medewerker of nabestelling is daarna binnen een paar dagen geregeld.',
    ],
    afstand: 'Ongeveer 25 minuten vanaf Hengelo',
  },
  {
    slug: 'groenlo',
    name: 'Groenlo',
    metaTitle: 'Bedrijfskleding Groenlo',
    metaDescription:
      'Werkkleding en bedrijfskleding in Groenlo met persoonlijk advies. Maatwerk, bedrukken en borduren door Frederiks Bedrijfskleding.',
    intro:
      'In Groenlo en omgeving leveren we werkkleding met persoonlijke aandacht, van de bouw tot de horeca en de maakindustrie.',
    body: [
      'Groenlo combineert bedrijvigheid met een sterk verenigingsleven. Naast bedrijfskleding verzorgen we daarom ook sport- en promotiekleding voor clubs en teams, bedrukt of geborduurd met logo of sponsor.',
      'Voor bedrijven stellen we een vaste lijn samen en passen we op locatie. Het bedrukken doen we zelf, dus je ziet vooraf het resultaat en we schakelen snel.',
    ],
    afstand: 'Ongeveer 25 minuten vanaf Hengelo',
  },
  {
    slug: 'aalten',
    name: 'Aalten',
    metaTitle: 'Bedrijfskleding Aalten',
    metaDescription:
      'Bedrijfskleding en werkkleding in Aalten. Persoonlijk advies, passen op locatie en eigen bedrukkerij door Frederiks Bedrijfskleding.',
    intro:
      'Ook in Aalten en omgeving zijn we actief. We komen langs, passen op locatie en stellen een kledingpakket samen dat past bij je branche.',
    body: [
      'Aalten heeft veel familiebedrijven in de bouw, techniek en agrarische sector. Die waarderen een leverancier die meedenkt en ze kent, niet een anonieme webshop. Daar zijn we op gebouwd.',
      'We leveren stevige, veilige werkkleding en schoenen in de juiste normklasse, brengen het logo in eigen huis aan en leggen de maten vast voor een snelle nalevering.',
    ],
    afstand: 'Ongeveer 30 minuten vanaf Hengelo',
  },
  {
    slug: 'winterswijk',
    name: 'Winterswijk',
    metaTitle: 'Bedrijfskleding Winterswijk',
    metaDescription:
      'Werkkleding en bedrijfskleding in Winterswijk met persoonlijk advies. Maatwerk, bedrukken en borduren door Frederiks Bedrijfskleding.',
    intro:
      'Ook in Winterswijk en omgeving zijn we actief. We stellen samen een kledinglijn samen die past bij je branche en uitstraling, en we komen langs om te passen.',
    body: [
      'Winterswijk ligt in de hoek van de Achterhoek en heeft een eigen, sterke economie met industrie, bouw, zorg en toerisme. Voor al die sectoren leveren we passende kleding, van werkbroek tot tuniek en horeca-outfit.',
      'Ondanks de afstand houden we het persoonlijk: we komen langs om te passen en zorgen dat nabestellingen snel je kant op komen. Het logo brengen we slijtvast aan in eigen huis.',
    ],
    afstand: 'Ongeveer 35 minuten vanaf Hengelo',
  },
];

export const plaatsenBySlug = Object.fromEntries(plaatsen.map((p) => [p.slug, p]));
