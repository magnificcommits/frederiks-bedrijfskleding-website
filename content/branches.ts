/**
 * Branchepagina's: de SEO- en leadmotor. Rijke, menselijke content per sector.
 * Geen em-dashes, geen clichéwoorden (zie project-standards/core/ANTI_AI_WRITING.md).
 * Beeld verwijst naar /public. Pas `image`, `fit` en `gallery` vrij aan.
 */
export type Branche = {
  slug: string;
  name: string;
  navLabel: string;
  metaTitle: string;
  metaDescription: string;
  image: string;
  fit?: 'cover' | 'contain';
  /** Korte, menselijke openingszin onder de titel. */
  heroIntro: string;
  /** Bodytekst in alinea's. Concreet, eerste persoon, afwisselende zinslengte. */
  body: string[];
  /** Wat we voor deze sector verzorgen, met uitleg. */
  levering: { title: string; text: string }[];
  /** Typische kledingstukken. */
  items: string[];
  /** Normen/keurmerken waar relevant. Leeg laten waar niet van toepassing. */
  normen?: string[];
  /** Klantcitaat dat bij deze sector past. */
  voorbeeld?: { quote: string; author: string };
  brands: string[];
  /** Extra foto's voor de pagina. */
  gallery?: string[];
  faq: { q: string; a: string }[];
};

export const branches: Branche[] = [
  {
    slug: 'bouw-en-infra',
    name: 'Werkkleding voor bouw en infra',
    navLabel: 'Bouw & infra',
    metaTitle: 'Werkkleding bouw & infra in de Achterhoek',
    metaDescription:
      'Stevige werkkleding voor bouw en infra in de Achterhoek. Werkbroeken, hi-vis, veiligheidsschoenen en jassen. Met logo bedrukt of geborduurd, passen op locatie.',
    image: '/Bedrijfskleding-Achterhoek.jpg',
    heroIntro:
      'Kleding die een werkdag op de bouw aankan. Stevig, veilig en zo gekozen dat je ploeg er goed in zit.',
    body: [
      'Op de bouw merk je binnen een week of kleding deugt. Een naad die loslaat bij het bukken, een kniezak die scheurt, een broek die te warm is in de zomer. Wij kennen die problemen en kiezen daarom merken die er al jaren staan, zoals Snickers, Mascot en Tricorp.',
      'We kijken eerst naar het werk. Timmerwerk vraagt iets anders dan grondwerk of werk langs de weg. Bij werk in de buurt van verkeer leveren we hi-vis die voldoet aan de norm, in de juiste klasse. Geen gedoe met keuringen achteraf.',
      'Grote maten zijn bij ons geen probleem. Past een model niet, dan bestellen we een pasmaat. En als er midden in een project een nieuwe kracht bij komt, regelen we de kleding zo dat hij niet in zijn eigen spullen hoeft te beginnen.',
    ],
    levering: [
      { title: 'Werkbroeken die meegaan', text: 'Kniezakken met inschuifbare kussens, stevig dubbeldoek op de slijtplekken en een snit waarin je de hele dag kunt werken.' },
      { title: 'Hi-vis volgens de norm', text: 'Voor werk langs de weg leveren we kleding in klasse 2 of 3 volgens EN ISO 20471. We zeggen je vooraf welke klasse je nodig hebt.' },
      { title: 'Veiligheidsschoenen die passen', text: 'S3 voor buiten en nat werk, met doorstapbescherming. Passen doe je bij ons, want een halve maat verkeerd voel je na acht uur.' },
      { title: 'Logo dat blijft zitten', text: 'Bedrukt of geborduurd in eigen huis, zo aangebracht dat het de wasmachine en het werk overleeft.' },
    ],
    items: ['Werkbroeken', 'Werkjassen en softshells', 'Hi-vis kleding', 'T-shirts en polo’s', 'Veiligheidsschoenen', 'Bodywarmers'],
    normen: ['EN ISO 20471 (hi-vis)', 'EN ISO 20345 (veiligheidsschoenen, S1 tot S3)'],
    voorbeeld: { quote: 'Jessi heeft ons zeer goed geholpen met de aanschaf van onze werkkleding. Ook keuze in grote maten. De bedrukking van de logo’s is slijtvast en de kleding van prima kwaliteit.', author: 'Overbeek Bouw' },
    brands: ['Snickers Workwear', 'Mascot', 'Tricorp', 'U-Power', 'FHB'],
    gallery: ['/veiligheidsschoenen-achterhoek-1.jpg', '/Bedrijfskleding-bedrukken-en-borduren.jpg'],
    faq: [
      { q: 'Voldoet de hi-vis kleding aan de RWS-eisen?', a: 'Ja. Voor werk langs de weg leveren we kleding die voldoet aan EN ISO 20471 en de geldende RWS-eisen. We bepalen samen welke klasse bij jouw werk hoort.' },
      { q: 'Kunnen jullie grote maten leveren?', a: 'Zeker. We hebben een ruim maatbereik en bestellen indien nodig een pasmaat, zodat iedereen op de ploeg goed zit.' },
      { q: 'Hoe snel kan een nieuwe medewerker zijn kleding hebben?', a: 'Als je lijn bij ons vastligt, regelen we een nieuwe set meestal binnen een paar werkdagen, inclusief logo.' },
    ],
  },
  {
    slug: 'industrie-en-transport',
    name: 'Werkkleding voor industrie en transport',
    navLabel: 'Industrie & transport',
    metaTitle: 'Werkkleding industrie & transport Achterhoek',
    metaDescription:
      'Functionele werkkleding voor industrie en transport. Comfortabel voor lange diensten, hi-vis voor laad- en losplekken, met logo bedrukt of geborduurd.',
    image: '/Bedrijfskleding-achterhoek-borduren.jpg',
    heroIntro:
      'Lange diensten vragen om kleding die comfortabel blijft en niet na een half jaar versleten is.',
    body: [
      'In de logistiek en productie draait het om uren maken. Kleding die schuurt of te warm is, kost je dan elke dag iets. Wij kiezen modellen die de hele dienst zitten, met stof die tegen wassen kan en kleuren die herkenbaar blijven.',
      'Bij laden en lossen of werk op het terrein is zichtbaarheid belangrijk. We leveren hi-vis waar dat nodig is en gewone werkkleding waar dat genoeg is. Je betaalt niet voor functies die je niet gebruikt.',
      'Veel transportbedrijven werken met een vaste lijn over meerdere chauffeurs. Die leggen we vast, zodat een nieuwe chauffeur dezelfde set krijgt en je niet elke keer opnieuw hoeft te kiezen.',
    ],
    levering: [
      { title: 'Slijtvaste werkbroeken en jassen', text: 'Modellen die tegen dagelijks gebruik kunnen, met genoeg zakken voor scanner, telefoon en handschoenen.' },
      { title: 'Hi-vis waar het moet', text: 'Voor het laad- en losterrein leveren we zichtbaarheidskleding in de juiste klasse, zonder dat het de rest van het team onnodig opzadelt.' },
      { title: 'Comfortabel bij wisselend weer', text: 'Van ademende zomershirts tot gevoerde winterjassen, zodat de kleding klopt, ook als het vriest of juist warm is in de loods.' },
      { title: 'Een vaste lijn per functie', text: 'We leggen vast wat een chauffeur, magazijnmedewerker of monteur draagt. Nabestellen is daarna een belletje.' },
    ],
    items: ['Werkbroeken', 'Softshell- en winterjassen', 'Hi-vis kleding', 'Polo’s en sweaters', 'Veiligheidsschoenen'],
    normen: ['EN ISO 20471 (hi-vis)', 'EN ISO 20345 (veiligheidsschoenen)'],
    voorbeeld: { quote: 'Wij zijn altijd super tevreden met de service. Jessi is snel en vakkundig in het uitzoeken en leveren van onze bedrijfskleding, en prettig in contact.', author: 'Getra Transport' },
    brands: ['Tricorp', 'Mascot', 'Snickers Workwear', 'U-Power'],
    gallery: ['/Bedrijfskleding-bedrukken-en-borduren.jpg'],
    faq: [
      { q: 'Kunnen jullie snel nabestellen voor een nieuwe chauffeur?', a: 'Ja. Je lijn ligt bij ons vast, dus we leveren dezelfde set inclusief logo meestal binnen een paar dagen.' },
      { q: 'Leveren jullie ook gevoerde winterkleding?', a: 'Zeker, van bodywarmers tot gevoerde softshells en winterjassen, geschikt voor werk in en rond de loods.' },
    ],
  },
  {
    slug: 'horeca-en-hospitality',
    name: 'Bedrijfskleding voor horeca en hospitality',
    navLabel: 'Horeca & hospitality',
    metaTitle: 'Bedrijfskleding horeca & hospitality Achterhoek',
    metaDescription:
      'Horecakleding die de hele dienst goed zit en blijft: koksbuizen, schorten, overhemden en polo’s. Met logo geborduurd voor een verzorgde uitstraling.',
    image: '/Kleding-horeca-Achterhoek.jpg',
    fit: 'contain',
    heroIntro:
      'In de horeca is je team het eerste wat een gast ziet. De kleding mag dat laten zien.',
    body: [
      'Een goede koksbuis ademt, een schort zit niet in de weg en een overhemd ziet er aan het eind van de avond nog net zo netjes uit als aan het begin. Daar kiezen we op. Merken als Chaud Devant en De Berkel maken kleding die voor de keuken en de bediening is bedacht, niet voor achter een bureau.',
      'We kijken naar de sfeer van je zaak. Een grandcafé vraagt iets anders dan een sterrenrestaurant of een lunchroom. Samen kiezen we kleur, model en stof die daarbij horen.',
      'Voor het logo adviseren we vaak borduren. Dat oogt verzorgd en gaat goed door de vaak hete was van horecatextiel.',
    ],
    levering: [
      { title: 'Koksbuizen en koksbroeken', text: 'Ademende stoffen, modellen voor heren en dames, en kleuren die verder gaan dan standaard wit.' },
      { title: 'Schorten in veel stijlen', text: 'Van klassiek lang tot kort sloofschort of leren look, passend bij de uitstraling van je zaak.' },
      { title: 'Bediening die klopt', text: 'Overhemden, blouses en polo’s die de dienst doorstaan en netjes blijven.' },
      { title: 'Logo dat de was overleeft', text: 'Meestal geborduurd, zodat het ook na tientallen wasbeurten strak blijft.' },
    ],
    items: ['Koksbuizen', 'Schorten', 'Overhemden en blouses', 'Polo’s', 'Antislip werkschoenen'],
    voorbeeld: { quote: 'Wij hebben werkjassen besteld en zijn hier heel tevreden over. Warm, goede kwaliteit, goede service en mooie logo’s. Echt een aanrader.', author: 'Café-zaal De Jongens' },
    brands: ['Chaud Devant', 'Tricorp', 'De Berkel'],
    gallery: ['/Horeca-en-hospitality-achterhoek.jpg'],
    faq: [
      { q: 'Borduren of bedrukken voor horeca?', a: 'Voor horeca adviseren we meestal borduren. Het oogt verzorgd en gaat goed door de hete was. Per kledingstuk bekijken we wat het mooiste resultaat geeft.' },
      { q: 'Hebben jullie ook antislip werkschoenen voor de keuken?', a: 'Ja, we leveren keukenschoenen met antislipzool en goede demping voor lange diensten.' },
    ],
  },
  {
    slug: 'zorg-en-beauty',
    name: 'Bedrijfskleding voor zorg en beauty',
    navLabel: 'Zorg & beauty',
    metaTitle: 'Bedrijfskleding zorg & beauty Achterhoek',
    metaDescription:
      'Verzorgde, comfortabele kleding voor zorg, salons en beauty. Tunieken, polo’s en jassen die de hele dag goed zitten en makkelijk wassen, met jouw logo.',
    image: '/Schoonheidsspecialist-kkapper-leding-Achterhoek-1.jpg',
    fit: 'contain',
    heroIntro:
      'Kleding die de hele dag fris blijft en vertrouwen wekt bij wie tegenover je zit.',
    body: [
      'In de zorg en in salons werk je dicht op de huid van een ander. Dan helpt het als je kleding er verzorgd uitziet en makkelijk schoon te houden is. We kiezen stoffen die vaak en heet gewassen mogen worden en die toch hun vorm houden.',
      'Comfort telt zwaar. Een tuniek of jas die knelt bij het bukken of strekken werkt de hele dag tegen je. We passen daarom op de persoon, niet op een standaardmaat.',
      'Voor salons en beauty kijken we ook naar uitstraling. Een rustige kleur met een subtiel geborduurd logo doet vaak meer dan een opvallende print.',
    ],
    levering: [
      { title: 'Tunieken en zorgjassen', text: 'Comfortabele modellen die bewegen met je mee en heet gewassen kunnen worden.' },
      { title: 'Salon- en beautykleding', text: 'Verzorgde modellen in rustige kleuren, passend bij de sfeer van je salon.' },
      { title: 'Subtiel geborduurd logo', text: 'Klein en netjes, zodat het verzorgd oogt en lang mooi blijft.' },
    ],
    items: ['Tunieken', 'Polo’s', 'Zorgjassen', 'Schorten'],
    voorbeeld: { quote: 'Vanaf het eerste moment merkte ik dat er geluisterd werd naar wat ik nodig had. Binnen een paar dagen een duidelijke offerte en een week later lag alles klaar.', author: 'Elektrotechniek Achterhoek' },
    brands: ['De Berkel', 'Chaud Devant', 'Tricorp'],
    faq: [
      { q: 'Kan de kleding op hoge temperatuur gewassen worden?', a: 'Ja, we kiezen bewust stoffen die vaak en heet gewassen kunnen worden en toch hun vorm houden.' },
    ],
  },
  {
    slug: 'agri-en-milieu',
    name: 'Werkkleding voor agri en groen',
    navLabel: 'Agri & milieu',
    metaTitle: 'Werkkleding agri & milieu Achterhoek',
    metaDescription:
      'Robuuste werkkleding voor de agrarische en groene sector: overalls, tuinbroeken, gevoerde jassen en bodywarmers. Tegen weer en vuil, met jouw logo.',
    image: '/Bedrijfskleding-Achterhoek.jpg',
    heroIntro:
      'Buiten werken vraagt om kleding die tegen weer, modder en lange dagen kan.',
    body: [
      'In de agrarische en groene sector is je kleding elke dag in de weer met regen, stof en aarde. Dan moet stof stevig zijn en moet een jas droog houden zonder dat je erin staat te zweten. We kiezen modellen die daarvoor gemaakt zijn.',
      'Het werk wisselt met het seizoen. Daarom denken we in lagen: een licht shirt voor de zomer, een bodywarmer voor het tussenseizoen en een gevoerde jas voor de winter. Zo klopt de kleding het hele jaar.',
      'Stevige werkschoenen of laarzen horen erbij. We helpen je kiezen wat past bij het terrein waarop je werkt.',
    ],
    levering: [
      { title: 'Overalls en tuinbroeken', text: 'Stevige modellen die tegen modder en machines kunnen, met genoeg ruimte om in te werken.' },
      { title: 'Weerbestendige jassen', text: 'Jassen die droog houden en ademen, met gevoerde varianten voor de winter.' },
      { title: 'Schoenen en laarzen', text: 'Van veiligheidsschoenen tot laarzen, afgestemd op nat en zwaar terrein.' },
    ],
    items: ['Overalls', 'Tuinbroeken', 'Winterjassen', 'Bodywarmers', 'Veiligheidsschoenen en laarzen'],
    voorbeeld: { quote: 'We kopen al jaren onze bedrijfskleding bij Jessi. Ruime collectie, en als het er niet is bestelt ze een pasmaat. Ze denkt mee en kijkt naar de mogelijkheden.', author: 'All Waves' },
    brands: ['Tricorp', 'Mascot', 'FHB'],
    faq: [
      { q: 'Hebben jullie kleding die echt droog houdt bij regen?', a: 'Ja, we leveren waterdichte en ademende jassen, zodat je droog blijft zonder dat je erin staat te zweten.' },
    ],
  },
  {
    slug: 'representatief',
    name: 'Representatieve bedrijfskleding',
    navLabel: 'Representatief',
    metaTitle: 'Representatieve bedrijfskleding Achterhoek',
    metaDescription:
      'Verzorgde, zakelijke bedrijfskleding voor functies met klantcontact: polo’s, overhemden, softshells en bodywarmers. Strak afgewerkt met jouw logo.',
    image: '/werkkleding-kantoor-achterhoek.jpg',
    fit: 'contain',
    heroIntro:
      'Voor wie de klant als eerste ziet. Verzorgde kleding die je merk uitstraalt.',
    body: [
      'Een adviseur, monteur aan de deur of accountmanager is het gezicht van je bedrijf. De eerste indruk zit deels in de kleding. We stellen een lijn samen die zakelijk oogt en toch praktisch is om in te werken.',
      'Denk aan een nette polo onder een softshell met daarop je logo, of een overhemd dat past bij de huisstijl. We houden de set consistent, zodat je hele team dezelfde uitstraling heeft.',
      'Kleur en logo-positie kiezen we samen, afgestemd op je huisstijl. Vaak is een subtiel logo sterker dan een grote print.',
    ],
    levering: [
      { title: 'Polo’s en overhemden', text: 'Modellen die netjes blijven en passen bij je huisstijl, voor heren en dames.' },
      { title: 'Softshells en bodywarmers', text: 'Een laag eroverheen die zakelijk oogt en toch warm en praktisch is.' },
      { title: 'Consistente uitstraling', text: 'We houden kleur, model en logo gelijk over het hele team, zodat het er als een geheel uitziet.' },
    ],
    items: ['Polo’s', 'Overhemden', 'Softshells', 'Bodywarmers', 'Truien en vesten'],
    voorbeeld: { quote: 'Sinds enige tijd gebruiken wij de werkkleding van Frederiks. Onze ervaring is heel goed en aan te bevelen. Topservice en kwaliteit.', author: 'BZV Zonwering' },
    brands: ['Tricorp', 'Snickers Workwear'],
    gallery: ['/Representatie-werkkleding-achterhoek-leverancier.jpg'],
    faq: [
      { q: 'Kunnen jullie de kleding op onze huisstijl afstemmen?', a: 'Ja. We kiezen kleur, model en logo-positie zo dat het past bij je huisstijl en consistent is over het hele team.' },
    ],
  },
  {
    slug: 'sport-en-promotie',
    name: 'Sport- en promotiekleding',
    navLabel: 'Sport & promotie',
    metaTitle: 'Sport- en promotiekleding Achterhoek',
    metaDescription:
      'Sport- en promotiekleding voor clubs, teams en evenementen. Teamshirts, hoodies en caps met opdruk of borduring, in kleine en grote oplagen.',
    image: '/Promotionele-sportkleding-Achterhoek.jpg',
    heroIntro:
      'Voor clubs, teams en sponsoren. Herkenbare kleding waarmee je opvalt.',
    body: [
      'Een team dat er als een team uitziet, dat straalt iets uit. Voor clubs, sponsoracties en evenementen leveren we shirts, hoodies en accessoires met jouw logo of dat van de sponsor.',
      'Kleine oplage of groot, we regelen het allebei. Voor een sponsorbord op een shirt kijken we naar een druktechniek die lang meegaat, ook na het wassen.',
      'Heb je meerdere sponsoren of namen op de rug nodig, dan denken we mee over de opzet zodat het overzichtelijk blijft.',
    ],
    levering: [
      { title: 'Team- en clubshirts', text: 'Sportieve modellen met logo of sponsor, in de kleuren van je club.' },
      { title: 'Hoodies en sweaters', text: 'Voor naast het veld, met opdruk of borduring.' },
      { title: 'Kleine en grote oplagen', text: 'Van een enkel team tot een hele vereniging, met een druktechniek die past bij de oplage.' },
    ],
    items: ['T-shirts', 'Hoodies en sweaters', 'Trainingsjassen', 'Caps en accessoires'],
    brands: ['Tricorp'],
    faq: [
      { q: 'Kunnen jullie ook namen en nummers op de rug zetten?', a: 'Ja, we verzorgen namen, nummers en sponsoren. Bij meerdere namen denken we mee over een overzichtelijke opzet.' },
    ],
  },
];

export const branchesBySlug = Object.fromEntries(branches.map((b) => [b.slug, b]));
