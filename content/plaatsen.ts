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
    populair: ['bouw-en-infra', 'horeca-en-hospitality', 'agri-en-milieu'],
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
      'Doetinchem trekt de bedrijvigheid van een halve regio aan. Verheulsweide is met zo’n 165 hectare het grootste bedrijventerrein van de Achterhoek, met een bonte mix van productiehallen, autodemontage, perifere detailhandel en kantoren. Op Wijnbergen, ingeklemd tussen de A18 en de Oude IJssel, zitten ruim tweehonderd bedrijven, van kleine specialisten tot internationale namen. En aan de rand bij de afslag Wehl ligt het A18 Bedrijvenpark, waar ook zwaardere industrie mag. Op al die terreinen lopen mensen rond die hun team herkenbaar en veilig willen kleden zonder zelf een webshop uit te pluizen.',
      'Voor werk langs de weg of op de bouw leveren we hi-vis in de juiste klasse en S3-schoenen. Voor de buitendienst en het klantcontact een verzorgde, representatieve lijn. En voor de horeca in de binnenstad en rond de Simonsplein koksbuizen, schorten en bediening die de hele dienst netjes blijven. We komen langs, passen en stellen samen een pakket samen dat per functie klopt.',
      'We bedienen ook de kernen rondom, zoals Gaanderen, Wehl en Langerak. Het logo brengen we in eigen huis aan, en je kledinglijn leggen we vast zodat nabestellen voor een nieuwe kracht een belletje is. Doetinchem ligt op een kwartier van onze showroom, dus we zijn snel bij je om te passen of een set af te leveren.',
    ],
    gebieden: ['Wijnbergen', 'Verheulsweide', 'A18 Bedrijvenpark', 'Gaanderen', 'Wehl', 'Langerak'],
    populair: ['bouw-en-infra', 'industrie-en-transport', 'horeca-en-hospitality'],
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
      'Naast Zutphen zelf bedienen we de omliggende kernen zoals Warnsveld en Eefde. Van industrie en bouw tot zorg en horeca: we kleden uiteenlopende bedrijven en houden je lijn consistent. Zutphen ligt op een klein half uur, dus persoonlijk langskomen blijft gewoon mogelijk.',
    ],
    gebieden: ['Industrieterrein De Mars', 'Binnenstad', 'Warnsveld', 'Eefde', 'Revelhorst'],
    populair: ['industrie-en-transport', 'bouw-en-infra', 'horeca-en-hospitality'],
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
      'Zelhem heeft een nuchtere, agrarische inslag met daarnaast bouw en techniek op het bedrijventerrein Wittebrink. De korte afstand tot onze showroom betekent korte lijnen: een nabestelling of een nieuwe medewerker regelen we zonder dat je hoeft te wachten op een anonieme webshop.',
      'Voor de boeren en loonbedrijven rond Zelhem leveren we weerbestendige, stevige kleding die tegen modder en machines kan, met de juiste schoenen of laarzen erbij. Voor bouw en techniek de bekende werkbroeken, jassen en hi-vis.',
      'We werken ook in de buurtschappen rondom, zoals Halle en Velswijk. Het bedrukken en borduren doen we in eigen huis, dus snel en met grip op de kwaliteit.',
    ],
    gebieden: ['Bedrijventerrein Wittebrink', 'Centrum', 'Halle', 'Velswijk'],
    populair: ['agri-en-milieu', 'bouw-en-infra', 'industrie-en-transport'],
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
    populair: ['agri-en-milieu', 'horeca-en-hospitality', 'representatief'],
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
    populair: ['industrie-en-transport', 'bouw-en-infra', 'agri-en-milieu'],
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
    gebieden: ['Bedrijventerrein Overberkel', 'Centrum', 'Geesteren', 'Gelselaar'],
    populair: ['industrie-en-transport', 'bouw-en-infra', 'agri-en-milieu'],
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
    gebieden: ['Historisch centrum', 'Bedrijventerrein Beinum', 'Angerlo', 'De Liemers'],
    populair: ['horeca-en-hospitality', 'bouw-en-infra', 'representatief'],
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
      'Lichtenvoorde heeft een actieve ondernemersgemeenschap en een opvallend brede maakindustrie voor zijn omvang. Aan de oostkant ligt het regionale bedrijventerrein De Kamp, met ruim vijftig bedrijven die van productie tot opslag van alles doen. We kiezen kleding die lang meegaat en comfortabel blijft over een hele werkdag, met de veiligheidsnormen die bij het werk horen.',
      'Het logo brengen we slijtvast aan en we leggen de kledinglijn per bedrijf vast. Een nieuwe medewerker of nabestelling is daarna binnen een paar dagen geregeld, zonder gedoe. Voor bouw en techniek leveren we werkbroeken, jassen en hi-vis, voor de agrarische bedrijven eromheen weerbestendige overalls en laarzen.',
      'Lichtenvoorde staat ook bekend om zijn bloemencorso en een bruisend verenigingsleven. Naast bedrijfskleding verzorgen we daarom sport- en promotiekleding voor clubs, teams en evenementen. We werken in heel Lichtenvoorde en de kernen eromheen, zoals Vragender, Lievelde en Harreveld.',
    ],
    gebieden: ['Bedrijventerrein De Kamp', 'Centrum', 'Vragender', 'Lievelde', 'Harreveld'],
    populair: ['bouw-en-infra', 'agri-en-milieu', 'sport-en-promotie'],
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
      'Groenlo is een vestingstad met een sterke industrie en een levendig verenigingsleven. Ten noorden van de stad, langs de N18, ligt het regionale bedrijvenpark Laarberg, opgezet voor grotere en zwaardere industrie die in een gewone kern niet past. Er zit onder meer een bio-based transitiepark waar bedrijven met reststromen en duurzame productie werken. Die maakindustrie en logistiek vraagt om functionele, slijtvaste kleding.',
      'Naast bedrijfskleding verzorgen we ook sport- en promotiekleding voor de vele clubs en evenementen, bedrukt of geborduurd met logo of sponsor. Denk aan de Zwarte Cross in de buurt en het bruisende verenigingsleven in en rond de vesting. Voor bedrijven stellen we een vaste lijn samen en passen we op locatie.',
      'Het bedrukken doen we zelf, dus je ziet vooraf het resultaat en we schakelen snel. We werken in heel Groenlo en de kernen eromheen, zoals Beltrum en Zwolle (Gld). Voor de brouwerij- en horecabedrijven in de vesting leveren we daarnaast verzorgde bedienings- en keukenkleding.',
    ],
    gebieden: ['Bedrijvenpark Laarberg', 'Centrum en vesting', 'Beltrum', 'Zwolle (Gld)'],
    populair: ['industrie-en-transport', 'sport-en-promotie', 'horeca-en-hospitality'],
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
      'Aalten heeft een rijke textielhistorie. Op bedrijventerrein ’t Broek staat onder meer een weverij voor technisch textiel, tent- en vlaggendoek, en eromheen zit een dichte concentratie familiebedrijven in de bouw, techniek en agrarische sector. Die waarderen een leverancier die meedenkt en ze kent, niet een anonieme webshop. Daar zijn we op gebouwd.',
      'We leveren stevige, veilige werkkleding en schoenen in de juiste normklasse, brengen het logo in eigen huis aan en leggen de maten vast voor een snelle nalevering. Passen doen we bij je op de zaak. Voor de maakbedrijven op ’t Broek slijtvaste broeken en jassen, voor de akkerbouwers en loonbedrijven eromheen weerbestendige kleding en laarzen.',
      'We bedienen heel Aalten en de kernen rondom, zoals Bredevoort, Dinxperlo en IJzerlo. Dinxperlo ligt tegen de Duitse grens, waar veel bedrijven aan beide kanten werken. Van een akkerbouwer tot een installatiebedrijf, we stemmen de kleding af op het werk.',
    ],
    gebieden: ["Bedrijventerrein 't Broek", 'Centrum', 'Bredevoort', 'Dinxperlo', 'IJzerlo'],
    populair: ['bouw-en-infra', 'agri-en-milieu', 'industrie-en-transport'],
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
      'Winterswijk ligt in de oosthoek van de Achterhoek, tegen de Duitse grens, en heeft een eigen, sterke economie met industrie, bouw, zorg en toerisme. De maakindustrie zit vooral op de oudere terreinen rond de Misterweg aan de westkant, terwijl het centrum bruist van horeca en winkels. Het Streekziekenhuis Koningin Beatrix is een grote werkgever in de zorg. Voor al die sectoren leveren we passende kleding.',
      'Van werkbroek en hi-vis tot tuniek, koksbuis en een verzorgde horeca-outfit: we kiezen merken en modellen die bij het werk passen en gaan voor kwaliteit die lang meegaat. Voor de zorg en de salons in Winterswijk leveren we comfortabele, makkelijk wasbare tunieken en jassen. Winterswijk is ook een toeristische trekpleister, dus de horeca en de winkels willen er verzorgd uitzien.',
      'Ondanks de afstand houden we het persoonlijk: we komen langs om te passen en zorgen dat nabestellingen snel je kant op komen. We werken ook in de kernen rondom, zoals Meddo, Kotten, Henxel en Miste.',
    ],
    gebieden: ['Bedrijventerrein Misterweg', 'Centrum', 'Meddo', 'Kotten', 'Henxel'],
    populair: ['industrie-en-transport', 'zorg-en-beauty', 'horeca-en-hospitality'],
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
    gebieden: ['Centrum', 'Bronkhorst', 'Baak', 'Buitengebied'],
    populair: ['agri-en-milieu', 'bouw-en-infra', 'industrie-en-transport'],
    faq: [
      { q: 'Komen jullie naar Steenderen toe?', a: 'Ja, Steenderen ligt dichtbij onze showroom. We komen langs om te passen en leveren kleding op maat.' },
      { q: 'Hebben jullie kleding voor agrarisch werk?', a: 'Zeker. Overalls, tuinbroeken en weerbestendige jassen die tegen het werk op het land kunnen, plus stevige laarzen en schoenen.' },
    ],
    afstand: 'Ongeveer 10 minuten vanaf Hengelo',
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
    populair: ['bouw-en-infra', 'agri-en-milieu', 'horeca-en-hospitality'],
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
    populair: ['industrie-en-transport', 'bouw-en-infra', 'representatief'],
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
    populair: ['industrie-en-transport', 'agri-en-milieu', 'bouw-en-infra'],
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
    populair: ['industrie-en-transport', 'bouw-en-infra', 'agri-en-milieu'],
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
      'Varsseveld ligt aan het begin van de A18 en heeft daardoor een snelle verbinding met de rest van het land en het Duitse achterland. Op bedrijventerrein Hofskamp Oost, met inmiddels meer dan honderd bedrijven, zit een opvallend sterke cluster innovatieve maakindustrie. Smart industry groeit hier hard. Die bedrijven vragen om functionele, slijtvaste kleding en hi-vis in de juiste klasse.',
      'Passen doen we bij je op de zaak, het logo brengen we in eigen huis aan en je kledinglijn leggen we vast. Voor de machinebouw en metaal de stevige broeken en jassen, voor de logistiek en het terreinwerk de juiste zichtbaarheidskleding. Een nieuwe medewerker is daarna binnen een paar werkdagen aangekleed.',
      'We werken ook in de kernen eromheen, zoals Westendorp en Heelweg. Naast de industrie kennen we hier ook bouw- en agrarische bedrijven, en voor elk daarvan stellen we een lijn samen die bij het werk past.',
    ],
    gebieden: ['Bedrijventerrein Hofskamp Oost', 'Centrum', 'Westendorp', 'Heelweg'],
    populair: ['industrie-en-transport', 'bouw-en-infra', 'agri-en-milieu'],
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
    populair: ['bouw-en-infra', 'industrie-en-transport', 'representatief'],
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
    populair: ['industrie-en-transport', 'bouw-en-infra', 'representatief'],
    faq: [
      { q: 'Werken jullie voor de industrie in Ulft?', a: 'Ja. Voor de maakindustrie en techniek leveren we functionele, slijtvaste werkkleding en de juiste veiligheidsschoenen.' },
      { q: 'Komen jullie helemaal naar Ulft?', a: 'Ja, we komen langs om te passen en houden de lijnen kort, ook in de zuidelijke Achterhoek.' },
    ],
    afstand: 'Ongeveer 30 minuten vanaf Hengelo',
  },
];

export const plaatsenBySlug = Object.fromEntries(plaatsen.map((p) => [p.slug, p]));
