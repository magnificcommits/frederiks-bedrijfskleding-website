/**
 * Kant-en-klare campagnes. "Kopiëren" maakt er een gewone campagne van (status
 * concept) die Jessi daarna vrij kan aanpassen. Teksten in haar eigen toon:
 * je/jij, kort, lokaal, geen verkooppraat.
 *
 * PUUR: geen server-imports.
 */
import type { Doel, Doelgroep, Flow, Knoop, Trigger } from './flow';
import { standaardTrigger } from './flow';

export type Voorbeeld = {
  sleutel: string;
  naam: string;
  korteUitleg: string;
  /** Waarom deze campagne werkt: één zin uit de praktijk. */
  waarom: string;
  duur: string;
  type: 'cold' | 'nurture' | 'reengage';
  doelgroep: Doelgroep;
  trigger: Trigger;
  doel: Doel;
  /** Bouwt een verse flow met unieke ids. */
  flow: () => Flow;
};

let teller = 0;
const id = (p: string) => `${p}${Date.now().toString(36).slice(-4)}${(teller++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const mail = (onderwerp: string, inhoud: string, extra: { preheader?: string; stijl?: 'persoonlijk' | 'huisstijl'; ai?: boolean } = {}): Knoop => ({
  id: id('m'),
  type: 'mail',
  onderwerp,
  preheader: extra.preheader ?? '',
  inhoud,
  stijl: extra.stijl ?? 'persoonlijk',
  nieuwsbriefId: null,
  ai: extra.ai ?? false,
});
const wacht = (aantal: number, modus: 'dagen' | 'uren' = 'dagen'): Knoop => ({ id: id('w'), type: 'wacht', modus, aantal, weekdag: 1 });
const totWeekdag = (weekdag: number): Knoop => ({ id: id('w'), type: 'wacht', modus: 'weekdag', aantal: 0, weekdag });
const taak = (titel: string, omschrijving: string, binnenDagen = 1, prioriteit: 'laag' | 'normaal' | 'hoog' = 'normaal'): Knoop => ({
  id: id('t'),
  type: 'taak',
  titel,
  omschrijving,
  persoonId: null,
  binnenDagen,
  prioriteit,
});
const tag = (naam: string): Knoop => ({ id: id('g'), type: 'tag', tag: naam, actie: 'toevoegen' });
const status = (prospectStatus: string, leadStatus = ''): Knoop => ({ id: id('s'), type: 'status', prospectStatus, leadStatus });
const einde = (): Knoop => ({ id: id('e'), type: 'einde' });
const als = (soort: 'geopend' | 'geklikt' | 'gescand' | 'gereageerd', mailId: string | null, ja: Knoop[], nee: Knoop[]): Knoop => ({
  id: id('v'),
  type: 'voorwaarde',
  soort,
  mailId,
  waarde: '',
  ja,
  nee,
});

const GROET = 'Groet,\nJessi Frederiks\nFrederiks Bedrijfskleding, Hengelo (Gld)\n06 15 21 50 29';

/* ------------------------------------------------------------------ */

function qrOpvolging(): Flow {
  const m1 = mail(
    'Je keek naar de kleding met jullie logo',
    `Hoi {{voornaam}},

Je hebt de QR-code op mijn brief gescand. Leuk! Dan heb je de werkkleding met het logo van {{bedrijfsnaam}} erop al gezien.

Die voorbeelden heb ik zelf voor jullie gemaakt. In het echt zie je pas goed hoe het valt: de kleur van de stof, de plek van het logo, borduren of bedrukken.

Zal ik een paar stuks meenemen en even langskomen in {{plaats}}? Een half uurtje is genoeg. Passen kan dan meteen.

[knop: Plan een moment](mailto:info@frederiksbedrijfskleding.nl?subject=Afspraak%20werkkleding)

Of bel me gewoon even, dat mag ook.

${GROET}`,
    { preheader: 'De voorbeelden met jullie logo, maar dan in het echt.' },
  );
  const m2 = mail(
    'Nog even over werkkleding voor {{bedrijfsnaam}}',
    `Hoi {{voornaam}},

Vorige week scande je mijn QR-code. Ik wil je niet lastigvallen, maar ik vind het zonde als het hierbij blijft.

Wat ik vaak hoor bij bedrijven in de Achterhoek: "We hebben nu van alles door elkaar, en niemand houdt het bij." Daar ben ik goed in. Eén vast aanspreekpunt, alles met jullie logo, en nabestellen via een eigen portaal.

Je persoonlijke pagina staat nog voor je klaar:
[Bekijk de kleding met jullie logo]({{kennismakingslink}})

Past het nu even niet? Laat het me weten, dan bel ik over een paar maanden nog eens.

${GROET}`,
  );
  return {
    versie: 1,
    stappen: [
      wacht(1),
      m1,
      wacht(3),
      als(
        'geklikt',
        m1.id,
        [taak('Bel {{bedrijfsnaam}}: klikte op afspraak plannen', 'Klikte in de opvolgmail na de QR-scan. Warm contact, vandaag of morgen bellen.', 0, 'hoog'), status('geinteresseerd'), einde()],
        [m2, wacht(4), taak('Langsgaan of bellen: {{bedrijfsnaam}}', 'Scande de QR-code maar reageerde niet op twee mails. Even persoonlijk contact zoeken.', 2)],
      ),
    ],
  };
}

function leadNurture(): Flow {
  const m3 = mail(
    'Borduren of bedrukken?',
    `Hoi {{voornaam}},

Die vraag krijg ik bijna elke week. Mijn eerlijke antwoord:

- **Borduren** voor polo's, softshells en jassen. Ziet er chic uit en gaat jaren mee.
- **Bedrukken** voor T-shirts en hesjes, of als je logo veel kleine details heeft.
- Op veiligheidskleding met reflectie let ik extra op waar het logo komt, zodat de kleding gecertificeerd blijft.

Beide doe ik in eigen huis in de Brouwersmolen. Dus geen weken wachten op een externe drukker.

Stuur je logo gerust mee, dan maak ik een voorbeeld:
[knop: Logo opsturen](mailto:info@frederiksbedrijfskleding.nl?subject=Logo%20voor%20{{bedrijfsnaam}})

${GROET}`,
  );
  return {
    versie: 1,
    stappen: [
      mail(
        'Even voorstellen: ik ben Jessi',
        `Hoi {{voornaam}},

Je deed een aanvraag via de website. Die heb ik gezien. Ik ben Jessi, en ik help je persoonlijk verder. Geen callcenter, gewoon ik, vanuit de Brouwersmolen in Hengelo.

Heb ik je nog niet gesproken? Dan bel ik je deze week. Wil je het sneller? Bel of app me op 06 15 21 50 29.

Handig om alvast klaar te hebben:
- Hoeveel mensen er kleding nodig hebben
- Of er veiligheidseisen zijn (EN ISO 20471, vlamvertragend)
- Je logo, als je dat hebt

${GROET}`,
        { preheader: 'Wie er achter Frederiks Bedrijfskleding zit.' },
      ),
      wacht(2),
      mail(
        'Zo werkt passen op locatie',
        `Hoi {{voornaam}},

Wat veel bedrijven fijn vinden: ik kom gewoon langs met pasmaten. Iedereen past tijdens de koffiepauze, ik noteer de maten, en jij hoeft niets te regelen.

Geen retourtjes omdat een broek te kort is. Geen mensen die een middag naar een winkel moeten.

Bij {{bedrijfsnaam}} in {{plaats}} zit ik zo. De Achterhoek is mijn thuis.

${GROET}`,
      ),
      wacht(4),
      m3,
      als('geklikt', m3.id, [taak('Logo-voorbeeld maken voor {{bedrijfsnaam}}', 'Klikte op "logo opsturen" in de nurture-mail. Check de inbox en maak een voorbeeld.', 1, 'hoog')], []),
      wacht(5),
      mail(
        'Wat andere bedrijven uit de regio zeggen',
        `Hoi {{voornaam}},

Ik laat liever klanten aan het woord dan mezelf:

_"Jessi heeft ons zeer goed geholpen met de aanschaf van onze werkkleding. Ook keuze in grote maten. De bedrukking van de logo's is slijtvast."_ Overbeek Bouw

_"We kopen al jaren onze bedrijfskleding bij Jessi. Als het er niet is bestelt ze een pasmaat. Ze denkt mee."_ All Waves

Benieuwd wat ik voor {{bedrijfsnaam}} kan doen? Antwoord gewoon op deze mail.

${GROET}`,
      ),
      wacht(7),
      mail(
        'Zal ik even langskomen?',
        `Hoi {{voornaam}},

Het is drie weken geleden dat je je aanvraag deed. Misschien is het druk, dat snap ik.

Mijn voorstel: ik kom een keer langs met een tas vol voorbeelden. Je zit nergens aan vast. Een half uur, en je weet precies wat het kost.

Welke dag komt jou uit?

${GROET}`,
      ),
      wacht(2),
      taak('Lead {{bedrijfsnaam}} nabellen', 'Vijf mails gehad in drie weken, nog geen afspraak. Even bellen.', 1),
    ],
  };
}

function koudeAcquisitie(): Flow {
  const m1 = mail(
    'Werkkleding voor {{bedrijfsnaam}}',
    `Hoi {{voornaam}},

{{ai}}

Ik ben Jessi Frederiks van Frederiks Bedrijfskleding in Hengelo. Ik lever werkkleding en veiligheidsschoenen aan bedrijven in de Achterhoek, met het logo erop geborduurd of bedrukt in eigen huis.

Wat ik anders doe dan een webshop: ik kom langs om te passen, en je hebt één vast aanspreekpunt dat jullie bedrijf kent.

Is werkkleding bij {{bedrijfsnaam}} iets waar je nu mee bezig bent? Een kort antwoord is genoeg, ook als het "nee" is.

${GROET}

Liever geen mail van mij? Klik onderaan op afmelden, dan hoor je niets meer.`,
    { ai: true },
  );
  return {
    versie: 1,
    stappen: [
      m1,
      wacht(4),
      mail(
        'Re: Werkkleding voor {{bedrijfsnaam}}',
        `Hoi {{voornaam}},

Even een duwtje, voor het geval mijn vorige mail tussen de rest is beland.

Eén ding dat ik vaak zie bij bedrijven in de {{branche}}: kleding die per persoon los besteld wordt, overal een ander logo. Ik zet dat graag voor je op een rij.

Zal ik een keer langskomen in {{plaats}}?

${GROET}`,
      ),
      wacht(6),
      mail(
        'Laatste mail van mij',
        `Hoi {{voornaam}},

Ik ga je niet blijven mailen. Dit is de laatste.

Mocht er later iets spelen rond werkkleding, schoenen of logo's op kleding, dan weet je me te vinden: 06 15 21 50 29, of gewoon een mail terug.

Succes met alles bij {{bedrijfsnaam}}.

${GROET}`,
      ),
      wacht(3),
      als('geopend', null, [taak('Bel {{bedrijfsnaam}}: opende de acquisitiemails', 'Wel geopend, niet gereageerd. Kort bellen of het nu speelt.', 2)], [tag('koud-geen-reactie')]),
      einde(),
    ],
  };
}

function welkomKlant(): Flow {
  const m2 = mail(
    'Zo bestel je via jullie eigen portaal',
    `Hoi {{voornaam}},

{{bedrijfsnaam}} heeft een eigen bestelportaal bij mij. Daar staat alleen de kleding die bij jullie hoort, met het goede logo en de goede prijzen.

Zo werkt het:
- Log in met je e-mailadres, je krijgt een inloglink
- Kies per medewerker de kleding en de maat
- Ik zie de bestelling meteen binnenkomen en ga aan de slag

[knop: Naar het portaal]({{portaallink}})

Lukt iets niet? Bel me, dan lopen we het samen door.

${GROET}`,
    { stijl: 'huisstijl' },
  );
  return {
    versie: 1,
    stappen: [
      mail(
        'Welkom bij Frederiks Bedrijfskleding',
        `Hoi {{voornaam}},

Wat fijn dat {{bedrijfsnaam}} voor mij kiest. Ik ben Jessi, en ik ben vanaf nu je vaste aanspreekpunt. Voor alles: bestellingen, maten, een logo dat net anders moet.

Je bereikt me op 06 15 21 50 29 of via deze mail. Op werkdagen hoor je binnen 24 uur van me.

In een volgende mail leg ik uit hoe het bestelportaal werkt. Daarmee bestel je zelf, wanneer het jou uitkomt.

${GROET}`,
        { stijl: 'huisstijl', preheader: 'Je vaste aanspreekpunt, en wat er nu gebeurt.' },
      ),
      wacht(2),
      m2,
      wacht(5),
      als('geklikt', m2.id, [], [taak('Portaal uitleggen aan {{bedrijfsnaam}}', 'Heeft de portaal-mail niet aangeklikt. Even bellen en samen inloggen.', 2)]),
      wacht(14),
      mail(
        'Alles naar wens?',
        `Hoi {{voornaam}},

Jullie zijn nu een paar weken klant. Hoe bevalt het?

Ik hoor het graag als iets beter kan. Een maat die niet lekker valt, een levering die te lang duurde: zeg het gerust. Daar leer ik van.

${GROET}`,
      ),
    ],
  };
}

function heractivatie(): Flow {
  const m1 = mail(
    'Lang niet gesproken, {{voornaam}}',
    `Hoi {{voornaam}},

Het is alweer een tijdje geleden dat {{bedrijfsnaam}} iets bij me bestelde. Ik vroeg me af hoe het met jullie gaat.

Zijn er nieuwe mensen bij gekomen? Is de kleding van het eerste uur aan vervanging toe? Na een jaar of twee intensief dragen zie je dat vaak aan de knieën en de manchetten.

Ik kom graag even kijken. Geen verplichtingen.

${GROET}`,
  );
  return {
    versie: 1,
    stappen: [
      m1,
      wacht(7),
      als(
        'geopend',
        m1.id,
        [taak('Bel {{bedrijfsnaam}}: slapende klant opende mail', 'Geen order in lange tijd, maar las wel de mail. Goed moment om te bellen.', 1, 'hoog')],
        [
          mail(
            'Nieuw in de collectie',
            `Hoi {{voornaam}},

Even kort: er is nieuwe werkkleding binnen die ik graag laat zien. Lichtere stretchbroeken die echt meebewegen, en softshells die tegen een buitje kunnen.

Zal ik een paar stuks meenemen naar {{plaats}}?

${GROET}`,
          ),
          wacht(10),
          taak('Slapende klant {{bedrijfsnaam}} bellen', 'Twee mails gehad, geen reactie. Persoonlijk contact.', 2),
        ],
      ),
    ],
  };
}

function winterkleding(): Flow {
  const m1 = mail(
    'Winterjassen: nu bestellen is op tijd',
    `Hoi {{voornaam}},

Het voelt nog als nazomer, maar dit is precies het moment voor winterjassen. Leveranciers hebben nu nog alle maten. In november wordt het passen en meten.

Voor {{bedrijfsnaam}} denk ik aan:
- Een warme parka voor wie buiten werkt
- Een softshell voor tussendoor
- Thermo-ondergoed, vaak vergeten en goud waard

Met jullie logo erop, uiteraard. Zal ik een voorstel maken?

[knop: Ja, maak een voorstel](mailto:info@frederiksbedrijfskleding.nl?subject=Winterjassen%20{{bedrijfsnaam}})

${GROET}`,
    { stijl: 'huisstijl', preheader: 'Nu zijn alle maten er nog.' },
  );
  return {
    versie: 1,
    stappen: [
      m1,
      wacht(7),
      als(
        'geklikt',
        m1.id,
        [taak('Winterjassen-voorstel maken voor {{bedrijfsnaam}}', 'Klikte op "maak een voorstel" in de wintermail.', 1, 'hoog'), einde()],
        [
          totWeekdag(2),
          mail(
            'Nog even over de winterjassen',
            `Hoi {{voornaam}},

Vorige week mailde ik over winterkleding. De eerste koude ochtenden komen eraan, en dan wil iedereen tegelijk.

Laat je even weten of ik iets voor {{bedrijfsnaam}} klaar moet zetten? Dan kom ik met pasmaten langs.

${GROET}`,
          ),
        ],
      ),
    ],
  };
}

function reviewNaLevering(): Flow {
  const m1 = mail(
    'Past alles?',
    `Hoi {{voornaam}},

De bestelling voor {{bedrijfsnaam}} is een paar dagen binnen. Past alles, en zit het logo waar het moet?

Is er iets niet goed, dan los ik het op. Antwoord gewoon op deze mail.

En ben je tevreden? Dan zou ik het heel fijn vinden als je dat in een paar woorden op Google zet. Voor een kleine zaak als de mijne maakt dat echt verschil.

[knop: Schrijf een review]({{reviewlink}})

${GROET}`,
  );
  return {
    versie: 1,
    stappen: [
      wacht(3),
      m1,
      wacht(5),
      als(
        'geklikt',
        m1.id,
        [],
        [
          mail(
            'Een minuutje?',
            `Hoi {{voornaam}},

Nog één keertje, beloofd. Als je tevreden bent over de kleding, helpt een korte review me enorm. Andere bedrijven in de regio kiezen vaak op basis van wat ze daar lezen.

[Review schrijven]({{reviewlink}})

Dank je wel!

${GROET}`,
          ),
        ],
      ),
    ],
  };
}

function spaarniveau(): Flow {
  const m1 = mail(
    'Je zit vlak onder {{volgend_niveau}}',
    `Hoi {{voornaam}},

Even een seintje: {{bedrijfsnaam}} zit vlak onder het volgende spaarniveau, {{volgend_niveau}}. Op dit moment staan er {{spaarsaldo}} punten op jullie teller.

Met nog een bestelling ben je er waarschijnlijk. Staat er nog iets op het lijstje? Denk aan nieuwe collega's, extra T-shirts voor de zomer of reserve-veiligheidsschoenen.

[knop: Bestellen via het portaal]({{portaallink}})

Twijfel je wat handig is? Bel me even, dan kijken we samen.

${GROET}`,
    { stijl: 'huisstijl' },
  );
  return {
    versie: 1,
    stappen: [m1, wacht(10), als('geklikt', m1.id, [taak('Spaarniveau bespreken met {{bedrijfsnaam}}', 'Klikte op de spaarmail en zit vlak onder het volgende niveau. Even bellen of er nog iets nodig is.', 1)], []), einde()],
  };
}

/* ------------------------------------------------------------------ */

export const VOORBEELDEN: Voorbeeld[] = [
  {
    sleutel: 'qr-opvolging',
    naam: 'Opvolging na QR-scan',
    korteUitleg: 'Wie de QR-code op je brief scant, krijgt een dag later een persoonlijke mail. Klikt iemand, dan krijg jij een beltaak.',
    waarom: 'Een scan is het warmste moment dat je met een onbekende prospect hebt. Na een week is iemand het vergeten.',
    duur: '8 dagen',
    type: 'cold',
    doelgroep: 'prospect',
    trigger: standaardTrigger('qr_scan'),
    doel: { soorten: ['afspraak', 'klant', 'gereageerd'] },
    flow: qrOpvolging,
  },
  {
    sleutel: 'lead-nurture',
    naam: 'Nieuwe lead: 5 mails in 3 weken',
    korteUitleg: 'Bevestiging, passen op locatie, borduren of bedrukken, reviews en een uitnodiging. Stopt vanzelf bij een afspraak.',
    waarom: 'De meeste aanvragers zijn nog aan het rondkijken. Wie in die weken behulpzaam blijft, wordt gekozen.',
    duur: '3 weken',
    type: 'nurture',
    doelgroep: 'lead',
    trigger: standaardTrigger('lead_nieuw'),
    doel: { soorten: ['afspraak', 'offerte', 'klant'] },
    flow: leadNurture,
  },
  {
    sleutel: 'koude-acquisitie',
    naam: 'Koude acquisitie B2B',
    korteUitleg: 'Drie korte mails met een AI-openingszin per bedrijf en een nette afsluiter. Daarna een beltaak voor wie wel las.',
    waarom: 'Drie mails is de grens: genoeg om op te vallen, niet zo veel dat je irriteert. De laatste mail krijgt vaak de meeste antwoorden.',
    duur: '13 dagen',
    type: 'cold',
    doelgroep: 'prospect',
    trigger: standaardTrigger('handmatig'),
    doel: { soorten: ['gereageerd', 'afspraak', 'klant'] },
    flow: koudeAcquisitie,
  },
  {
    sleutel: 'welkom-klant',
    naam: 'Welkom nieuwe klant en portaal',
    korteUitleg: 'Welkomstmail, uitleg van het bestelportaal en na drie weken de vraag of alles naar wens is.',
    waarom: 'Klanten die het portaal in de eerste maand gebruiken, bestellen daarna vaker zelf. Dat scheelt jou telefoontjes.',
    duur: '3 weken',
    type: 'nurture',
    doelgroep: 'klant',
    trigger: standaardTrigger('klant_nieuw'),
    doel: { soorten: [] },
    flow: welkomKlant,
  },
  {
    sleutel: 'heractivatie',
    naam: 'Slapende klanten wakker maken',
    korteUitleg: 'Klanten die al een half jaar niets bestelden krijgen een persoonlijke mail. Opent iemand hem, dan bel jij.',
    waarom: 'Een bestaande klant terugwinnen kost een fractie van een nieuwe vinden. Vaak is er gewoon niemand die eraan denkt.',
    duur: '17 dagen',
    type: 'reengage',
    doelgroep: 'klant',
    trigger: standaardTrigger('klant_slapend'),
    doel: { soorten: ['order'] },
    flow: heractivatie,
  },
  {
    sleutel: 'winterkleding',
    naam: 'Seizoen: winterkleding',
    korteUitleg: 'In september of oktober een mail over winterjassen, met een herinnering op dinsdag voor wie niet klikte.',
    waarom: 'In oktober zijn alle maten er nog. In november wil iedereen tegelijk en zijn de populaire maten op.',
    duur: '10 dagen',
    type: 'nurture',
    doelgroep: 'klant',
    trigger: standaardTrigger('handmatig'),
    doel: { soorten: ['order'] },
    flow: winterkleding,
  },
  {
    sleutel: 'review-na-levering',
    naam: 'Review vragen na levering',
    korteUitleg: 'Drie dagen na levering: past alles? En zo ja, een review op Google. Eén herinnering voor wie niet klikte.',
    waarom: 'Op dag drie is de kleding uitgepakt en gepast. Dan is iemand het meest tevreden, of hoor je meteen wat er mis is.',
    duur: '8 dagen',
    type: 'nurture',
    doelgroep: 'klant',
    trigger: standaardTrigger('order_geleverd'),
    doel: { soorten: [] },
    flow: reviewNaLevering,
  },
  {
    sleutel: 'spaarniveau',
    naam: 'Bijna een spaarniveau omhoog',
    korteUitleg: 'Klanten die voor 80% op weg zijn naar hun volgende spaarniveau krijgen een seintje, met een beltaak als ze klikken.',
    waarom: 'Mensen maken graag iets vol. "Je zit vlak onder Goud" is een betere reden om te bestellen dan elke aanbieding.',
    duur: '10 dagen',
    type: 'nurture',
    doelgroep: 'klant',
    trigger: { ...standaardTrigger('spaar_bijna'), herhalen: true, herhaalNaDagen: 90 },
    doel: { soorten: ['order'] },
    flow: spaarniveau,
  },
];

export function vindVoorbeeld(sleutel: string): Voorbeeld | null {
  return VOORBEELDEN.find((v) => v.sleutel === sleutel) ?? null;
}
