/**
 * Vakgebiedpagina's (/voor/[slug]). Landelijke webshops schalen op plaatsnaam;
 * op het vak zelf doen ze bijna niets. Daar zit voor ons de ruimte.
 *
 * Elke pagina beschrijft eerst het werk en pas daarna de kleding, telkens
 * gekoppeld aan de Achterhoek en de Liemers. Houd de teksten uniek en concreet.
 * Geen prijzen: de call to action is advies, offerte of een pasafspraak.
 */

export type NormRef = {
  /** Slug van de normpagina onder /normen/<slug>. */
  slug: string;
  code: string;
  naam: string;
  /** Waarom deze norm juist in dit vak speelt. */
  waarom: string;
};

export type Vakgebied = {
  slug: string;
  naam: string;
  titel: string;
  eyebrow: string;
  /** Metabeschrijving; de streek staat er altijd in. */
  metaDescription: string;
  /** Twee tot drie zinnen over het werk, niet over de kleding. */
  intro: string;
  waaromAnders: { title: string; text: string }[];
  meestBesteld: string[];
  normen: NormRef[];
  /** Slugs uit CATEGORIEEN in lib/kms/catalogus.ts. */
  productCategorieSlugs: string[];
  veelgesteld: { q: string; a: string }[];
};

/**
 * Plaatsen waar we langskomen om te passen. Achterhoek en Liemers, bewust met
 * de dorpen erbij: daar zoekt niemand anders op.
 */
export const werkgebiedPlaatsen: string[] = [
  'Hengelo Gld', 'Zelhem', 'Vorden', 'Steenderen', 'Keijenborg', 'Baak',
  'Doetinchem', 'Wehl', 'Gaanderen', 'Terborg', 'Ulft', 'Varsseveld',
  'Ruurlo', 'Borculo', 'Lichtenvoorde', 'Groenlo', 'Zutphen', 'Aalten',
  'Winterswijk', 'Didam', 'Zevenaar', 'Duiven',
];

export const vakgebieden: Vakgebied[] = [
  {
    slug: 'hoveniers-en-groenvoorziening',
    naam: 'Hoveniers en groenvoorziening',
    titel: 'Werkkleding voor hoveniers in de Achterhoek',
    eyebrow: 'Groen en buitenwerk',
    metaDescription:
      'Werkkleding voor hoveniers en groenvoorzieners in de Achterhoek en de Liemers. Broeken met kniebescherming, hi-vis voor bermwerk en schoenen die tegen nat gras kunnen. We komen langs om te passen.',
    intro:
      'Je begint om zeven uur in het natte gras en eindigt in de volle zon. Bosmaaier, kettingzaag, doornhagen, aarde en boomhars gaan de hele dag door je kleding heen. En sta je in de berm langs een provinciale weg, dan moet je gezien worden voordat je gehoord wordt.',
    waaromAnders: [
      {
        title: 'Doorns en takken trekken de stof open',
        text: 'Een dunne broek scheurt bij de eerste bramenstruik. Op de knie, het kruis en de onderbenen heb je stof nodig die tegen trekken kan, met versteviging op de plekken waar je door de heg gaat.',
      },
      {
        title: 'Groen en hars wassen er nooit meer uit',
        text: 'Grassap, aarde en hars bijten zich vast in goedkoop weefsel. Na drie wasbeurten ziet lichte kleding er vies uit terwijl ze schoon is, en zo sta je in de tuin van je klant.',
      },
      {
        title: 'Knielen zonder bescherming kost je je knieën',
        text: 'Beplanting zetten doe je op je knieën, uren achter elkaar. Zonder kniezakken schuiven losse kussens weg en druk je grind in je knieschijf. Dat merk je pas na jaren, en dan is het te laat.',
      },
    ],
    meestBesteld: [
      'Werkbroek met kniezakken en stretch in de knieholte',
      'Korte werkbroek voor de zomermaanden',
      "Poloshirts en T-shirts die na dertig wasbeurten nog kleur houden",
      'Signaalshirt of hi-vis bodywarmer voor werk in de berm',
      'Softshell voor het tussenseizoen en een echte regenjas voor het najaar',
      'Werkschoen of laars S3 met stevige zool en enkelsteun',
    ],
    normen: [
      { slug: 'en-iso-20471', code: 'EN ISO 20471', naam: 'Hoge zichtbaarheid', waarom: 'Voor bermonderhoud en werk langs de openbare weg. De wegbeheerder bepaalt meestal de klasse.' },
      { slug: 'en-14404', code: 'EN 14404', naam: 'Kniebescherming', waarom: 'Voor knielend plantwerk. De bescherming werkt alleen in een broek met de juiste kniezakken.' },
      { slug: 'en-343', code: 'EN 343', naam: 'Bescherming tegen regen', waarom: 'Je werkt door als het regent. Waterdicht en ademend scheelt een middag klam werken.' },
      { slug: 'en-iso-20345', code: 'EN ISO 20345', naam: 'Veiligheidsschoenen', waarom: 'Tegen een schep, een steen of een tak. S3 voor nat en modderig terrein.' },
    ],
    productCategorieSlugs: ['broeken', 'korte-broeken', 't-shirts-en-polos', 'jassen', 'werkschoenen', 'truien-en-vesten'],
    veelgesteld: [
      {
        q: 'Hebben mijn mensen hi-vis nodig als ze langs de weg werken?',
        a: 'Zodra je op of langs de rijbaan werkt wel. Voor bermonderhoud langs een provinciale weg wordt meestal klasse 3 gevraagd, binnen de bebouwde kom of op een afgezet terrein volstaat vaak klasse 2. De opdrachtgever of wegbeheerder stelt de eis; we kijken samen wat er in jouw bestek staat.',
      },
      {
        q: 'Kan ik korte broeken toevoegen zonder de rest van de lijn te veranderen?',
        a: 'Ja. We zoeken de korte broek uit dezelfde serie of in dezelfde kleur, zodat het bij elkaar blijft staan. Het logo komt op dezelfde plek, dus in de zomer ziet je ploeg er niet anders uit.',
      },
      {
        q: 'Hoe vaak moeten we hoveniersbroeken vervangen?',
        a: 'Bij fulltime buitenwerk is één tot anderhalf jaar realistisch, en de broek gaat altijd eerder dan de shirts. Daarom houden we je maten en artikelen vast: nabestellen is dan een telefoontje, en nieuwe mensen zijn binnen een week aangekleed.',
      },
    ],
  },
  {
    slug: 'bouw-en-aannemers',
    naam: 'Bouw en aannemers',
    titel: 'Werkkleding voor de bouw in de Achterhoek',
    eyebrow: 'Bouw en aanneming',
    metaDescription:
      'Werkkleding voor bouwbedrijven en aannemers in de Achterhoek en de Liemers. Broeken met holsterzakken, hi-vis, winterjassen en veiligheidsschoenen. Passen op de bouwplaats of in de loods.',
    intro:
      'Steiger op, kruipruimte in, platen tillen, en daarna op een dak in de wind. Er zit gereedschap in je zakken, er ligt puin waar je op knielt en het beton en de mortel gaan overal doorheen. In november werk je gewoon door, alleen dan met vier lagen aan.',
    waaromAnders: [
      {
        title: 'Zakken en naden gaan als eerste',
        text: 'Duimstok, schroeven, mes en telefoon trekken allemaal aan dezelfde naad. Bij een broek zonder verstevigde spijkerzakken hangt de zak er na een maand half uit, en dan is de rest van de broek nog prima.',
      },
      {
        title: 'Losse kleding blijft haken',
        text: 'Wijde mouwen en een flapperende jas zijn een risico bij een boormachine, een steiger of hijswerk. Kleding moet aansluiten zonder dat je bewegingsvrijheid inlevert bij het reiken boven je hoofd.',
      },
      {
        title: 'Eén dikke jas werkt niet',
        text: 'In een gevoerde winterjas sta je binnen tien minuten te zweten en daarna klam in de wind. Je hebt lagen nodig die je in de loop van de dag aan en uit kunt doen, anders hangt die jas na een week in de bus.',
      },
    ],
    meestBesteld: [
      'Werkbroek met holsterzakken, kniezakken en stretch',
      'Signaalshirt en hi-vis bodywarmer over de eigen trui',
      'Softshelljas voor het tussenseizoen',
      'Gevoerde winterjas, het liefst met uitritsbare mouwen',
      'Werkschoen of werklaars S3 met doorstapbescherming',
      'Hoodie of sweater met logo voor onderweg en in de bus',
    ],
    normen: [
      { slug: 'en-iso-20471', code: 'EN ISO 20471', naam: 'Hoge zichtbaarheid', waarom: 'Op vrijwel elke bouwplaats verplicht gesteld door de hoofdaannemer, meestal klasse 2 of 3.' },
      { slug: 'en-14404', code: 'EN 14404', naam: 'Kniebescherming', waarom: 'Voor vloerwerk, tegelwerk en installatiewerk op de knieën.' },
      { slug: 'en-iso-20345', code: 'EN ISO 20345', naam: 'Veiligheidsschoenen', waarom: 'S3 met tussenzool tegen spijkers en een neus die een vallende plaat opvangt.' },
      { slug: 'en-343', code: 'EN 343', naam: 'Bescherming tegen regen', waarom: 'Voor buitenwerk dat niet stilligt als het giet.' },
    ],
    productCategorieSlugs: ['broeken', 't-shirts-en-polos', 'jassen', 'bodywarmers', 'werkschoenen', 'truien-en-vesten'],
    veelgesteld: [
      {
        q: 'Kunnen we het logo van onze opdrachtgever ook op de kleding krijgen?',
        a: 'Dat kan, en het gebeurt vaker bij langere projecten. We houden dan een aparte set apart voor dat werk, zodat je eigen lijn intact blijft. Het borduren en bedrukken doen we in eigen huis in Hengelo Gld, dus je ziet vooraf een proef.',
      },
      {
        q: 'Wat is het verschil tussen klasse 2 en klasse 3 hi-vis?',
        a: 'Het gaat om de hoeveelheid fluorescerend materiaal en reflectie. Klasse 3 vraagt om mouwen met reflectie, dus een jas of een shirt met lange mouw; een hesje alleen komt niet verder dan klasse 2. Werk je in het donker of langs snelverkeer, dan is klasse 3 het uitgangspunt.',
      },
      {
        q: 'We nemen regelmatig nieuwe mensen aan. Hoe regelen we dat snel?',
        a: 'We leggen je pakket en de maten van je ploeg vast, zodat een nieuwe kracht met één bericht is aangekleed. Weet je de maat niet zeker, dan komen we langs met de paskoffer of laten we hem eerst passen voordat het logo erop gaat.',
      },
    ],
  },
  {
    slug: 'schilders-en-afbouw',
    naam: 'Schilders en afbouw',
    titel: 'Werkkleding voor schilders en afbouw in de Achterhoek',
    eyebrow: 'Schilders en afbouw',
    metaDescription:
      'Werkkleding voor schilders, stukadoors en afbouwbedrijven in de Achterhoek en de Liemers. Witte schildersbroeken, overalls voor spuitwerk en kniebescherming. Persoonlijk advies en passen op locatie.',
    intro:
      'Je werkt in het huis van iemand anders, tussen zijn spullen en zijn vloer. Verf, plamuur, schuurstof en spuitnevel komen overal, en toch moet je er bij de voordeur verzorgd uitzien. Het meeste werk gebeurt boven je hoofd of op je knieën, met je gereedschap aan je lijf.',
    waaromAnders: [
      {
        title: 'Wit blijft niet vanzelf wit',
        text: 'Dun katoen wordt grauw na een paar wasbeurten en houdt vlekken vast. Dan sta je bij een particuliere klant in kleding die er onverzorgd uitziet terwijl je strak werk aflevert. Dat is precies de indruk die je niet wilt maken.',
      },
      {
        title: 'Zonder de juiste zakken ligt alles op de vloer van de klant',
        text: 'Kwast, mes, plakband, schuurblokjes en telefoon moet je bij je dragen. Een broek zonder holsterzakken en gereedschapslussen betekent spullen op de vensterbank en op de trap.',
      },
      {
        title: 'Stof en nevel neem je mee naar de volgende ruimte',
        text: 'Bij machinaal schuren of spuiten hecht alles zich aan open weefsel. Zonder gesloten kleding of een overall loop je het huis door met stof aan je broek, en neem je het ook nog mee naar huis.',
      },
    ],
    meestBesteld: [
      'Witte schildersbroek met kniezakken en holsterzakken',
      'Overall of stofoverall voor spuit- en schuurwerk',
      "Poloshirts en T-shirts in wit of in de bedrijfskleur",
      'Sweater of vest voor koude nieuwbouw zonder verwarming',
      'Lichte werkschoen S1P met antislipzool voor binnenwerk',
    ],
    normen: [
      { slug: 'en-14404', code: 'EN 14404', naam: 'Kniebescherming', waarom: 'Voor plinten, vloeren en kozijnen aan de onderkant: uren op je knieën per dag.' },
      { slug: 'en-13034', code: 'EN 13034', naam: 'Beperkte bescherming tegen vloeibare chemicaliën', waarom: 'Bij spuitwerk en het werken met oplosmiddelen en beits.' },
      { slug: 'en-iso-20345', code: 'EN ISO 20345', naam: 'Veiligheidsschoenen', waarom: 'Antislip is hier belangrijker dan een zware neus: je staat op trappen, ladders en gladde folie.' },
    ],
    productCategorieSlugs: ['broeken', 'overalls', 't-shirts-en-polos', 'truien-en-vesten', 'werkschoenen'],
    veelgesteld: [
      {
        q: 'Blijft witte schilderskleding echt wit?',
        a: 'Nooit helemaal, maar het scheelt enorm welke stof je kiest. Een dichtgeweven katoenmix laat verf minder diep intrekken en verdraagt een hogere wastemperatuur. Wij adviseren wat in de praktijk het langst netjes blijft, en zeggen het ook als een artikel dat niet waarmaakt.',
      },
      {
        q: 'Kan het logo op witte kleding zonder dat het er goedkoop uitziet?',
        a: 'Ja. Op wit werkt borduren meestal mooier dan drukken, zeker bij een logo met meerdere kleuren. We maken eerst een proef, zodat je ziet hoe het staat voordat we de hele serie doen.',
      },
      {
        q: 'Hebben we aparte kleding nodig voor spuitwerk?',
        a: 'Voor het spuiten van watergedragen lak vaak niet, voor oplosmiddelhoudende producten en isocyanaten wel. Dan werk je met kleding volgens EN 13034 of met een wegwerpoverall, en die gaat daarna apart in de was. We kijken samen naar het veiligheidsblad van het product dat je gebruikt.',
      },
    ],
  },
  {
    slug: 'installatie-en-techniek',
    naam: 'Installatie en techniek',
    titel: 'Werkkleding voor installateurs en technici in de Achterhoek',
    eyebrow: 'Installatie en techniek',
    metaDescription:
      'Werkkleding voor installateurs, elektromonteurs en servicetechnici in de Achterhoek en de Liemers. Multinorm, vlamboogbescherming en antistatische kleding. Advies over de juiste klasse, passen op locatie.',
    intro:
      'Vandaag een meterkast in een rijtjeshuis, morgen een verdeelinrichting op een bedrijventerrein. Je kruipt over zolders, ligt onder een ketel en staat een half uur later bij de klant in de keuken uit te leggen wat je gedaan hebt. Op een deel van wat je aanraakt staat nog spanning.',
    waaromAnders: [
      {
        title: 'Bij een vlamboog smelt gewone kleding vast op de huid',
        text: 'Werk aan of dicht bij installaties onder spanning kan een vlamboog geven. Polyester smelt dan en plakt vast, waardoor een brandwond veel dieper wordt. Vlamboogbestendige kleding voorkomt precies dat, maar alleen als de hele laag klopt, ook het shirt eronder.',
      },
      {
        title: 'Een vonk uit je trui is genoeg',
        text: 'In ruimtes met stof, gas of gevoelige elektronica is statische lading een reëel probleem. Antistatische kleding voert die lading af; een gewone fleece bouwt hem juist op.',
      },
      {
        title: 'Je werkt in ruimtes waar je niet rechtop staat',
        text: 'Kruipruimte, zolder, technische ruimte. Kleding die op de schouders trekt of achter isolatie blijft haken kost je tijd bij elke klus en is binnen een half jaar aan de knieën en ellebogen kapot.',
      },
    ],
    meestBesteld: [
      'Multinorm werkbroek en jack voor werk aan installaties',
      'Vlamvertragend shirt met lange mouw als onderlaag',
      'Antistatisch vest of softshell voor de servicebus',
      'Bodywarmer voor onverwarmde technische ruimtes',
      'Werkschoen S3 met composiet neus en tussenzool, dus zonder metaal',
      'Geborduurd poloshirt voor het moment dat je bij de klant aan tafel zit',
    ],
    normen: [
      { slug: 'iec-61482', code: 'IEC 61482', naam: 'Bescherming tegen vlamboog', waarom: 'Voor werk aan of nabij delen onder spanning. De klasse hangt af van de kortsluitstroom op die installatie.' },
      { slug: 'en-1149-5', code: 'EN 1149-5', naam: 'Antistatische kleding', waarom: 'In ruimtes met explosiegevaar of gevoelige elektronica. Werkt alleen als de kleding gesloten gedragen wordt.' },
      { slug: 'en-iso-11612', code: 'EN ISO 11612', naam: 'Bescherming tegen hitte en vlammen', waarom: 'Vaak gecombineerd met vlamboogbescherming in één multinorm artikel.' },
      { slug: 'en-iso-20345', code: 'EN ISO 20345', naam: 'Veiligheidsschoenen', waarom: 'Bij elektrotechnisch werk meestal met composiet in plaats van staal.' },
    ],
    productCategorieSlugs: ['broeken', 't-shirts-en-polos', 'jassen', 'bodywarmers', 'werkschoenen'],
    veelgesteld: [
      {
        q: 'Welke vlamboogklasse hebben mijn monteurs nodig?',
        a: 'Dat volgt uit de risicobeoordeling van de installaties waar ze aan werken, niet uit een algemene regel. Klasse 1 dekt lichtere situaties, klasse 2 het zwaardere werk. Weet je het niet zeker, dan kijken we samen naar wat je werkverantwoordelijke heeft vastgelegd voordat we iets bestellen.',
      },
      {
        q: 'Mag ik onder multinormkleding een gewoon T-shirt dragen?',
        a: 'Liever niet. Een polyester shirt eronder kan bij hitte alsnog smelten, ook als je bovenlaag klopt. Kies een vlamvertragend shirt of in elk geval puur katoen als onderlaag; dat is een kleine aanpassing met een groot verschil.',
      },
      {
        q: 'Gaat het logo door de beschermende werking van de kleding heen?',
        a: 'Alleen als het verkeerd wordt aangebracht. Op multinormkleding gebruiken we gecertificeerd materiaal en de juiste techniek, op de plekken die de fabrikant vrijgeeft. Wij doen dat in eigen huis, dus we weten precies wat er op jouw kleding is gebeurd.',
      },
    ],
  },
  {
    slug: 'metaal-en-industrie',
    naam: 'Metaal en industrie',
    titel: 'Werkkleding voor metaal en industrie in de Achterhoek',
    eyebrow: 'Metaal en industrie',
    metaDescription:
      'Werkkleding voor metaalbedrijven, lassers en machinebouw in de Achterhoek en de Liemers. Laskleding volgens EN ISO 11611, multinorm en overalls. Advies over de juiste norm en passen in je eigen hal.',
    intro:
      'Lassen, slijpen, zetten, monteren. Vonken vliegen alle kanten op, spanen komen gloeiend los en op de vloer ligt een laagje olie. In een hal die in juli benauwd is en in januari tocht bij elke roldeur die opengaat.',
    waaromAnders: [
      {
        title: 'Synthetische stof smelt en plakt vast',
        text: 'Eén lasspat op een gewone polyester trui brandt een gat en hecht aan de huid. Bij las- en slijpwerk hoort katoen of vlamvertragend weefsel, ook voor wie er alleen even bij staat te kijken.',
      },
      {
        title: 'Vonken vinden elke opening',
        text: 'Openstaande borstzakken, een omgeslagen broekspijp en een kraag die openstaat: daar blijft een gloeiende spaan liggen zonder dat je het meteen voelt. Echte laskleding heeft afgedekte sluitingen en geen zakken aan de bovenkant.',
      },
      {
        title: 'Olie en emulsie trekken erin en gaan er niet meer uit',
        text: 'Snijolie en koelvloeistof zitten na een week in de vezel. Kleding die op zestig graden gewassen mag worden blijft langer bruikbaar en ruikt niet; kleding die dat niet aankan gooi je binnen een seizoen weg.',
      },
    ],
    meestBesteld: [
      'Lasjas en lasbroek volgens EN ISO 11611',
      'Multinorm werkbroek en werkjack voor onderhoudsploegen',
      'Katoenen overall voor montage en machinewerk',
      'T-shirts van zwaar katoen, dus geen polyester onder de laskleding',
      'Werkschoen S3 met hittebestendige zool en snelsluiting',
      'Bodywarmer of fleece voor de koude kant van de hal',
    ],
    normen: [
      { slug: 'en-iso-11611', code: 'EN ISO 11611', naam: 'Lassen en verwante processen', waarom: 'Klasse 1 voor licht laswerk met weinig spatten, klasse 2 voor zwaarder werk en werken boven het hoofd.' },
      { slug: 'en-iso-11612', code: 'EN ISO 11612', naam: 'Bescherming tegen hitte en vlammen', waarom: 'Voor werk bij ovens, gietwerk en stralingswarmte.' },
      { slug: 'en-1149-5', code: 'EN 1149-5', naam: 'Antistatische kleding', waarom: 'In productieruimtes met stof of oplosmiddelen in de lucht.' },
      { slug: 'en-iso-20345', code: 'EN ISO 20345', naam: 'Veiligheidsschoenen', waarom: 'S3 met een neus die een vallend werkstuk opvangt en een zool die niet wegglijdt op olie.' },
    ],
    productCategorieSlugs: ['overalls', 'broeken', 'jassen', 't-shirts-en-polos', 'werkschoenen', 'bodywarmers'],
    veelgesteld: [
      {
        q: 'Mag laskleding gewoon mee in de bedrijfswas?',
        a: 'Dat mag, maar niet met wasverzachter en niet op een willekeurig programma. Wasverzachter legt een laagje op de vezel dat de vlamvertragende werking aantast. Wij leveren het wasvoorschrift mee en zetten het er desgewenst op een kaartje bij, zodat het ook klopt als iemand anders de was doet.',
      },
      {
        q: 'Wat is het verschil tussen klasse 1 en klasse 2 bij EN ISO 11611?',
        a: 'Klasse 2 is getest op meer spatten en meer stralingswarmte. Las je met MIG of MAG, boven je hoofd of in een besloten ruimte, dan is klasse 2 het uitgangspunt. Voor licht punt- en TIG-werk is klasse 1 doorgaans voldoende.',
      },
      {
        q: 'Kunnen jullie in de hal zelf komen passen?',
        a: 'Graag zelfs. We komen met de paskoffer naar je toe, meestal aan het begin of het eind van een dienst, zodat de productie niet stilligt. Iedereen past zijn eigen maat en we leggen die vast voor de nabestellingen.',
      },
    ],
  },
  {
    slug: 'transport-en-logistiek',
    naam: 'Transport en logistiek',
    titel: 'Werkkleding voor transport en logistiek in de Achterhoek',
    eyebrow: 'Transport en logistiek',
    metaDescription:
      'Werkkleding voor transportbedrijven, chauffeurs en magazijnpersoneel in de Achterhoek en de Liemers. Hi-vis jassen, bodywarmers en vriescelkleding. Passen op het terrein, logo in eigen huis.',
    intro:
      'De hele dag in en uit de cabine: warme cabine, koud laadperron, regen op de laadklep. Op het terrein rijden heftrucks en trekkers, en de chauffeur die jou niet ziet, zie jij ook niet. Staat er een koelcel of een vrieshuis in het spel, dan komt daar nog een compleet ander klimaat bij.',
    waaromAnders: [
      {
        title: 'Op een druk terrein moet je opvallen, ook in het donker',
        text: 'Chauffeurs kijken vanuit een hoge cabine met dode hoeken. Een donkere jas zonder reflectie maakt je op een schemerig laadperron simpelweg onzichtbaar, en de meeste distributiecentra laten je zonder hi-vis niet eens het terrein op.',
      },
      {
        title: 'In en uit de cabine sloopt één dikke jas',
        text: 'In een gevoerde parka zit je binnen een kwartier te zweten achter het stuur, en buiten sta je daarna klam in de wind. Je hebt een tussenlaag nodig die je bij elke stop aan en uit kunt doen.',
      },
      {
        title: 'Vriescelwerk vraagt echte koudebescherming',
        text: 'Bij min achttien graden is een gewone winterjas na twintig minuten niet genoeg. Kleding die op koude is getest houdt je handen en concentratie op peil, en dat scheelt fouten bij het orderpicken.',
      },
    ],
    meestBesteld: [
      'Hi-vis jas of parka in klasse 3 voor het laadperron',
      'Hi-vis bodywarmer over de eigen trui, de klassieker in het magazijn',
      'Werkbroek met signaalbanen voor terreinwerk',
      'Poloshirt en sweater met logo voor de chauffeurs',
      'Vriescelkleding voor koel- en vrieshuizen',
      'Werkschoen S3 met antislipzool voor natte laadvloeren',
    ],
    normen: [
      { slug: 'en-iso-20471', code: 'EN ISO 20471', naam: 'Hoge zichtbaarheid', waarom: 'Standaard op laad- en losterreinen en in magazijnen waar heftrucks rijden.' },
      { slug: 'en-342', code: 'EN 342', naam: 'Bescherming tegen kou', waarom: 'Voor koelcel en vrieshuis, waar een gewone winterjas tekortschiet.' },
      { slug: 'en-343', code: 'EN 343', naam: 'Bescherming tegen regen', waarom: 'Laden en lossen gaat door bij elk weer; het perron staat zelden droog.' },
      { slug: 'en-iso-20345', code: 'EN ISO 20345', naam: 'Veiligheidsschoenen', waarom: 'Tegen een rolcontainer over je voet en tegen wegglijden op een natte laadvloer.' },
    ],
    productCategorieSlugs: ['jassen', 'bodywarmers', 'broeken', 't-shirts-en-polos', 'werkschoenen', 'truien-en-vesten'],
    veelgesteld: [
      {
        q: 'Is een hi-vis hesje over de eigen jas voldoende?',
        a: 'Voor kort terreinbezoek meestal wel, voor mensen die er de hele dienst lopen niet. Een hesje verschuift, gaat kapot en komt zelden verder dan klasse 2. Een hi-vis bodywarmer of jack zit beter en gaat vier keer zo lang mee.',
      },
      {
        q: 'Hoe houd ik de kleding van rijdend personeel op orde?',
        a: 'Door het simpel te houden: een vaste set per chauffeur, in maten die we voor je vastleggen. Nabestellen gaat dan met één bericht, ook als iemand op vrijdagmiddag zijn jas scheurt. Wie in de buurt rijdt kan het bij ons in Hengelo Gld ophalen.',
      },
      {
        q: 'Kan het logo op hi-vis kleding zonder dat de norm vervalt?',
        a: 'Ja, mits het op de goede plek gebeurt en de fluorescerende en reflecterende oppervlakken intact blijven. Er zijn minimumoppervlakken vastgelegd per klasse. Wij houden ons aan de plaatsingsregels van de fabrikant en laten je vooraf zien waar het logo komt.',
      },
    ],
  },
  {
    slug: 'agrarisch-en-loonwerk',
    naam: 'Agrarisch en loonwerk',
    titel: 'Werkkleding voor agrarisch werk en loonwerk in de Achterhoek',
    eyebrow: 'Agrarisch en loonwerk',
    metaDescription:
      'Werkkleding voor boeren, loonwerkers en agrarische bedrijven in de Achterhoek en de Liemers. Overalls, hi-vis voor de openbare weg, regenkleding en stallaarzen. We komen langs op het erf om te passen.',
    intro:
      'Melken, voeren, hakselen, mest uitrijden, en in het seizoen dagen van veertien uur. De kleding gaat mee van de stal naar de trekker naar de openbare weg en weer terug. Alles wat je aanraakt is nat, vuil of allebei, en het weer beslist mee.',
    waaromAnders: [
      {
        title: 'Stal en cabine vragen tegengestelde dingen',
        text: 'Kleding die tegen mest en water kan is vaak te warm voor een cabine met airco, en andersom sta je in de stal te kleumen. Zonder een goede combinatie loop je de halve dag verkeerd gekleed en trek je in de bocht toch weer die ene jas aan.',
      },
      {
        title: 'Losse kleding bij draaiende delen gaat één keer mis',
        text: 'Een flapperende mouw of een koordje bij een aftakas of een vijzel gaat jarenlang goed, tot het niet meer goed gaat. Kleding die aansluit en sluitingen die dichtblijven zijn hier geen detail.',
      },
      {
        title: 'Gewasbescherming hoort niet in je gewone overall',
        text: 'Spuiten in dezelfde overall waarin je daarna de stal in loopt, brengt residu mee naar plekken waar het niet hoort. Voor dat werk hoort aparte kleding, die ook apart in de was gaat.',
      },
    ],
    meestBesteld: [
      'Overall of amerikaan voor stal en werkplaats',
      'Werkbroek met stretch voor lange dagen in de cabine',
      'Hi-vis jas voor transport over de openbare weg',
      'Bodywarmer en fleecevest voor het winterseizoen',
      'Waterdichte regenkleding die ook in de stal bruikbaar is',
      'Werkschoen S3 voor de werkplaats en een laars S5 voor de stal',
    ],
    normen: [
      { slug: 'en-iso-20471', code: 'EN ISO 20471', naam: 'Hoge zichtbaarheid', waarom: 'Voor werk langs en op de openbare weg, en bij manoeuvreren met grote machines op het erf.' },
      { slug: 'en-13034', code: 'EN 13034', naam: 'Beperkte bescherming tegen vloeibare chemicaliën', waarom: 'Bij gewasbescherming, ontsmetten en het werken met reinigingsmiddelen.' },
      { slug: 'en-343', code: 'EN 343', naam: 'Bescherming tegen regen', waarom: 'In het seizoen wordt er niet gewacht op mooi weer.' },
      { slug: 'en-iso-20345', code: 'EN ISO 20345', naam: 'Veiligheidsschoenen', waarom: 'Een koe op je voet of een vallend onderdeel in de werkplaats: allebei reden voor een stalen of composiet neus.' },
    ],
    productCategorieSlugs: ['overalls', 'broeken', 'jassen', 'bodywarmers', 'werkschoenen', 't-shirts-en-polos'],
    veelgesteld: [
      {
        q: 'Wat werkt beter op het erf, een overall of een broek met jack?',
        a: 'Een overall dekt beter af bij vuil werk en is zo aan; een broek met jack is prettiger als je de hele dag in en uit de cabine gaat. Veel bedrijven hier gebruiken allebei: de overall voor stal- en onderhoudswerk, de losse delen voor rijden en klantcontact.',
      },
      {
        q: 'Hoe was ik werkkleding die uit de stal komt?',
        a: 'Apart van de rest en op een programma dat de stof aankan, doorgaans zestig graden. Kleding met een beschermende functie mag geen wasverzachter hebben. Wij kiezen bewust artikelen die die temperatuur verdragen, anders is de kleding na een half jaar op.',
      },
      {
        q: 'Komen jullie ook naar het erf toe?',
        a: 'Ja, en dat is meestal het handigst. We komen met de paskoffer langs op een moment dat het uitkomt, bijvoorbeeld tussen het melken door. Zo hoef je er geen ochtend voor vrij te maken.',
      },
    ],
  },
  {
    slug: 'horeca-en-food',
    naam: 'Horeca en food',
    titel: 'Werkkleding voor horeca en food in de Achterhoek',
    eyebrow: 'Horeca en food',
    metaDescription:
      'Werkkleding voor restaurants, keukens en foodbedrijven in de Achterhoek en de Liemers. Koksbuizen, schorten, bedieningskleding en antislip schoenen. Persoonlijk advies en passen op locatie.',
    intro:
      'In de keuken is het dertig graden en hangt er vet in de lucht; twee meter verderop staat je collega bij een gast aan tafel. Er wordt geschonken, gemorst, gesleept en geschrobd, en om vijf uur moet alles er weer fris uitzien. De vloeren zijn de hele dienst nat en glad.',
    waaromAnders: [
      {
        title: 'In de bediening kijkt een gast recht op je shirt',
        text: 'Kleding die vlekken vasthoudt of na tien wasbeurten gaat pillen kost je uitstraling, ook als de keuken en het gastvrijheidsverhaal verder kloppen. Het is het eerste wat een gast van je zaak ziet.',
      },
      {
        title: 'Keukenkleding gaat heet in de was, elke dag',
        text: 'Koksbuizen draaien op zestig of negentig graden. Stof die daar niet op gemaakt is krimpt, verkleurt en is binnen één seizoen op. Dan koop je twee keer, en dat is duurder dan het in één keer goed doen.',
      },
      {
        title: 'Een gladde keukenvloer vergeeft geen gewone sneaker',
        text: 'Vet en water samen maken een vloer spiegelglad. Antislip is hier geen extraatje maar het verschil tussen doorwerken en zes weken uit de roulatie.',
      },
    ],
    meestBesteld: [
      'Koksbuis met korte of lange mouw, in wit of zwart',
      'Koksbroek met stretch voor lange diensten',
      'Schorten: sloof, bistroschort of halterschort',
      'Overhemd, blouse of poloshirt voor de bediening',
      'Antislip werkschoen of klomp voor de keuken',
      'Muts, bandana of pet met logo',
    ],
    normen: [
      { slug: 'en-iso-20345', code: 'EN ISO 20345', naam: 'Veiligheidsschoenen', waarom: 'In de keuken vooral om de antislipzool en de bescherming tegen een vallend mes of een hete pan.' },
      { slug: 'en-342', code: 'EN 342', naam: 'Bescherming tegen kou', waarom: 'Voor wie in een foodbedrijf in koel- of vriesruimtes werkt.' },
    ],
    productCategorieSlugs: ['blouses-en-overhemden', 't-shirts-en-polos', 'broeken', 'accessoires', 'werkschoenen'],
    veelgesteld: [
      {
        q: 'Wat is beter in de keuken: wit of zwart?',
        a: 'Wit oogt klassiek en straalt hygiëne uit, maar laat elke vlek zien. Zwart verbergt meer en past bij een informelere zaak, alleen zie je vetvlekken er juist glimmen. Werk je met een open keuken, dan kijken we ook naar wat er bij de inrichting past.',
      },
      {
        q: 'Kan ik keukenkleding en bedieningskleding op elkaar laten aansluiten?',
        a: 'Ja, en dat werkt vaak mooi. Eén kleur die terugkomt in het schort van de keuken en het overhemd van de bediening maakt het meteen één zaak. Het logo komt op dezelfde plek, in dezelfde uitvoering.',
      },
      {
        q: 'Wij hebben veel wisselend personeel. Hoe regel je dat?',
        a: 'Met een basisset in de gangbare maten die je op voorraad houdt, en het logo op een plek die voor iedereen werkt. Zo staat een nieuwe kracht op dag één netjes in de zaak en hoef je niet per persoon te bestellen.',
      },
    ],
  },
  {
    slug: 'zorg-en-welzijn',
    naam: 'Zorg en welzijn',
    titel: 'Werkkleding voor zorg en welzijn in de Achterhoek',
    eyebrow: 'Zorg en welzijn',
    metaDescription:
      "Werkkleding voor zorginstellingen, thuiszorg en welzijnsorganisaties in de Achterhoek en de Liemers. Zorgpolo's, tunieken en schoenen die een dienst volhouden. Persoonlijk advies en passen op locatie.",
    intro:
      'Je tilt, bukt, loopt kilometers over een gang en zit tussendoor naast iemand op de rand van het bed. De kleding wordt de hele dienst gerekt en getrokken en gaat daarna heet in de was. Ondertussen wil je herkenbaar zijn voor cliënt en familie, zonder dat het klinisch aanvoelt.',
    waaromAnders: [
      {
        title: 'Heet wassen sloopt goedkope stof',
        text: 'Zorgkleding gaat vaak op zestig graden of hoger de machine in, soms dagelijks. Stof die daar niet op gemaakt is verliest kleur en vorm, en dan oogt een heel team binnen een half jaar sleets terwijl de kleding nog geen jaar oud is.',
      },
      {
        title: 'Te strak zit in de weg bij een transfer',
        text: 'Bij tillen en verplaatsen strek en buk je volledig. Een shirt dat bij elke beweging omhoogkruipt is de hele dienst een ergernis en staat bovendien niet netjes richting de cliënt. Stretch in de goede richting lost dat op.',
      },
      {
        title: 'Zonder herkenbaarheid weet niemand wie wie is',
        text: 'Als iedereen iets anders draagt, ziet een cliënt of familielid het verschil niet tussen verzorging, facilitair en bezoek. Eén kleurlijn met een geborduurd logo maakt dat meteen duidelijk, zonder dat het als uniform voelt.',
      },
    ],
    meestBesteld: [
      "Zorgpolo's en T-shirts met stretch, in de kleur van de organisatie",
      'Tuniek of zorgjasje met korte mouw',
      'Broek met comfortabele band voor lange diensten',
      'Vest of hoodie voor koude gangen en nachtdiensten',
      'Werkschoen met antislipzool die een dienst van acht uur volhoudt',
    ],
    normen: [
      { slug: 'en-iso-20345', code: 'EN ISO 20345', naam: 'Veiligheidsschoenen', waarom: 'Vooral in de keuken, de facilitaire dienst en de technische dienst van een zorglocatie. Op de afdeling telt de antislipzool het zwaarst.' },
    ],
    productCategorieSlugs: ['t-shirts-en-polos', 'truien-en-vesten', 'broeken', 'blouses-en-overhemden', 'werkschoenen'],
    veelgesteld: [
      {
        q: 'Kan zorgkleding op zestig of negentig graden?',
        a: 'Bij de artikelen die wij hiervoor kiezen wel, maar dat moet je vooraf nagaan. Wij noemen per artikel de maximale wastemperatuur en zeggen het eerlijk als een mooi shirt die was niet overleeft. Zo koop je niet twee keer.',
      },
      {
        q: 'Kunnen medewerkers zelf hun maat kiezen zonder gedoe?',
        a: 'Het makkelijkst is één keer samen passen. We komen bij je langs om te passen, iedereen past zijn eigen maat en die leggen we vast. Daarna is bijbestellen voor een nieuwe collega een kwestie van doorgeven.',
      },
      {
        q: 'Hoe voorkomen we dat het als een streng uniform voelt?',
        a: 'Door één kleur en één logo vast te leggen en daarbinnen keuze te laten in model: polo of tuniek, korte of lange mouw, met of zonder vest. Het team ziet er dan als één geheel uit terwijl iedereen draagt waarin hij prettig werkt.',
      },
    ],
  },
  {
    slug: 'kantoor-en-receptie',
    naam: 'Kantoor en receptie',
    titel: 'Bedrijfskleding voor kantoor en receptie in de Achterhoek',
    eyebrow: 'Kantoor en receptie',
    metaDescription:
      "Representatieve bedrijfskleding voor kantoor, balie en receptie in de Achterhoek en de Liemers. Overhemden, blouses, poloshirts en vesten met geborduurd logo. Advies over kleur en pasvorm, passen op kantoor.",
    intro:
      'Jij bent het eerste gezicht dat een klant ziet en de stem aan de telefoon. Achter de balie zit je uren aan een stuk, en tussendoor loop je even de werkplaats of de loods in waar het stoffig en koud is. Wat je aanhebt moet er om vier uur nog net zo uitzien als om acht uur.',
    waaromAnders: [
      {
        title: 'Zittend werk kreukt op de verkeerde plekken',
        text: 'Een overhemd van dun katoen ziet er aan het eind van de middag uit alsof je erin geslapen hebt, precies in de rug en de mouwen die een bezoeker ziet. Een weefsel met wat stretch en kreukherstel houdt de hele dag stand.',
      },
      {
        title: 'Zonder afspraak koopt iedereen iets anders',
        text: 'Dan staat er een team in tien tinten blauw, en dat merkt een klant direct. Eén vastgelegde lijn met een geborduurd logo maakt van losse mensen meteen één bedrijf, zonder dat het stijf wordt.',
      },
      {
        title: 'Kantoor en werkplaats lopen in elkaar over',
        text: 'De balie grenst aan de hal of de loods, en daar staat de deur open. Kleding die alleen binnen werkt laat je in de kou staan; een bijpassend vest of een bodywarmer hoort daarom bij de lijn.',
      },
    ],
    meestBesteld: [
      'Overhemd en blouse in de bedrijfskleur, met stretch',
      'Poloshirts met geborduurd logo voor de wat informelere dagen',
      'Vest of gilet voor achter de balie',
      'Bodywarmer voor het lopen naar de loods',
      'Sjaal, das of stropdas als accent in de huisstijl',
    ],
    normen: [],
    productCategorieSlugs: ['blouses-en-overhemden', 'truien-en-vesten', 't-shirts-en-polos', 'bodywarmers', 'accessoires'],
    veelgesteld: [
      {
        q: 'Moeten we voor kantoor een vaste kledinglijn hebben?',
        a: 'Het hoeft niet, maar het scheelt discussie en het staat een stuk rustiger. Vaak is één overhemd of blouse plus een vest genoeg; de rest houdt iedereen vrij. Zo blijft het herkenbaar zonder dat het een uniform wordt.',
      },
      {
        q: 'Kan het logo klein en subtiel?',
        a: 'Zeker. Op representatieve kleding borduren we het logo meestal klein op de borst of op de manchet, in één of twee kleuren. We maken eerst een proef, zodat je op de stof ziet hoe het uitpakt voordat de hele serie erdoor gaat.',
      },
      {
        q: 'Krijgen we dezelfde kleur als we over een jaar bijbestellen?',
        a: 'Dat is precies waarom we je artikelen en kleurcodes vastleggen. Wordt een artikel toch uit de collectie gehaald, dan zoeken we op tijd een opvolger die ernaast kan hangen en laten we je het verschil zien voordat je beslist.',
      },
    ],
  },
];

export const vakgebiedenBySlug: Record<string, Vakgebied> = Object.fromEntries(
  vakgebieden.map((v) => [v.slug, v]),
);
