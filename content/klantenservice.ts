/**
 * Content voor de publieke klantenservice-hub (/klantenservice).
 * Single source of truth voor de FAQ en de korte beleidsteksten (retour, garantie,
 * levering). Toegespitst op Frederiks: B2B, persoonlijk advies, passen op locatie,
 * eigen bedrukken en het klantportaal. Geen webshop-jargon.
 */

export type ServiceFaqItem = { q: string; a: string };

export const klantenserviceFaq: ServiceFaqItem[] = [
  {
    q: 'Hoe bestel ik bij Frederiks?',
    a: 'Je bestelt niet via een anonieme webshop, maar samen met ons. Je belt of mailt met je wensen, of vraagt advies aan via het formulier. We bespreken wat je team nodig heeft, leggen een voorstel klaar en zodra het klopt zetten we de bestelling in gang. Werk je al met een klantportaal, dan bestellen je medewerkers daar zelf binnen de afgesproken kaders.',
  },
  {
    q: 'Hoe werkt advies en passen op locatie?',
    a: 'We komen graag bij je langs. Dan bekijken we het werk, voelen we aan de stoffen en laten we je passen, zodat de maat in één keer klopt. Je raakt geen werktijd kwijt aan een showroombezoek en je weet zeker dat een softshell of werkbroek goed zit voordat je een hele ploeg laat aankleden. Liever bij ons in de showroom passen kan ook, op afspraak.',
  },
  {
    q: 'Wat is de levertijd en hoe gaat de bezorging?',
    a: 'Dat hangt af van wat je bestelt. Voorraadartikelen zonder bedrukking zijn er meestal binnen een week, kleding die we bedrukken of borduren duurt wat langer omdat het door onze eigen werkplaats gaat. Bij je bestelling spreken we een realistische datum af, en zodra we die niet halen hoor je dat van ons en niet andersom. We bezorgen in de Achterhoek en omgeving, en brengen het waar het kan gewoon zelf langs.',
  },
  {
    q: 'Doen jullie het bedrukken en borduren zelf?',
    a: 'Ja, dat doen we in eigen huis. Daardoor houden we grip op de kwaliteit en de planning, en kunnen we snel schakelen als er een nieuwe collega bij komt of je logo verandert. Lever je logo het liefst als vectorbestand aan (AI, EPS of PDF). Heb je dat niet, dan kijken we samen naar de beste oplossing.',
  },
  {
    q: 'Wat doet het klantportaal precies?',
    a: 'In het klantportaal staan je medewerkers, maten, budgetten en bestellingen op één plek. Je team bestelt zelf binnen de afgesproken kaders, met de eigen maat al ingevuld, en jij houdt overzicht en grip op de uitgaven. Je krijgt het erbij als je je bedrijfskleding bij Frederiks afneemt. Op de pagina kledingbeheer lees je er meer over.',
  },
  {
    q: 'Hoe werkt de facturatie en betaling?',
    a: 'We werken zakelijk en op factuur. Na levering ontvang je een nette factuur met daarop wat er precies geleverd is, per medewerker of afdeling als dat handig is. Standaard hanteren we een betaaltermijn van 14 dagen. Heb je een eigen voorkeur voor de manier van factureren of een vast factuuradres per vestiging, dan leggen we dat vast.',
  },
  {
    q: 'Hoe gaan jullie om met mijn gegevens?',
    a: 'Zorgvuldig en niet meer dan nodig. We gebruiken je gegevens om je te adviseren, bestellingen te verwerken en te factureren. In het klantportaal heeft elk bedrijf een eigen, afgeschermde omgeving en worden gegevens per organisatie gescheiden bewaard, conform de privacyregels. We verkopen je gegevens niet door.',
  },
  {
    q: 'Kan ik iemand spreken als ik een vraag heb?',
    a: 'Ja, daar staan we juist om bekend. Je hebt een vast aanspreekpunt dat je bedrijf kent, dus niet elke keer een ander. Bellen, mailen of WhatsApp, je krijgt persoonlijk antwoord.',
  },
];

/** Korte beleidsteksten. Het exacte aantal retourdagen komt server-side uit getRetourtermijn(). */
export const retourbeleid = {
  intro:
    'Zit een maat niet lekker of klopt er iets niet aan je bestelling? Dat lossen we samen op. Onbedrukte artikelen in originele staat kun je binnen de afgesproken termijn retourneren. Kleding die we speciaal voor jou hebben bedrukt of geborduurd kunnen we alleen terugnemen als er iets mis is met de uitvoering, omdat zo’n stuk niet opnieuw te verkopen is.',
  stappen: [
    {
      t: 'Meld je retour',
      d: 'Laat ons weten welke bestelling en welke artikelen het betreft en waarom. Werk je met het klantportaal, dan meld je de retour daar aan. Anders bel of mail je ons even.',
    },
    {
      t: 'Stuur terug of geef mee',
      d: 'Je ontvangt van ons het retouradres en korte instructies. In de regio halen we het waar het kan gewoon bij je op.',
    },
    {
      t: 'Terugbetaling of creditfactuur',
      d: 'Zodra we de retour binnen en gecontroleerd hebben, regelen we de terugbetaling of zetten we een creditfactuur klaar.',
    },
  ],
};

export const garantie = {
  intro:
    'Frederiks staat voor kwaliteit. We werken met sterke merken en kleding die tegen een stootje kan, en daar staan we ook achter nadat het geleverd is.',
  tekst:
    'Gaat er binnen redelijke tijd iets mis door een fabricage- of materiaalfout, bijvoorbeeld een naad die loslaat of bedrukking die afbladdert terwijl je het wasvoorschrift hebt gevolgd, dan herstellen of vervangen we het kosteloos. Normale slijtage door dagelijks gebruik valt daar niet onder, dat is gewoon goed werk dat je kleding heeft gedaan. Twijfel je of iets onder garantie valt? Neem contact op, dan kijken we er eerlijk naar.',
  hoe: 'Een garantieclaim meld je door contact met ons op te nemen. Een korte omschrijving en een foto helpen ons om je snel verder te helpen.',
};

export const levering = {
  intro:
    'We spreken bij elke bestelling een realistische leverdatum af en houden je op de hoogte.',
  punten: [
    'Voorraadartikelen zonder bedrukking zijn er meestal binnen een week.',
    'Bedrukte of geborduurde kleding duurt wat langer, omdat die door onze eigen werkplaats gaat.',
    'Loopt er iets uit? Dan hoor je dat van ons, met een nieuwe datum.',
    'In de Achterhoek en omgeving bezorgen we waar het kan zelf.',
  ],
};

/** Ankerlinks voor het 'zelf regelen'-blok bovenaan de pagina. */
export const serviceOnderwerpen: { label: string; href: string }[] = [
  { label: 'Veelgestelde vragen', href: '#veelgestelde-vragen' },
  { label: 'Retourbeleid', href: '#retourbeleid' },
  { label: 'Garantie', href: '#garantie' },
  { label: 'Levertijd en bezorging', href: '#levertijd-en-bezorging' },
];
