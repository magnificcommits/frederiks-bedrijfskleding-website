/**
 * Lokale landingspagina's (/regio/[plaats]). Unieke, diepere content per plaats
 * voor lokale SEO en AEO. Geen em-dashes of clichéwoorden. Houd teksten uniek.
 */
export type Plaats = {
  slug: string;
  name: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  body: string[];
  gebieden: string[];
  populair: string[]; // branche-slugs
  faq: { q: string; a: string }[];
  afstand: string;
  /** Hemelsbrede afstand in km vanaf de Brouwersmolen (52.0428, 6.3065). */
  km?: number;
};

export const plaatsen: Plaats[] = [
  {
    slug: 'hengelo-gld',
    name: 'Hengelo (Gld)',
    metaTitle: 'Bedrijfskleding Hengelo (Gld)',
    metaDescription:
      'Bedrijfskleding en werkkleding in Hengelo (Gld). Showroom en bedrukkerij in de Brouwersmolen. Persoonlijk advies, passen op locatie en logo in eigen huis.',
    intro:
      'In Hengelo zijn we thuis. Onze showroom en bedrukkerij zitten in de Brouwersmolen aan de Kruisbergseweg, midden in de Achterhoek.',
    body: [
      'Hengelo Gld is een dorp waar ondernemen en aanpakken in de aard zitten, van bouw en techniek tot de horeca rond de Spalstraat. Wij kennen die bedrijven, en zij kennen ons. Je loopt op afspraak binnen in de molen of we komen bij je langs om te passen.',
      'Omdat we hier zelf zitten, zijn de lijnen kort. Een nieuwe medewerker die snel kleding nodig heeft, een spoedklus die bedrukt moet, of een extra jas die nog gepast wordt: het is allemaal zo geregeld. Het bedrukken en borduren doen we ter plekke, dus je ziet vooraf het resultaat.',
      'We leveren in heel Hengelo en de buurtschappen eromheen, van Keijenborg tot Veldhoek en Varssel. Van werkbroek en hi-vis tot een verzorgde representatieve lijn, afgestemd op het werk en de uitstraling van je bedrijf.',
    ],
    gebieden: ['Centrum en Spalstraat', 'Bedrijventerrein Winkelskamp', 'Keijenborg', 'Veldhoek', 'Varssel'],
    populair: ['bouw-en-infra', 'horeca-en-food', 'agrarisch-en-groen'],
    faq: [
      { q: 'Kan ik langskomen in de showroom in Hengelo?', a: 'Ja, op afspraak. We zitten in de Brouwersmolen aan de Kruisbergseweg 9. Bel of vraag online een afspraak aan, dan zorgen we dat we de tijd voor je hebben.' },
      { q: 'Komen jullie ook bij mijn bedrijf in Hengelo langs?', a: 'Zeker. Passen op locatie is juist onze kracht, en in Hengelo zijn we zo bij je. Zo kost het je geen werktijd.' },
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
      'Doetinchem is de grootste stad van de Achterhoek en een belangrijke thuisbasis voor onze klanten in bouw, techniek, transport en horeca.',
    body: [
      'Doetinchem trekt de bedrijvigheid van een halve regio aan. Verheulsweide is een van de grootste bedrijventerreinen van de Achterhoek, met een bonte mix van productiehallen, autodemontage, perifere detailhandel en kantoren. Op Wijnbergen, tussen de A18 en de Europaweg, zitten circa tweehonderd bedrijven, van kleine specialisten tot internationale namen. En aan de rand bij de afslag Wehl ligt het A18 Bedrijvenpark, waar ook zwaardere industrie mag. Op al die terreinen lopen mensen rond die hun team herkenbaar en veilig willen kleden zonder zelf een webshop uit te pluizen.',
      'Voor werk langs de weg of op de bouw leveren we hi-vis in de juiste klasse en S3-schoenen. Voor de buitendienst en het klantcontact een verzorgde, representatieve lijn. En voor de horeca in de binnenstad en rond de Simonsplein koksbuizen, schorten en bediening die de hele dienst netjes blijven. We komen langs, passen en stellen samen een pakket samen dat per functie klopt.',
      'We bedienen ook de kernen rondom, zoals Gaanderen, Wehl en Langerak. Het logo brengen we in eigen huis aan, en je kledinglijn leggen we vast zodat nabestellen voor een nieuwe kracht een belletje is. Doetinchem ligt op een kwartier van onze showroom, dus we zijn snel bij je om te passen of een set af te leveren.',
    ],
    gebieden: ['Wijnbergen', 'Verheulsweide', 'A18 Bedrijvenpark', 'Gaanderen', 'Wehl', 'Langerak'],
    populair: ['bouw-en-infra', 'industrie-en-logistiek', 'horeca-en-food'],
    faq: [
      { q: 'Leveren jullie ook hi-vis voor wegwerkzaamheden in Doetinchem?', a: 'Ja. Voor werk langs de weg leveren we zichtbaarheidskleding volgens EN ISO 20471 in de juiste klasse. We bepalen samen welke klasse bij je werk hoort.' },
      { q: 'Hoe snel kunnen jullie in Doetinchem leveren?', a: 'Doetinchem ligt op ongeveer een kwartier van onze showroom, dus we zijn snel bij je om te passen. Ligt je kledinglijn vast, dan regelen we nabestellingen meestal binnen een paar werkdagen.' },
      { q: 'Werken jullie ook voor bedrijven op Wijnbergen en Verheulsweide?', a: 'Ja, veel van onze klanten zitten op die terreinen. We komen langs op de zaak om te passen en stellen per functie een lijn samen, van magazijn tot buitendienst.' },
    ],
    afstand: 'Ongeveer 15 minuten vanaf Hengelo',
  },
  {
    slug: 'zutphen',
    name: 'Zutphen',
    metaTitle: 'Bedrijfskleding Zutphen',
    metaDescription:
      'Bedrijfskleding en werkkleding in Zutphen. Maatwerk met persoonlijk advies, en bedrukken of borduren in eigen huis door Frederiks Bedrijfskleding.',
    intro:
      'Voor bedrijven in Zutphen en omgeving leveren we werkkleding met persoonlijke aandacht. Eén aanspreekpunt, advies op maat en snelle nalevering.',
    body: [
      'Zutphen heeft twee gezichten. Op industrieterrein De Mars, tussen de IJssel en het spoor, zit een stevige maakindustrie en logistiek die om robuuste kleding vraagt. En in de oude Hanzestad daarbinnen vind je een binnenstad vol horeca, winkels en zorg, waar het juist om uitstraling draait. Die twee werelden vragen elk om andere kleding: stevig en veilig waar het moet, verzorgd en representatief waar dat telt. Wij stemmen het per bedrijf af.',
      'We komen naar je toe om te passen, ook in grotere maten, en kijken samen welke merken en modellen bij je werk passen. Voor de metaal en machinebouw op De Mars leveren we slijtvaste werkbroeken, jassen en de juiste veiligheidsschoenen. Het logo brengen we slijtvast aan, bedrukt of geborduurd, zodat je team er maanden later nog net zo verzorgd uitziet.',
      'Naast Zutphen zelf bedienen we de omliggende kernen zoals Warnsveld en, net over de gemeentegrens, Eefde. Van industrie en bouw tot zorg en horeca: we kleden uiteenlopende bedrijven en houden je lijn consistent. Zutphen ligt op een klein half uur, dus persoonlijk langskomen blijft gewoon mogelijk.',
    ],
    gebieden: ['Industrieterrein De Mars', 'Binnenstad', 'Warnsveld', 'Eefde', 'Revelhorst'],
    populair: ['industrie-en-logistiek', 'bouw-en-infra', 'horeca-en-food'],
    faq: [
      { q: 'Werken jullie ook voor bedrijven op De Mars?', a: 'Ja, veel van onze klanten in Zutphen zitten op of rond industrieterrein De Mars. We komen langs om te passen en leveren de juiste kleding en veiligheidsschoenen voor het werk.' },
      { q: 'Kunnen jullie zowel industrie- als horecakleding leveren?', a: 'Zeker. We leveren stevige werkkleding voor de industrie en bouw, en verzorgde koksbuizen, schorten en bediening voor de horeca in de binnenstad.' },
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
      'Zelhem heeft een nuchtere, agrarische inslag met daarnaast bouw en techniek op terreinen als De Vinkenkamp, Het Blek en De Hoge Voort. De korte afstand tot onze showroom betekent korte lijnen: een nabestelling of een nieuwe medewerker regelen we zonder dat je hoeft te wachten op een anonieme webshop.',
      'Voor de boeren en loonbedrijven rond Zelhem leveren we weerbestendige, stevige kleding die tegen modder en machines kan, met de juiste schoenen of laarzen erbij. Voor bouw en techniek de bekende werkbroeken, jassen en hi-vis.',
      'We werken ook in de buurtschappen rondom, zoals Halle en Velswijk. Het bedrukken en borduren doen we in eigen huis, dus snel en met grip op de kwaliteit.',
    ],
    gebieden: ['De Vinkenkamp', 'Het Blek', 'De Hoge Voort', 'Centrum', 'Halle', 'Velswijk'],
    populair: ['agrarisch-en-groen', 'bouw-en-infra', 'industrie-en-logistiek'],
    faq: [
      { q: 'Hebben jullie kleding die tegen het werk op het land kan?', a: 'Ja. Voor de agrarische sector leveren we overalls, tuinbroeken en weerbestendige jassen die tegen modder, machines en lange dagen kunnen, plus stevige schoenen of laarzen.' },
      { q: 'Hoe snel zijn jullie in Zelhem?', a: 'Zelhem ligt op ongeveer tien minuten van onze showroom. We zijn dus zo bij je om te passen en te leveren.' },
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
      'Vorden staat bekend om zijn acht kastelen en zijn toeristische trekkracht, maar er zit ook een gezonde mix van bouwbedrijven, hoveniers, horeca en zorg. Voor al die sectoren stellen we een passende kledinglijn samen, afgestemd op het werk en de uitstraling.',
      'Doordat we dichtbij zitten, kennen we de klanten en is meedenken vanzelfsprekend. We komen langs om te passen, kiezen samen merken, kleuren en logo-posities, en leggen alles vast voor een snelle nalevering.',
      'We bedienen ook de buurtschappen rond Vorden, zoals Wichmond en Kranenburg. Van een hovenier met weerbestendige kleding tot een restaurant met geborduurde koksbuizen.',
    ],
    gebieden: ['Centrum', 'Bedrijventerrein Werkveld', 'Wichmond', 'Kranenburg'],
    populair: ['agrarisch-en-groen', 'horeca-en-food', 'kantoor-en-retail'],
    faq: [
      { q: 'Verzorgen jullie ook kleding voor de horeca in Vorden?', a: 'Ja. Voor restaurants en hotels leveren we koksbuizen, schorten en bediening, met je logo geborduurd voor een verzorgde uitstraling.' },
      { q: 'Komen jullie naar Vorden toe om te passen?', a: 'Zeker, Vorden ligt op een kleine tien minuten. We komen graag langs zodat iedereen goed past zonder werktijd te verliezen.' },
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
      'Ruurlo heeft een stevige maakindustrie en veel bouw- en agrarische bedrijven, met bedrijvigheid op De Venterkamp. We kiezen kleding die past bij het werk: slijtvast en veilig waar dat nodig is, comfortabel voor de lange dagen die er gemaakt worden.',
      'Passen doen we bij je op de zaak. Het logo brengen we in eigen huis aan, dus snel en met controle op de kwaliteit. Verbleekte hi-vis of versleten schoenen vervangen we op tijd, zodat je team veilig en verzorgd blijft.',
      'We werken in heel Ruurlo en de omliggende kernen. Of het nu gaat om een loonbedrijf, een aannemer of een zaak met klantcontact, we stellen een lijn samen die klopt.',
    ],
    gebieden: ['Bedrijventerrein De Venterkamp', 'Centrum', 'Buitengebied'],
    populair: ['industrie-en-logistiek', 'bouw-en-infra', 'agrarisch-en-groen'],
    faq: [
      { q: 'Leveren jullie ook veiligheidsschoenen in Ruurlo?', a: 'Ja, we leveren veiligheidsschoenen van S1 tot S3 met persoonlijk pasadvies, afgestemd op het werk en het terrein waarop je werkt.' },
      { q: 'Kunnen jullie een vaste kledinglijn voor ons team opzetten?', a: 'Zeker. We leggen per functie vast wat iemand draagt, inclusief maten en logo-positie, zodat nabestellen voor nieuwe medewerkers snel gaat.' },
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
      'Borculo heeft een sterke industriële en agrarische basis, met bedrijvigheid op de terreinen rond de stad. Die bedrijven vragen om stevige, functionele kleding. We leveren werkbroeken, jassen, hi-vis en veiligheidsschoenen in de juiste normklasse, afgestemd op het werk.',
      'Doordat we de hele lijn vastleggen, blijft je team uniform en gaat nabestellen snel. Eén aanspreekpunt voor advies, bedrukken en levering, zonder dat je met meerdere partijen hoeft te schakelen.',
      'We werken ook in de kernen rondom, zoals Geesteren en Gelselaar. Het logo brengen we in eigen huis aan, dus je ziet vooraf het resultaat en we schakelen snel.',
    ],
    gebieden: ['Bedrijvenpark Borculo', 'Centrum', 'Geesteren', 'Gelselaar'],
    populair: ['industrie-en-logistiek', 'bouw-en-infra', 'agrarisch-en-groen'],
    faq: [
      { q: 'Verzorgen jullie ook de bedrukking in Borculo?', a: 'Ja, we bedrukken en borduren in eigen huis. Je logo brengen we slijtvast aan en je ziet vooraf hoe het eruitkomt.' },
      { q: 'Hebben jullie ook grote maten?', a: 'Zeker. We hebben een ruim maatbereik en bestellen indien nodig een pasmaat, zodat iedereen op het team goed zit.' },
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
      'Doesburg is een Hanzestad op de grens van de Achterhoek en de Liemers, met een historisch centrum vol horeca en winkels en daarbuiten bouw- en technische bedrijven. Voor beide werelden hebben we een passende lijn, van koksbuis en schort tot werkbroek en hi-vis.',
      'We komen langs om te passen en stemmen kleur en logo af op je huisstijl, zodat je merk binnen en buiten hetzelfde overkomt. Het bedrukken en borduren regelen we in eigen huis.',
      'Vanuit Doesburg bedienen we ook de omliggende plaatsen in de Liemers. Eén vast aanspreekpunt dat je bedrijf kent, met snelle nalevering als er iemand bij komt.',
    ],
    gebieden: ['Historisch centrum', 'Bedrijventerrein Beinum', 'Verhuellweg en Koppelweg', 'Angerlo (Zevenaar)'],
    populair: ['horeca-en-food', 'bouw-en-infra', 'kantoor-en-retail'],
    faq: [
      { q: 'Werken jullie ook in de Liemers?', a: 'Ja, vanuit Doesburg bedienen we ook de plaatsen in de Liemers. We komen langs om te passen en leveren kleding op maat.' },
      { q: 'Kunnen jullie kleding op onze huisstijl afstemmen?', a: 'Zeker. We kiezen kleur, model en logo-positie zo dat het past bij je huisstijl en consistent is over het hele team.' },
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
      'Voor de Oost-Achterhoek rond Lichtenvoorde leveren we werkkleding voor bouw, techniek, agri en horeca, inclusief bedrukken in eigen huis.',
    body: [
      'Lichtenvoorde heeft een actieve ondernemersgemeenschap en een opvallend brede maakindustrie voor zijn omvang. Aan de oostkant ligt het bedrijventerrein De Kamp, met De Kamp Zuid en Lindebrook ernaast, waar bedrijven van productie tot opslag zitten. We kiezen kleding die lang meegaat en comfortabel blijft over een hele werkdag, met de veiligheidsnormen die bij het werk horen.',
      'Het logo brengen we slijtvast aan en we leggen de kledinglijn per bedrijf vast. Een nieuwe medewerker of nabestelling is daarna binnen een paar dagen geregeld, zonder gedoe. Voor bouw en techniek leveren we werkbroeken, jassen en hi-vis, voor de agrarische bedrijven eromheen weerbestendige overalls en laarzen.',
      'Lichtenvoorde staat ook bekend om zijn bloemencorso en een bruisend verenigingsleven. Naast bedrijfskleding verzorgen we daarom sport- en promotiekleding voor clubs, teams en evenementen. We werken in heel Lichtenvoorde en de kernen eromheen, zoals Vragender, Lievelde en Harreveld.',
    ],
    gebieden: ['Bedrijventerrein De Kamp', 'Centrum', 'Vragender', 'Lievelde', 'Harreveld'],
    populair: ['bouw-en-infra', 'agrarisch-en-groen', 'clubs-en-verenigingen'],
    faq: [
      { q: 'Leveren jullie ook sport- en promotiekleding in Lichtenvoorde?', a: 'Ja. Naast bedrijfskleding verzorgen we sport- en promotiekleding voor clubs, teams en evenementen, bedrukt of geborduurd met logo of sponsor.' },
      { q: 'Hoe snel leveren jullie na een akkoord?', a: 'Zodra je lijn bij ons vastligt, regelen we nabestellingen meestal binnen een paar werkdagen, inclusief logo.' },
      { q: 'Werken jullie ook voor bedrijven op De Kamp?', a: 'Zeker. Voor de productie- en handelsbedrijven op De Kamp leveren we functionele werkkleding, hi-vis en veiligheidsschoenen, en komen we langs om te passen.' },
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
      'Groenlo is een vestingstad met een sterke industrie en een levendig verenigingsleven. Langs de N18 ligt het regionale bedrijvenpark Laarberg, opgezet voor grotere bedrijven die in een gewone kern niet passen, en in de stad zelf zitten de terreinen Brandemate en Den Sliem. Die maakindustrie en logistiek vraagt om functionele, slijtvaste kleding.',
      'Naast bedrijfskleding verzorgen we ook sport- en promotiekleding voor de vele clubs en evenementen, bedrukt of geborduurd met logo of sponsor. Denk aan de Zwarte Cross in de buurt en het bruisende verenigingsleven in en rond de vesting. Voor bedrijven stellen we een vaste lijn samen en passen we op locatie.',
      'Het bedrukken doen we zelf, dus je ziet vooraf het resultaat en we schakelen snel. We werken in heel Groenlo en de kernen eromheen, zoals Beltrum en Zwolle (Gld). Voor de brouwerij- en horecabedrijven in de vesting leveren we daarnaast verzorgde bedienings- en keukenkleding.',
    ],
    gebieden: ['Bedrijvenpark Laarberg', 'Centrum en vesting', 'Beltrum', 'Zwolle (Gld)'],
    populair: ['industrie-en-logistiek', 'clubs-en-verenigingen', 'horeca-en-food'],
    faq: [
      { q: 'Verzorgen jullie clubkleding voor verenigingen in Groenlo?', a: 'Ja. Voor clubs, teams en evenementen leveren we shirts, hoodies en accessoires met logo of sponsor, in kleine en grote oplagen.' },
      { q: 'Werken jullie ook voor bedrijven op Laarberg?', a: 'Zeker. Voor de maakindustrie en logistiek op en rond Laarberg leveren we functionele werkkleding, hi-vis en veiligheidsschoenen.' },
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
      'Aalten heeft een rijke textielhistorie. Rond de kern en in Bredevoort en Dinxperlo zit een dichte concentratie familiebedrijven in de bouw, techniek en agrarische sector. Die waarderen een leverancier die meedenkt en ze kent, niet een anonieme webshop. Daar zijn we op gebouwd.',
      'We leveren stevige, veilige werkkleding en schoenen in de juiste normklasse, brengen het logo in eigen huis aan en leggen de maten vast voor een snelle nalevering. Passen doen we bij je op de zaak. Voor de maakbedrijven op ’t Broek slijtvaste broeken en jassen, voor de akkerbouwers en loonbedrijven eromheen weerbestendige kleding en laarzen.',
      'We bedienen heel Aalten en de kernen rondom, zoals Bredevoort, Dinxperlo en IJzerlo. Dinxperlo ligt tegen de Duitse grens, waar veel bedrijven aan beide kanten werken. Van een akkerbouwer tot een installatiebedrijf, we stemmen de kleding af op het werk.',
    ],
    gebieden: ['Centrum', 'Bredevoort', 'Dinxperlo', 'IJzerlo'],
    populair: ['bouw-en-infra', 'agrarisch-en-groen', 'industrie-en-logistiek'],
    faq: [
      { q: 'Werken jullie ook voor familiebedrijven in Aalten?', a: 'Juist. Veel van onze klanten in Aalten zijn familiebedrijven die persoonlijk contact waarderen. Je krijgt bij ons één vast aanspreekpunt dat je bedrijf kent.' },
      { q: 'Komen jullie helemaal naar Aalten toe?', a: 'Ja. Ondanks de afstand houden we het persoonlijk: we komen langs om te passen en zorgen dat nabestellingen snel je kant op komen.' },
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
      'Winterswijk ligt in de oosthoek van de Achterhoek, tegen de Duitse grens, en heeft een eigen, sterke economie met industrie, bouw, zorg en toerisme. De maakindustrie zit vooral op de oudere terreinen rond de Misterweg en Vèèneslat, terwijl het centrum bruist van horeca en winkels. Het Streekziekenhuis Koningin Beatrix is een grote werkgever in de zorg. Voor al die sectoren leveren we passende kleding.',
      'Van werkbroek en hi-vis tot tuniek, koksbuis en een verzorgde horeca-outfit: we kiezen merken en modellen die bij het werk passen en gaan voor kwaliteit die lang meegaat. Voor de zorg en de salons in Winterswijk leveren we comfortabele, makkelijk wasbare tunieken en jassen. Winterswijk is ook een toeristische trekpleister, dus de horeca en de winkels willen er verzorgd uitzien.',
      'Ondanks de afstand houden we het persoonlijk: we komen langs om te passen en zorgen dat nabestellingen snel je kant op komen. We werken ook in de kernen rondom, zoals Meddo, Kotten, Henxel en Miste.',
    ],
    gebieden: ['Bedrijventerrein Misterweg', 'Centrum', 'Meddo', 'Kotten', 'Henxel'],
    populair: ['industrie-en-logistiek', 'zorg-en-salon', 'horeca-en-food'],
    faq: [
      { q: 'Leveren jullie ook zorgkleding in Winterswijk?', a: 'Ja. Voor zorg, salons en beauty leveren we comfortabele, makkelijk wasbare tunieken, polo’s en jassen die er verzorgd uitzien.' },
      { q: 'Is Winterswijk niet te ver voor persoonlijk advies?', a: 'Nee. We komen ook naar Winterswijk toe om te passen en houden de lijnen kort, zodat je dezelfde persoonlijke service krijgt als dichterbij.' },
    ],
    afstand: 'Ongeveer 35 minuten vanaf Hengelo',
  },
  {
    slug: 'steenderen',
    name: 'Steenderen',
    metaTitle: 'Bedrijfskleding Steenderen',
    metaDescription:
      'Werkkleding en bedrijfskleding in Steenderen met persoonlijk advies. Maatwerk, passen op locatie en bedrukken in eigen huis.',
    intro: 'Steenderen ligt vlak bij ons in de gemeente Bronckhorst. Voor de agrarische en bouwbedrijven hier zijn we snel ter plaatse.',
    body: [
      'Steenderen heeft een agrarisch karakter met daarnaast bouw en loonwerk. We leveren weerbestendige, stevige kleding die tegen modder en machines kan, met de juiste schoenen of laarzen erbij.',
      'Doordat we dichtbij zitten, zijn de lijnen kort: passen op locatie, het logo in eigen huis, en een snelle nalevering als er iemand bij komt. We werken ook in Bronkhorst en Baak.',
    ],
    gebieden: ['Bedrijventerrein Steenderdiek', 'Centrum', 'Bronkhorst', 'Baak', 'Buitengebied'],
    populair: ['agrarisch-en-groen', 'bouw-en-infra', 'industrie-en-logistiek'],
    faq: [
      { q: 'Komen jullie naar Steenderen toe?', a: 'Ja, Steenderen ligt dichtbij onze showroom. We komen langs om te passen en leveren kleding op maat.' },
      { q: 'Hebben jullie kleding voor agrarisch werk?', a: 'Zeker. Overalls, tuinbroeken en weerbestendige jassen die tegen het werk op het land kunnen, plus stevige laarzen en schoenen.' },
    ],
    afstand: 'Ongeveer 20 minuten vanaf Hengelo',
  },
  {
    slug: 'hummelo',
    name: 'Hummelo',
    metaTitle: 'Bedrijfskleding Hummelo',
    metaDescription:
      'Bedrijfskleding en werkkleding in Hummelo met persoonlijk advies. Passen op locatie en logo bedrukken of borduren.',
    intro: 'Hummelo en Drempt bedienen we met dezelfde persoonlijke aanpak: langskomen, passen en een pakket samenstellen dat klopt.',
    body: [
      'In Hummelo en het naastgelegen Drempt zitten bouw-, hovenier- en horecabedrijven. Voor elk daarvan stellen we een passende lijn samen, van stevige werkkleding tot een verzorgde horeca-outfit.',
      'We komen langs om te passen, brengen het logo in eigen huis aan en leggen je kledinglijn vast voor een snelle nalevering. Ook in Drempt en Hoog-Keppel zijn we actief.',
    ],
    gebieden: ['Centrum', 'Drempt', 'Hoog-Keppel', 'Laag-Keppel'],
    populair: ['bouw-en-infra', 'agrarisch-en-groen', 'horeca-en-food'],
    faq: [
      { q: 'Verzorgen jullie ook horecakleding in Hummelo?', a: 'Ja, voor restaurants en hotels leveren we koksbuizen, schorten en bediening, met je logo geborduurd.' },
      { q: 'Hoe snel zijn jullie ter plaatse?', a: 'Hummelo ligt dichtbij. We zijn snel langs om te passen en kunnen vlot leveren.' },
    ],
    afstand: 'Ongeveer 15 minuten vanaf Hengelo',
  },
  {
    slug: 'lochem',
    name: 'Lochem',
    metaTitle: 'Bedrijfskleding Lochem',
    metaDescription:
      'Werkkleding en bedrijfskleding in Lochem met persoonlijk advies. Maatwerk, bedrukken en borduren door Frederiks Bedrijfskleding.',
    intro: 'Voor bedrijven in Lochem en omgeving leveren we werkkleding met persoonlijke aandacht en snelle nalevering.',
    body: [
      'Lochem heeft een stevige maakindustrie en logistiek op de bedrijventerreinen rond de stad, plus bouw en agrarisch werk in de omgeving. We kiezen functionele, slijtvaste kleding en de juiste veiligheidsschoenen voor het werk.',
      'Passen doen we bij je op de zaak. Het logo brengen we slijtvast aan, bedrukt of geborduurd, en je lijn leggen we vast. We werken ook in Barchem, Gorssel en Almen.',
    ],
    gebieden: ['Bedrijventerrein Aalsvoort', 'Centrum', 'Barchem', 'Gorssel', 'Almen'],
    populair: ['industrie-en-logistiek', 'bouw-en-infra', 'kantoor-en-retail'],
    faq: [
      { q: 'Leveren jullie ook in de kernen rond Lochem?', a: 'Ja, naast Lochem werken we ook in Barchem, Gorssel en Almen. We komen langs om te passen.' },
      { q: 'Kunnen jullie veiligheidsschoenen leveren?', a: 'Zeker, van S1 tot S3 met persoonlijk pasadvies, afgestemd op het werk.' },
    ],
    afstand: 'Ongeveer 25 minuten vanaf Hengelo',
  },
  {
    slug: 'eibergen',
    name: 'Eibergen',
    metaTitle: 'Bedrijfskleding Eibergen',
    metaDescription:
      'Bedrijfskleding en werkkleding in Eibergen. Persoonlijk advies, passen op locatie en eigen bedrukkerij.',
    intro: 'Eibergen in de gemeente Berkelland bedienen we met dezelfde persoonlijke aanpak en korte lijnen.',
    body: [
      'Eibergen heeft een sterke industriële en agrarische basis. Voor die bedrijven leveren we stevige werkkleding, hi-vis waar nodig en veiligheidsschoenen in de juiste klasse.',
      'We komen langs om te passen, brengen het logo in eigen huis aan en zorgen voor een snelle nalevering. Ook in Rekken en Beltrum zijn we actief.',
    ],
    gebieden: ['Bedrijventerrein De Mors', 'Centrum', 'Rekken'],
    populair: ['industrie-en-logistiek', 'agrarisch-en-groen', 'bouw-en-infra'],
    faq: [
      { q: 'Werken jullie ook voor de industrie in Eibergen?', a: 'Ja. Voor de maakindustrie leveren we functionele, slijtvaste werkkleding en de juiste veiligheidsschoenen.' },
      { q: 'Komen jullie naar Eibergen toe?', a: 'Ja, we komen langs om te passen en houden de lijnen kort, ook al ligt het wat verder.' },
    ],
    afstand: 'Ongeveer 25 minuten vanaf Hengelo',
  },
  {
    slug: 'neede',
    name: 'Neede',
    metaTitle: 'Bedrijfskleding Neede',
    metaDescription:
      'Werkkleding en bedrijfskleding in Neede met persoonlijk advies. Maatwerk, bedrukken en borduren in eigen huis.',
    intro: 'Voor bedrijven in Neede en omgeving leveren we werkkleding, veiligheidsschoenen en maatwerk met persoonlijke aandacht.',
    body: [
      'Neede heeft een textielverleden en vandaag een mix van maakindustrie, bouw en agrarisch werk. We kiezen kleding die past bij het werk en lang meegaat.',
      'Het logo brengen we in eigen huis aan en je kledinglijn leggen we vast voor een snelle nalevering. We werken ook in Borculo, Ruurlo en de omliggende kernen.',
    ],
    gebieden: ['Centrum', 'Bedrijventerrein', 'Rietmolen', 'Noordijk'],
    populair: ['industrie-en-logistiek', 'bouw-en-infra', 'agrarisch-en-groen'],
    faq: [
      { q: 'Hebben jullie ook grote maten?', a: 'Zeker, we hebben een ruim maatbereik en bestellen indien nodig een pasmaat.' },
      { q: 'Verzorgen jullie de bedrukking zelf?', a: 'Ja, bedrukken en borduren doen we in eigen huis, dus snel en met grip op de kwaliteit.' },
    ],
    afstand: 'Ongeveer 25 minuten vanaf Hengelo',
  },
  {
    slug: 'varsseveld',
    name: 'Varsseveld',
    metaTitle: 'Bedrijfskleding Varsseveld',
    metaDescription:
      'Bedrijfskleding en werkkleding in Varsseveld met persoonlijk advies. Passen op locatie en logo in eigen huis.',
    intro: 'Varsseveld in de Oude IJsselstreek bedienen we met persoonlijk advies en snelle nalevering.',
    body: [
      'Varsseveld ligt aan het begin van de A18 en heeft daardoor een snelle verbinding met de rest van het land en het Duitse achterland. De Hofskamp, met Hofskamp-Oost samen zo’n honderd hectare, huisvest veel maakindustrie, en met het Varsseveld Industriepark (VIP) komt er ruimte bij die op smart industry is gericht. Die bedrijven vragen om functionele, slijtvaste kleding en hi-vis in de juiste klasse.',
      'Passen doen we bij je op de zaak, het logo brengen we in eigen huis aan en je kledinglijn leggen we vast. Voor de machinebouw en metaal de stevige broeken en jassen, voor de logistiek en het terreinwerk de juiste zichtbaarheidskleding. Een nieuwe medewerker is daarna binnen een paar werkdagen aangekleed.',
      'We werken ook in de kernen eromheen, zoals Westendorp en Heelweg. Naast de industrie kennen we hier ook bouw- en agrarische bedrijven, en voor elk daarvan stellen we een lijn samen die bij het werk past.',
    ],
    gebieden: ['Bedrijventerrein Hofskamp Oost', 'Centrum', 'Westendorp', 'Heelweg'],
    populair: ['industrie-en-logistiek', 'bouw-en-infra', 'agrarisch-en-groen'],
    faq: [
      { q: 'Leveren jullie hi-vis voor werk langs de A18?', a: 'Ja, we leveren zichtbaarheidskleding volgens EN ISO 20471 in de juiste klasse voor werk langs de weg.' },
      { q: 'Komen jullie naar Varsseveld toe?', a: 'Ja, we komen langs om te passen en zorgen voor een snelle levering.' },
      { q: 'Werken jullie ook voor de maakindustrie op Hofskamp Oost?', a: 'Zeker. Voor de machinebouw, metaal en logistiek op Hofskamp Oost leveren we slijtvaste werkkleding, hi-vis en veiligheidsschoenen, en komen we langs om te passen.' },
    ],
    afstand: 'Ongeveer 25 minuten vanaf Hengelo',
  },
  {
    slug: 'terborg',
    name: 'Terborg',
    metaTitle: 'Bedrijfskleding Terborg',
    metaDescription:
      'Werkkleding en bedrijfskleding in Terborg met persoonlijk advies. Maatwerk, bedrukken en borduren door Frederiks Bedrijfskleding.',
    intro: 'Terborg en omgeving in de Oude IJsselstreek bedienen we met dezelfde persoonlijke aanpak.',
    body: [
      'Terborg heeft een historische kern en daarbuiten bouw-, technische en industriële bedrijven. Voor die bedrijven leveren we stevige werkkleding, veiligheidsschoenen en bedrukking.',
      'We komen langs om te passen en leggen je kledinglijn vast voor een snelle nalevering. Ook in Silvolde en Ulft zijn we actief.',
    ],
    gebieden: ['Centrum', 'Silvolde', 'Varsselder'],
    populair: ['bouw-en-infra', 'industrie-en-logistiek', 'kantoor-en-retail'],
    faq: [
      { q: 'Werken jullie ook in Silvolde en Ulft?', a: 'Ja, vanuit Terborg bedienen we de hele Oude IJsselstreek, waaronder Silvolde en Ulft.' },
      { q: 'Kunnen jullie een vaste kledinglijn opzetten?', a: 'Zeker. We leggen per functie vast wat iemand draagt, zodat nabestellen snel gaat.' },
    ],
    afstand: 'Ongeveer 30 minuten vanaf Hengelo',
  },
  {
    slug: 'ulft',
    name: 'Ulft',
    metaTitle: 'Bedrijfskleding Ulft',
    metaDescription:
      'Bedrijfskleding en werkkleding in Ulft met persoonlijk advies. Passen op locatie en eigen bedrukkerij.',
    intro: 'Ulft in de Oude IJsselstreek heeft een sterke industriële traditie. Voor die bedrijven leveren we functionele werkkleding met persoonlijke aandacht.',
    body: [
      'Ulft is meer dan twee eeuwen het hart van de Nederlandse ijzerindustrie geweest. De ijzergieterij DRU (Diepenbrock en Reigers Ulft) leverde kachels, pannen en badkuipen aan klanten over de hele wereld. Het oude fabrieksterrein is nu het DRU Industriepark, met daarin een innovatiecentrum en cultuurfabriek. Die maaktraditie leeft door: aan de rand van Ulft, op de bedrijventerreinen De Rieze, zitten grotere bedrijven in metaal, techniek en productie.',
      'Voor die bedrijven leveren we werkkleding, hi-vis en veiligheidsschoenen in de juiste normklasse, brengen het logo in eigen huis aan en komen langs om te passen. Stevige broeken en jassen voor de werkvloer, de juiste schoenen voor wie de hele dag staat en tilt. Een nieuwe kracht regelen we snel, omdat je lijn bij ons vastligt.',
      'Ook in Gendringen, Etten en Silvolde zijn we actief. De hele Oude IJsselstreek heeft die mix van maakindustrie en familiebedrijven, en wij stemmen de kleding af op wat het werk vraagt.',
    ],
    gebieden: ['Bedrijventerrein De Rieze', 'DRU Industriepark', 'Centrum', 'Gendringen', 'Etten'],
    populair: ['industrie-en-logistiek', 'bouw-en-infra', 'kantoor-en-retail'],
    faq: [
      { q: 'Werken jullie voor de industrie in Ulft?', a: 'Ja. Voor de maakindustrie en techniek leveren we functionele, slijtvaste werkkleding en de juiste veiligheidsschoenen.' },
      { q: 'Komen jullie helemaal naar Ulft?', a: 'Ja, we komen langs om te passen en houden de lijnen kort, ook in de zuidelijke Achterhoek.' },
    ],
    afstand: 'Ongeveer 30 minuten vanaf Hengelo',
  },
  {
    slug: 'keijenborg',
    name: 'Keijenborg',
    metaTitle: 'Bedrijfskleding Keijenborg',
    metaDescription:
      'Bedrijfskleding en werkkleding in Keijenborg, op een paar kilometer van onze showroom in de Brouwersmolen. Passen op locatie en logo in eigen huis.',
    intro:
      'Keijenborg is ons naaste buurdorp in de gemeente Bronckhorst. Vanuit de Brouwersmolen ben je er in een paar minuten.',
    body: [
      'Keijenborg is een kerkdorp met veel familiebedrijven: aannemers, installateurs, loonwerkers en agrarische ondernemers die hun mensen gewoon goed gekleed op het werk willen hebben. Voor die bedrijven is een leverancier om de hoek geen luxe maar gemak. Een maat ruilen of een extra broek ophalen doe je op de terugweg.',
      'Omdat de afstand zo klein is, passen we vaak bij je op de zaak of op de bouwplaats. We nemen pasmodellen mee in de maten die je team draagt, en stellen per functie een lijn samen: stevige werkbroeken met kniezakken, softshells en regenkleding voor buiten, en S3-schoenen waar de werkplek daarom vraagt.',
      'Het logo brengen we zelf aan in onze bedrukkerij in Hengelo. Je ziet vooraf een drukproef, en de vaste kledinglijn leggen we vast in het gratis kledingportaal, zodat nabestellen voor een nieuwe medewerker in een paar klikken geregeld is.',
    ],
    gebieden: ['Kern Keijenborg', 'Buitengebied', 'Hengelo (Gld)', 'Bronckhorst'],
    populair: ['bouw-en-infra', 'agrarisch-en-groen', 'industrie-en-logistiek'],
    faq: [
      { q: 'Hoe snel zijn jullie in Keijenborg?', a: 'Keijenborg ligt hemelsbreed ruim 4 kilometer van onze showroom. We zijn er dus vaak dezelfde week om te passen of af te leveren.' },
      { q: 'Kan ik in Keijenborg ook kleding laten borduren?', a: 'Ja. Borduren en bedrukken doen we in eigen huis in Hengelo. Je krijgt eerst een drukproef ter goedkeuring.' },
    ],
    afstand: 'Ongeveer 5 minuten vanaf Hengelo',
  },
  {
    slug: 'baak',
    name: 'Baak',
    metaTitle: 'Bedrijfskleding Baak',
    metaDescription:
      'Werkkleding en bedrijfskleding in Baak en op bedrijventerrein Dambroek. Persoonlijk advies, passen op locatie en bedrukken in eigen huis.',
    intro:
      'Baak ligt aan de IJssel in de gemeente Bronckhorst, tussen Steenderen en Zutphen. Met bedrijventerrein Dambroek heeft het dorp een eigen werkplek voor het MKB.',
    body: [
      'Op bedrijventerrein Dambroek en in het buitengebied rond Baak werken bouw- en installatiebedrijven, loonwerkers en agrarische ondernemers. Dat is werk waarbij kleding tegen modder, machines en elk weer moet kunnen. We kiezen daarom voor stevige stoffen, versterkte knieën en regenkleding die echt waterdicht blijft.',
      'Wie langs de weg of op de dijk werkt, heeft hi-vis nodig in de juiste klasse volgens EN ISO 20471. We bepalen samen welke klasse bij het werk hoort en welke combinatie van jas, broek en vest je nodig hebt om aan die klasse te voldoen.',
      'We komen langs om te passen, brengen het logo in onze eigen bedrukkerij aan en leggen je lijn vast in het kledingportaal. Zo heeft een nieuwe medewerker binnen een paar werkdagen dezelfde set als de rest van het team.',
    ],
    gebieden: ['Bedrijventerrein Dambroek', 'Kern Baak', 'Wichmond', 'Buitengebied langs de IJssel'],
    populair: ['bouw-en-infra', 'agrarisch-en-groen', 'industrie-en-logistiek'],
    faq: [
      { q: 'Leveren jullie ook op bedrijventerrein Dambroek?', a: 'Ja. We komen op de zaak langs om te passen en leveren de kleding daar ook af.' },
      { q: 'Welke hi-vis klasse heb ik nodig voor werk op de dijk of langs de weg?', a: 'Dat hangt af van de snelheid van het verkeer en de situatie. Voor werk langs de openbare weg is vaak klasse 2 of 3 nodig. We bekijken het samen per functie.' },
    ],
    afstand: 'Ongeveer 10 minuten vanaf Hengelo',
  },
  {
    slug: 'wehl',
    name: 'Wehl',
    metaTitle: 'Bedrijfskleding Wehl',
    metaDescription:
      'Bedrijfskleding en werkkleding in Wehl, bij de A18. Persoonlijk advies, passen op locatie en logo bedrukken of borduren in eigen huis.',
    intro:
      'Wehl hoort sinds 2005 bij de gemeente Doetinchem en ligt direct aan de A18. Voor bedrijven hier zijn we vanuit Hengelo snel ter plaatse.',
    body: [
      'Door de ligging aan de A18 trekt Wehl bedrijven aan die snel de snelweg op moeten: transport, installatietechniek, bouw en groothandel. Op en rond het A18 Bedrijvenpark tussen Wehl en Doetinchem zit ook zwaardere bedrijvigheid. Dat vraagt om kleding die veilig is en lang meegaat, zonder dat je er elk kwartaal opnieuw over hoeft na te denken.',
      'Voor het magazijn en de werkplaats leveren we slijtvaste werkkleding en S3-schoenen. Voor chauffeurs een nette, herkenbare lijn die bij klanten aan de deur ook goed oogt. En voor wie langs de weg werkt hi-vis in de juiste klasse. We passen op locatie, zodat niemand een middag kwijt is aan een showroom.',
      'Het logo zetten we in eigen huis op de kleding. Je vaste set staat daarna in het kledingportaal, met per medewerker de maten en het budget, zodat nabestellen geen zoekwerk meer is.',
    ],
    gebieden: ['A18 Bedrijvenpark', 'Kern Wehl', 'Nieuw-Wehl', 'Doetinchem'],
    populair: ['industrie-en-logistiek', 'bouw-en-infra', 'kantoor-en-retail'],
    faq: [
      { q: 'Komen jullie ook naar het A18 Bedrijvenpark?', a: 'Ja. We komen bij je op de zaak om te passen en stellen per functie een lijn samen, van magazijn tot buitendienst.' },
      { q: 'Kunnen chauffeurs ook een nette lijn krijgen?', a: 'Zeker. Polo’s, softshells en jassen in je huisstijl, met je logo, die bij klanten aan de deur verzorgd ogen en toch praktisch zijn.' },
    ],
    afstand: 'Ongeveer 15 minuten vanaf Hengelo',
  },
  {
    slug: 'gaanderen',
    name: 'Gaanderen',
    metaTitle: 'Bedrijfskleding Gaanderen',
    metaDescription:
      'Werkkleding en bedrijfskleding in Gaanderen aan de Oude IJssel. Advies, passen op locatie en bedrukken of borduren in eigen huis.',
    intro:
      'Gaanderen ligt aan de Oude IJssel tussen Doetinchem en Terborg en hoort bij de gemeente Doetinchem. Een kern met een eigen, hardwerkende bedrijvigheid.',
    body: [
      'De Oude IJssel heeft deze streek ooit groot gemaakt met ijzergieterijen en metaalbewerking, en die maakcultuur zie je nog steeds terug in de techniek-, installatie- en bouwbedrijven rond Gaanderen. Werk waarbij goede werkkleding geen bijzaak is, maar bescherming en comfort over een hele dag.',
      'We stellen per functie een set samen: werkbroeken en jassen die tegen een stootje kunnen, vlamvertragende of lasbestendige kleding waar nodig, en veiligheidsschoenen in de klasse die bij de werkplek hoort. Twijfel je over normen, dan leggen we je uit wat EN ISO 20345 of EN ISO 11611 in de praktijk betekent.',
      'Passen doen we bij je op de zaak. Het logo brengen we in onze eigen bedrukkerij aan, en met het kledingportaal houd je overzicht over wie wat heeft en wanneer er vervangen moet worden.',
    ],
    gebieden: ['Kern Gaanderen', 'Langs de Oude IJssel', 'Terborg', 'Doetinchem'],
    populair: ['industrie-en-logistiek', 'bouw-en-infra', 'agrarisch-en-groen'],
    faq: [
      { q: 'Leveren jullie ook lasbestendige kleding?', a: 'Ja. Voor laswerk leveren we kleding volgens EN ISO 11611, en voor werk met vonken of hitte ook EN ISO 11612. We kijken samen welke klasse je nodig hebt.' },
      { q: 'Hoe ver is Gaanderen van jullie showroom?', a: 'Hemelsbreed ongeveer 12 kilometer. We komen dus makkelijk langs om te passen of af te leveren.' },
    ],
    afstand: 'Ongeveer 20 minuten vanaf Hengelo',
  },
  {
    slug: 'warnsveld',
    name: 'Warnsveld',
    metaTitle: 'Bedrijfskleding Warnsveld',
    metaDescription:
      'Bedrijfskleding en werkkleding in Warnsveld. Persoonlijk advies, passen op locatie en logo in eigen huis door Frederiks Bedrijfskleding.',
    intro:
      'Warnsveld hoort sinds 2005 bij de gemeente Zutphen en ligt aan de Achterhoekse kant van de stad, richting Vorden en Hengelo.',
    body: [
      'Warnsveld is groen en woonachtig, met daartussen veel zelfstandigen en kleinere bedrijven: hoveniers, installateurs, schilders, zorgaanbieders en dienstverleners. Op het kleine bedrijventerrein De Lage Weide en vanuit huis werken ondernemers die vaak met een klein team zitten, en juist dan is een vast aanspreekpunt prettig.',
      'Voor kleine teams denken we in praktische pakketten: een paar goede werkbroeken, een softshell en een regenjas, met je logo erop. Voor zorg en dienstverlening een verzorgde, comfortabele lijn die goed te wassen is. Je hoeft geen grote aantallen af te nemen om bij ons goed geholpen te worden.',
      'Warnsveld ligt op de route tussen Zutphen en Vorden, dus we combineren een pasafspraak vaak met andere klanten in de buurt. Het logo brengen we in eigen huis aan en je set leggen we vast, zodat nabestellen een kwestie van een paar klikken is.',
    ],
    gebieden: ['Bedrijventerrein De Lage Weide', 'Kern Warnsveld', 'Leesten', 'Zutphen'],
    populair: ['bouw-en-infra', 'zorg-en-salon', 'kantoor-en-retail'],
    faq: [
      { q: 'Kan ik als zzp’er of klein bedrijf ook bij jullie terecht?', a: 'Ja. We helpen ook kleine teams en zelfstandigen. Je krijgt hetzelfde persoonlijke advies en hetzelfde bedrukwerk als een groot bedrijf.' },
      { q: 'Komen jullie in Warnsveld langs om te passen?', a: 'Ja. Warnsveld ligt hemelsbreed zo’n 11 kilometer van onze showroom. We komen bij je langs of je komt op afspraak naar de Brouwersmolen.' },
    ],
    afstand: 'Ongeveer 15 minuten vanaf Hengelo',
  },
  {
    slug: 'brummen',
    name: 'Brummen',
    metaTitle: 'Bedrijfskleding Brummen',
    metaDescription:
      'Werkkleding en bedrijfskleding in Brummen en Eerbeek. Persoonlijk advies, passen op locatie en bedrukken of borduren in eigen huis.',
    intro:
      'Brummen ligt aan de IJssel tussen Zutphen en Dieren. Samen met Eerbeek vormt het een gemeente met opvallend veel industrie voor zijn omvang.',
    body: [
      'Op bedrijventerrein Hazenberg, ruim 13 hectare met ontsluiting over spoor en water, zitten productie- en logistieke bedrijven, en in Eerbeek is de papier- en kartonindustrie al generaties een grote werkgever. Dat zijn werkplekken met machines, heftrucks en wisselende diensten, waar kleding veilig en comfortabel moet zijn.',
      'Voor productie en logistiek leveren we slijtvaste werkkleding met reflectie, hi-vis waar intern verkeer rijdt en S3-schoenen met een goede demping voor wie de hele dag staat. Voor ploegendiensten stellen we een set samen die genoeg wisselkleding geeft, zodat er altijd een schone set klaar ligt.',
      'We passen bij je op locatie, ook in kleine groepjes per ploeg, en brengen het logo in onze eigen bedrukkerij aan. In het kledingportaal zie je per medewerker wat er is uitgegeven en wanneer vervanging nodig is.',
    ],
    gebieden: ['Bedrijventerrein Hazenberg', 'Eerbeek-Zuid', 'Kern Brummen', 'Leuvenheim'],
    populair: ['industrie-en-logistiek', 'bouw-en-infra', 'agrarisch-en-groen'],
    faq: [
      { q: 'Leveren jullie ook voor ploegendiensten?', a: 'Ja. We rekenen samen uit hoeveel sets per medewerker nodig zijn met de wasfrequentie, zodat er altijd een schone set klaarligt.' },
      { q: 'Werken jullie ook in Eerbeek?', a: 'Ja. Eerbeek ligt binnen ons werkgebied. We komen langs om te passen en leveren op de zaak af.' },
    ],
    afstand: 'Ongeveer 20 minuten vanaf Hengelo',
  },
  {
    slug: 'laren-gld',
    name: 'Laren (Gld)',
    metaTitle: 'Bedrijfskleding Laren (Gld)',
    metaDescription:
      'Bedrijfskleding en werkkleding in Laren (Gld). Persoonlijk advies, passen op locatie en logo bedrukken of borduren in eigen huis.',
    intro:
      'Laren ligt in de gemeente Lochem, aan de weg naar Holten. Een dorp met een sterk agrarisch buitengebied en een eigen kring van bouw- en technische bedrijven.',
    body: [
      'Rond de Holterweg en in het buitengebied werken aannemers, installateurs, loonwerkers en agrarische bedrijven. Het gaat om buitenwerk in alle seizoenen, dus kleding die warm en droog houdt zonder dat je erin vastzit. Daarbij horen schoenen of laarzen die passen bij het werk op het erf of de bouw.',
      'We kiezen materialen die tegen een stootje kunnen en makkelijk te wassen zijn, en we letten op details die op een lange dag het verschil maken: kniezakken, ventilatie en genoeg bewegingsvrijheid. Werk je langs de weg, dan leveren we hi-vis in de juiste klasse.',
      'Laren ligt in de buurt van onze klanten in Lochem en Barchem, dus we combineren pasafspraken vaak. Het logo brengen we in eigen huis aan, en met het kledingportaal regel je een nabestelling zonder te bellen of te mailen.',
    ],
    gebieden: ['Bedrijventerrein Holterweg', 'Kern Laren', 'Barchem', 'Lochem'],
    populair: ['agrarisch-en-groen', 'bouw-en-infra', 'industrie-en-logistiek'],
    faq: [
      { q: 'Leveren jullie werkkleding voor agrarische bedrijven in Laren?', a: 'Ja. Overalls, regenkleding, laarzen en werkschoenen die tegen mest en modder kunnen, met je bedrijfsnaam erop als je dat wilt.' },
      { q: 'Komen jullie naar Laren toe?', a: 'Ja. Laren ligt hemelsbreed zo’n 12 kilometer van onze showroom. We komen bij je langs om te passen.' },
    ],
    afstand: 'Ongeveer 20 minuten vanaf Hengelo',
  },
  {
    slug: 'dieren',
    name: 'Dieren',
    metaTitle: 'Bedrijfskleding Dieren',
    metaDescription:
      'Werkkleding en bedrijfskleding in Dieren. Persoonlijk advies, passen op locatie en bedrukken of borduren in eigen huis.',
    intro:
      'Dieren ligt in de gemeente Rheden, aan de IJssel en het Apeldoorns Kanaal. Via de IJsselbrug ben je vanuit de Achterhoek zo aan de overkant.',
    body: [
      'Rond het kanaal ligt bedrijventerrein Dieren Oost met de Kanaalzone, waar productie, bouw, groothandel en logistiek naast elkaar zitten. Daarnaast heeft Dieren veel zorg en dienstverlening voor de dorpen langs de Veluwezoom. Dat geeft een gemengde vraag: van robuuste werkkleding tot een verzorgde lijn voor klantcontact.',
      'We beginnen met de vraag wat elke functie doet. De monteur heeft andere kleding nodig dan de baliemedewerker of de chauffeur, en een goede lijn houdt rekening met dat verschil zonder dat de herkenbaarheid verloren gaat. Kleur, logo en model stemmen we op elkaar af.',
      'Passen doen we bij je op de zaak. Het logo brengen we in onze eigen bedrukkerij aan, en je lijn ligt daarna vast in het kledingportaal, zodat je bij een nieuwe medewerker niet opnieuw hoeft te zoeken.',
    ],
    gebieden: ['Dieren Oost', 'Kanaalzone', 'Centrum', 'Spankeren'],
    populair: ['industrie-en-logistiek', 'bouw-en-infra', 'zorg-en-salon'],
    faq: [
      { q: 'Leveren jullie ook zorgkleding in Dieren?', a: 'Ja. Comfortabele, goed wasbare zorgkleding en een verzorgde lijn voor receptie en dienstverlening, met je logo.' },
      { q: 'Komen jullie over de IJssel naar Dieren?', a: 'Ja. Dieren ligt hemelsbreed zo’n 14 kilometer van onze showroom. We komen langs om te passen en leveren op de zaak af.' },
    ],
    afstand: 'Ongeveer 20 minuten vanaf Hengelo',
  },
  {
    slug: 'didam',
    name: 'Didam',
    metaTitle: 'Bedrijfskleding Didam',
    metaDescription:
      'Bedrijfskleding en werkkleding in Didam. Persoonlijk advies, passen op locatie en logo bedrukken of borduren in eigen huis.',
    intro:
      'Didam ligt in de gemeente Montferland, bij het begin van de A18 richting de Achterhoek. Het dorp heeft een flink eigen bedrijventerrein.',
    body: [
      'Op bedrijventerrein De Fluun en daaromheen zitten bouw-, installatie- en transportbedrijven die door de ligging aan de A18 en A12 snel in de hele regio zijn. Dat zijn teams die veel onderweg zijn en bij klanten over de vloer komen, dus kleding die praktisch is en er tegelijk verzorgd uitziet.',
      'We stellen per functie een lijn samen: werkbroeken en jassen voor de bouw en installatie, hi-vis voor wie op of langs de weg werkt, en polo’s of softshells voor de buitendienst. Met je logo erop is je team overal herkenbaar, van de bouwplaats tot de voordeur van een klant.',
      'We komen bij je langs om te passen, brengen het logo in eigen huis aan en leggen de lijn vast in het kledingportaal. Zo bestel je na zonder telkens maten en modellen opnieuw op te zoeken.',
    ],
    gebieden: ['Bedrijventerrein De Fluun', 'Kern Didam', 'Loil', 'Nieuw-Dijk'],
    populair: ['bouw-en-infra', 'industrie-en-logistiek', 'kantoor-en-retail'],
    faq: [
      { q: 'Werken jullie ook voor bedrijven op De Fluun?', a: 'Ja. We komen bij je op de zaak om te passen en leveren de kleding daar ook af.' },
      { q: 'Is Didam niet te ver weg voor persoonlijk advies?', a: 'Nee. Didam ligt hemelsbreed zo’n 17 kilometer van onze showroom, binnen ons vaste werkgebied. We komen gewoon langs.' },
    ],
    afstand: 'Ongeveer 25 minuten vanaf Hengelo',
  },
];

/** Hemelsbrede afstand (km) vanaf de Brouwersmolen. Bron: kerncentra, haversine. */
export const afstandKm: Record<string, number> = {
  'hengelo-gld': 0,
  'zelhem': 5.4,
  'vorden': 6.5,
  'hummelo': 6.4,
  'doetinchem': 8.7,
  'ruurlo': 10.8,
  'zutphen': 12.8,
  'steenderen': 13.0,
  'lochem': 14.8,
  'terborg': 14.4,
  'varsseveld': 15.5,
  'borculo': 16.5,
  'ulft': 16.8,
  'doesburg': 14.6,
  'lichtenvoorde': 18.7,
  'groenlo': 21.0,
  'aalten': 22.8,
  'neede': 23.2,
  'eibergen': 23.9,
  'winterswijk': 29.3,
  'keijenborg': 4.1,
  'baak': 6.0,
  'wehl': 10.1,
  'gaanderen': 11.9,
  'warnsveld': 10.8,
  'brummen': 11.5,
  'laren-gld': 12.5,
  'dieren': 14.1,
  'didam': 17.0,
};
for (const p of plaatsen) p.km = afstandKm[p.slug];

/** Kernwerkgebied: binnen 24 km van de showroom. */
export const KERNSTRAAL_KM = 24;

export const plaatsenBySlug = Object.fromEntries(plaatsen.map((p) => [p.slug, p]));
