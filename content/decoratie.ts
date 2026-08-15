/**
 * Decoratietechnieken en het proces eromheen.
 *
 * Elke techniek heeft exact dezelfde velden, zodat ze in de kaartenrij en in de
 * vergelijkingstabel naast elkaar te vergelijken zijn: appels met appels.
 * Houd de teksten kort — één korte zin per veld. De pagina moet te scannen zijn,
 * niet te lezen. Aantallen en levertijden zijn realistisch maar indicatief; wat
 * het in jouw geval wordt, hangt af van de stof, het aantal kleuren en de voorraad.
 */

export type Methode = {
  slug: string;
  naam: string;
  /** Briefing voor de foto die hier later komt. Wordt nu niet getoond: de kaart draagt een SVG-icoon. */
  fotoOmschrijving: string;
  /** Wat de techniek is, in één korte zin. */
  intro: string;
  /** Kleinste aantal dat we draaien, per ontwerp. */
  vanafAantal: string;
  /** Indicatie vanaf goedgekeurde drukproef. */
  levertijd: string;
  /** Het kenmerkende voordeel, in 1-3 woorden. */
  sterkte: string;
  /** Kledingstukken en stoffen, kort opgesomd. Moet in een tabelcel passen. */
  geschiktVoor: string;
  /** In welke situatie dit de juiste keuze is. Eén korte zin. */
  wanneer: string;
  /** Wanneer je beter iets anders kunt kiezen. Eén korte zin. */
  nietGeschikt: string;
};

export const methodes: Methode[] = [
  {
    slug: 'borduren',
    naam: 'Borduren',
    fotoOmschrijving: 'Borduurmachine die een borstlogo op een polo stikt',
    intro: 'Je logo in garen, ingestikt in de stof.',
    vanafAantal: '1 stuk',
    levertijd: '5 werkdagen',
    sterkte: 'Slijtvast',
    geschiktVoor: 'Polo’s, jassen, petten',
    wanneer: 'Kleding die hard gebruikt wordt en vaak op 60 graden wast.',
    nietGeschikt: 'Grote ruglogo’s en kleurverlopen: kies transferdruk.',
  },
  {
    slug: 'transferdruk',
    naam: 'Transferdruk',
    fotoOmschrijving: 'Transferpers die een ruglogo op een softshell drukt',
    intro: 'Logo op folie, onder warmte in de stof geperst.',
    vanafAantal: '1 stuk',
    levertijd: '5 werkdagen',
    sterkte: 'Veel kleuren',
    geschiktVoor: 'T-shirts, sweaters, hesjes',
    wanneer: 'Meerdere kleuren, een kleurverloop of een groot ruglogo.',
    nietGeschikt: 'Wassen bij een industriële wasserij: kies borduren.',
  },
  {
    slug: 'zeefdruk',
    naam: 'Zeefdruk',
    fotoOmschrijving: 'Zeefdrukwerk: een stapel bedrukte shirts van één serie',
    intro: 'Per kleur een zeef, inkt direct in de stof.',
    vanafAantal: 'circa 25 stuks',
    levertijd: '10 werkdagen',
    sterkte: 'Snel in serie',
    geschiktVoor: 'Katoenen shirts en sweaters',
    wanneer: 'Eén grote serie met een logo in egale kleuren.',
    nietGeschikt: 'Kleine aantallen en losse nabestellingen.',
  },
  {
    slug: 'emblemen',
    naam: 'Emblemen en patches',
    fotoOmschrijving: 'Embleem dat op een klittenbandpaneel wordt gezet',
    intro: 'Geborduurd embleem op klittenband, dus verwisselbaar.',
    vanafAantal: '10 stuks per ontwerp',
    levertijd: '10 werkdagen',
    sterkte: 'Verwisselbaar',
    geschiktVoor: 'Jassen en overalls met klittenband',
    wanneer: 'Functies wisselen of je werkt met inleenkrachten.',
    nietGeschikt: 'Een logo dat er nooit meer af hoeft.',
  },
];

/**
 * Het proces van kleding naar goedgekeurd logo. Stap 4 is het verschil met
 * een webshop: je ziet het resultaat voordat we de hele serie draaien.
 */
export const stappen = [
  {
    nr: '01',
    title: 'Je kiest de kleding',
    text: 'In de showroom in Hengelo Gld of bij jou op de zaak.',
  },
  {
    nr: '02',
    title: 'We bepalen de plaatsing',
    text: 'Waar komt je logo, en hoe groot?',
  },
  {
    nr: '03',
    title: 'We kiezen de techniek',
    text: 'Stof en aantal bepalen wat het beste werkt.',
  },
  {
    nr: '04',
    title: 'Je krijgt een drukproef',
    text: 'Pas na jouw goedkeuring gaat de serie de machine in.',
  },
] as const;

/**
 * Waar een logo op werkkleding terechtkomt. De `id` koppelt elke positie aan een
 * punt in de tekening (LogoPositieTekening in components/MethodeKaarten.tsx);
 * hernoem een id dus niet zonder de tekening mee te nemen.
 */
export const logoposities = [
  {
    id: 'borst-links',
    naam: 'Borst links',
    tekst: 'De standaard voor je bedrijfslogo. Klein en zichtbaar tijdens een gesprek.',
  },
  {
    id: 'borst-rechts',
    naam: 'Borst rechts',
    tekst: 'Naam of functie van de medewerker, of een tweede merk.',
  },
  {
    id: 'rug-groot',
    naam: 'Rug groot',
    tekst: 'Leest van tien meter afstand. Voor de bouwplaats of langs de weg.',
  },
  {
    id: 'pijp-links',
    naam: 'Pijp links',
    tekst: 'Op broek of overall, boven de knie. Blijft zichtbaar op je knieën.',
  },
  {
    id: 'pijp-rechts',
    naam: 'Pijp rechts',
    tekst: 'Tweede logo, een keurmerk of je telefoonnummer.',
  },
] as const;
