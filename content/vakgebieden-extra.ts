/**
 * Drie extra vakgebiedpagina's (/voor/[slug]): automotive, winkel en kapsalon.
 * Zelfde opbouw als content/vakgebieden.ts: eerst het werk, dan de kleding,
 * gekoppeld aan de Achterhoek en de Liemers. Geen prijzen en geen merken die
 * niet in het KMS staan.
 */

import type { Vakgebied } from '@/content/vakgebieden';

export const vakgebiedenExtra: Vakgebied[] = [
  {
    slug: 'automotive-en-garage',
    naam: 'Automotive en garage',
    titel: 'Werkkleding voor garages en autobedrijven in de Achterhoek',
    eyebrow: 'Automotive en garage',
    metaDescription:
      "Werkkleding voor garages, autobedrijven en schadeherstel in de Achterhoek en de Liemers. Werkplaats en showroom in één lijn. We komen langs om te passen.",
    intro:
      'In de werkplaats lig je onder een auto, kniel je bij een wiel en sta je met je armen in een motorruimte vol olie. Tien meter verderop zit een collega in de showroom met een klant aan tafel over een nieuwe auto. Twee werelden onder één dak, en de klant ziet ze allebei.',
    waaromAnders: [
      {
        title: 'Olie en vet gaan nooit meer helemaal weg',
        text: 'Motorolie, remreiniger en kettingvet trekken diep in de vezel. Een lichte broek ziet er na een maand vies uit, ook net uit de was. Een donkere kleur in een stof die op zestig graden kan, houdt het een stuk langer netjes.',
      },
      {
        title: 'Knieën en ellebogen doen het zware werk',
        text: 'Banden wisselen, remmen doen, onder een dashboard kruipen. Je zit veel vaker op je knieën dan je denkt. Zonder kniezakken met inleggers voel je dat aan het eind van de week, en de broek slijt precies op die plek als eerste door.',
      },
      {
        title: 'De showroom vraagt om iets anders dan de brug',
        text: 'Een verkoper in een werkpolo vol vlekken kost vertrouwen bij een klant die een auto komt kopen. Een eigen lijn voor de verkoop, in dezelfde kleur en met hetzelfde logo als de werkplaats, laat zien dat het één bedrijf is.',
      },
    ],
    meestBesteld: [
      'Werkbroek met kniezakken en stretch in een donkere kleur',
      'Overall voor vuil werk onder de auto en in de spuiterij',
      'Werkpolo en T-shirt met logo voor de werkplaats',
      'Sweater of softshell voor een koude werkplaats met open deuren',
      "Representatieve polo's, overhemden en blouses voor showroom en receptie",
      'Werkschoen S3, ook met ESD-uitvoering, met een zool die niet wegglijdt op olie',
    ],
    normen: [
      { slug: 'en-14404', code: 'EN 14404', naam: 'Kniebescherming', waarom: 'Voor bandenwerk, remmen en alles wat je op je knieën naast een auto doet.' },
      { slug: 'en-iso-20345', code: 'EN ISO 20345', naam: 'Veiligheidsschoenen', waarom: 'Tegen een vallend wiel of onderdeel en tegen uitglijden op een vloer met olie. Er zijn ook uitvoeringen met ESD-markering.' },
      { slug: 'en-1149-5', code: 'EN 1149-5', naam: 'Antistatische kleding', waarom: 'In de spuitcabine en bij het werken met oplosmiddelen, waar een vonk door statische lading een risico is.' },
      { slug: 'en-13034', code: 'EN 13034', naam: 'Beperkte bescherming tegen vloeibare chemicaliën', waarom: 'Bij schadeherstel en lakwerk, waar je met verdunner, ontvetter en lak werkt.' },
    ],
    productCategorieSlugs: ['broeken', 'overalls', 't-shirts-en-polos', 'truien-en-vesten', 'blouses-en-overhemden', 'werkschoenen'],
    veelgesteld: [
      {
        q: "Hebben onze monteurs speciale kleding nodig voor elektrische auto's?",
        a: 'Voor werk aan het hoogvoltagesysteem gelden eigen regels en eigen beschermingsmiddelen, zoals geïsoleerde handschoenen en gereedschap. Die volgen uit de opleiding en de werkinstructie van je bedrijf, niet uit de werkkleding. Wat wij wel adviseren: geen polyester direct op de huid en schoenen met ESD-markering. Let op dat ESD-schoenen lading afvoeren en dus niet isoleren; dat is een ander doel.',
      },
      {
        q: 'Kunnen werkplaats en showroom bij elkaar passen zonder dat de verkoper in werkkleding loopt?',
        a: 'Ja, dat is juist de kunst. We kiezen één bedrijfskleur en zetten het logo bij iedereen op dezelfde plek. De werkplaats krijgt broeken en polo\'s die tegen olie kunnen, de verkoop overhemden of nette polo\'s in dezelfde tint. Dan zie je in Doetinchem of Zevenaar meteen bij welk autobedrijf je binnenloopt.',
      },
      {
        q: 'Komen jullie ook in de werkplaats passen?',
        a: 'Graag. We komen met de paskoffer langs, bijvoorbeeld vlak voor de lunch of aan het eind van de dag, zodat er geen auto langer op de brug staat dan nodig. Iedereen past zijn eigen maat en die leggen we vast, zodat nabestellen voor een nieuwe monteur een kwestie van doorgeven is.',
      },
    ],
  },
  {
    slug: 'winkel-en-retail',
    naam: 'Winkel en retail',
    titel: 'Bedrijfskleding voor winkels en retail in de Achterhoek',
    eyebrow: 'Winkel en retail',
    metaDescription:
      "Bedrijfskleding voor winkels, bouwmarkten en tuincentra in de Achterhoek en de Liemers. Polo's, vesten en schorten met logo, nabestellen via het portaal.",
    intro:
      'Je staat de hele dag, loopt honderd keer heen en weer tussen kassa, schap en magazijn en wordt om de paar minuten iets gevraagd. Een klant moet je in één oogopslag herkennen tussen andere klanten. Op zaterdag staan er andere mensen dan op dinsdag, en na de zomer is de helft van de parttimers weer nieuw.',
    waaromAnders: [
      {
        title: 'Een klant zoekt iemand die bij de winkel hoort',
        text: 'Wie iets niet kan vinden, kijkt rond naar een medewerker. Draagt iedereen iets anders, dan vraagt hij het aan een andere klant of loopt hij weg. Eén vaste kleur met het logo goed zichtbaar op de borst lost dat op, ook in een volle winkel op zaterdagmiddag.',
      },
      {
        title: 'Acht uur staan vraagt meer dan een mooi shirt',
        text: 'Je rekt naar het bovenste schap, tilt dozen uit het magazijn en staat bij een tochtige ingang. Kleding moet meebewegen zonder op te kruipen en lagen hebben die je aan en uit kunt doen. In een bouwmarkt of tuincentrum loop je bovendien geregeld naar buiten.',
      },
      {
        title: 'Personeel wisselt sneller dan de kleding slijt',
        text: 'Scholieren, parttimers en zaterdaghulpen komen en gaan, en elk met een andere maat. Wie dat per keer losse shirts laat bedrukken, heeft binnen een jaar drie tinten blauw in de winkel hangen. Een vastgelegde lijn met vaste artikelen voorkomt dat.',
      },
    ],
    meestBesteld: [
      "Poloshirts met geborduurd logo in de kleur van de winkel",
      'Vest of sweater voor de kassa en de ingang waar het tocht',
      'Bodywarmer voor het tuincentrum, de buitenafdeling en het laden',
      'Schort met logo voor de bakkerij-winkel, de versafdeling en de werkplek in de winkel',
      'Overhemd of blouse voor showroom en vloermanager',
      'Werkschoen voor wie ook in het magazijn of op het laadperron staat',
    ],
    normen: [
      { slug: 'en-iso-20345', code: 'EN ISO 20345', naam: 'Veiligheidsschoenen', waarom: 'Voor medewerkers in het magazijn van een bouwmarkt of tuincentrum, waar pallets, rolcontainers en een heftruck rondgaan.' },
    ],
    productCategorieSlugs: ['t-shirts-en-polos', 'truien-en-vesten', 'bodywarmers', 'blouses-en-overhemden', 'accessoires', 'werkschoenen'],
    veelgesteld: [
      {
        q: 'We hebben veel parttimers. Hoe houden we de kleding op orde?',
        a: 'Met een vaste lijn en vastgelegde maten in ons klantportaal. Je ziet daar wie wat heeft gekregen en bestelt voor een nieuwe zaterdaghulp met een paar klikken bij, met hetzelfde artikel en het logo op dezelfde plek. Houd je liever een kleine voorraad in de gangbare maten achter de hand, dan regelen we dat ook.',
      },
      {
        q: 'Wat doen we met kleding van mensen die vertrekken?',
        a: 'Laat die terugbrengen en houd ze apart in de maat. Een polo die een half jaar gedragen is, kan vaak nog prima mee voor een nieuwe kracht of als reserve. In het portaal zie je per medewerker wat er is uitgegeven, dus je weet ook wat er terug hoort te komen.',
      },
      {
        q: 'Hebben jullie ervaring met winkels met meerdere vestigingen?',
        a: 'Juist dan helpt het om de lijn één keer goed vast te leggen. Een filiaal in Winterswijk bestelt dan precies hetzelfde als dat in Zutphen of Duiven. We komen per vestiging langs om te passen, of één keer centraal als dat beter uitkomt.',
      },
    ],
  },
  {
    slug: 'kapsalon-en-beauty',
    naam: 'Kapsalon en beauty',
    titel: 'Bedrijfskleding voor kapsalons en beauty in de Achterhoek',
    eyebrow: 'Kapsalon en beauty',
    metaDescription:
      "Bedrijfskleding voor kappers, schoonheidssalons, barbiers en nagelstudio's in de Achterhoek en de Liemers. Blouses, tunieken en schorten met subtiel logo.",
    intro:
      'Je staat de hele dag achter een stoel of zit dicht naast je klant, en die kijkt een uur lang naar jou in de spiegel. Haar, kleurmiddel, olie en poeder komen overal terecht. Ondertussen is jouw uitstraling een deel van wat de klant komt halen.',
    waaromAnders: [
      {
        title: 'Haar blijft hangen in de verkeerde stof',
        text: 'Gebreide stof en ruwe katoen houden afgeknipt haar vast, en dan zit het in de kraag van de volgende klant. Een gladde, dicht geweven stof laat het makkelijker los. Je veegt het eraf in plaats van het er de hele middag uit te plukken.',
      },
      {
        title: 'Kleurmiddel en bleking vergeven niets',
        text: 'Eén spat haarverf of een vleugje bleekmiddel en een lichte blouse is weg. Daarom kiezen de meeste salons zwart of een donkere, rustige kleur, met een schort erover voor het kleurwerk. Dat oogt verzorgd en het houdt langer.',
      },
      {
        title: 'Je werkt met je armen omhoog, de hele dag',
        text: 'Knippen, föhnen, opsteken: je armen zijn bijna altijd boven schouderhoogte. Een blouse zonder stretch trekt dan uit de broek of knelt onder de oksel. En na acht uur moet hij er in de spiegel nog net zo uitzien als om negen uur, dus kreukarm is geen luxe.',
      },
    ],
    meestBesteld: [
      'Blouse of top in zwart, met stretch en kreukarme stof',
      'Tuniek voor schoonheidssalon, pedicure en nagelstudio',
      'Schort voor kleurwerk en voor de barbier',
      'Poloshirt of T-shirt met klein geborduurd logo',
      'Vest voor de koudere maanden of een tochtige winkelpui',
    ],
    normen: [],
    productCategorieSlugs: ['blouses-en-overhemden', 't-shirts-en-polos', 'accessoires', 'truien-en-vesten', 'rokken-en-jurken'],
    veelgesteld: [
      {
        q: 'Kan het logo klein en rustig, zonder dat het reclamekleding wordt?',
        a: 'Zeker, en in een salon werkt dat het mooist. We borduren het logo klein op de borst of op de mouw, vaak toon op toon of in één kleur op zwart. We maken eerst een proef in ons atelier in Hengelo Gld, zodat je ziet hoe het op de stof staat voordat de rest erdoor gaat.',
      },
      {
        q: 'Welke stof werkt het best tegen haar en kleurvlekken?',
        a: 'Een gladde, dicht geweven stof met wat polyester laat haar het makkelijkst los en droogt snel na het wassen. Puur katoen voelt prettig, maar houdt haar en vlekken meer vast. Voor het kleurwerk adviseren we hoe dan ook een schort erover; dat is goedkoper te vervangen dan een blouse.',
      },
      {
        q: 'Wij zijn een kleine salon met drie mensen. Is dat niet te klein voor jullie?',
        a: 'Nee. Juist bij een klein team telt dat het goed zit, en we komen gewoon langs in de salon om te passen. Dat doen we in Groenlo net zo goed als in Vorden of Didam. We plannen het op een rustig moment, zodat je geen klanten hoeft te verzetten. Je maten leggen we vast, dus bijbestellen voor een nieuwe collega gaat met één bericht.',
      },
    ],
  },
];
