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
  /** false = niet in het hoofdmenu en de branchetegels, wel bereikbaar via footer en /werkkleding. */
  hoofdmenu?: boolean;
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
      'Op de bouw merk je binnen een week of kleding deugt. Een naad die loslaat bij het bukken, een kniezak die scheurt, een broek die te warm is in de zomer. Wij kennen die problemen en kiezen daarom merken die er al jaren staan, zoals Snickers Workwear, FHB en Blåkläder.',
      'We kijken eerst naar het werk. Timmerwerk vraagt iets anders dan grondwerk of werk langs de weg. Een timmerman wil kniezakken en een hamerlus, een grondwerker een broek die tegen modder kan, en wie langs de N18 of de A18 werkt heeft hi-vis nodig die voldoet aan de norm, in de juiste klasse. Geen gedoe met keuringen achteraf.',
      'Grote maten zijn bij ons geen probleem. Past een model niet, dan bestellen we een pasmaat. En als er midden in een project een nieuwe kracht bij komt, regelen we de kleding zo dat hij niet in zijn eigen spullen hoeft te beginnen. Voor de bouwbedrijven in Hengelo, Doetinchem en de rest van de Achterhoek komen we op de zaak passen.',
    ],
    levering: [
      { title: 'Werkbroeken die meegaan', text: 'Kniezakken met inschuifbare kussens, stevig dubbeldoek op de slijtplekken en een snit waarin je de hele dag kunt werken. Holsterzakken voor wie ze gebruikt, een gladde voorkant voor wie niet achter alles blijft haken.' },
      { title: 'Hi-vis volgens de norm', text: 'Voor werk langs de weg leveren we kleding in klasse 2 of 3 volgens EN ISO 20471. We zeggen je vooraf welke klasse je nodig hebt, afhankelijk van de snelheid van het verkeer en of je overdag of in het donker werkt.' },
      { title: 'Veiligheidsschoenen die passen', text: 'S3 voor buiten en nat werk, met doorstapbescherming tegen spijkers en een stalen of composiet neus. Passen doe je bij ons, want een halve maat verkeerd voel je na acht uur op een steiger.' },
      { title: 'Logo dat blijft zitten', text: 'Bedrukt of geborduurd in eigen huis, zo aangebracht dat het de wasmachine en het werk overleeft. Op de borst, de rug of de mouw, in de positie die jij wilt.' },
    ],
    items: ['Werkbroeken', 'Werkjassen en softshells', 'Hi-vis kleding', 'T-shirts en polo’s', 'Veiligheidsschoenen', 'Bodywarmers'],
    normen: ['EN ISO 20471 (hi-vis)', 'EN ISO 20345 (veiligheidsschoenen, S1 tot S3)'],
    voorbeeld: { quote: 'Jessi heeft ons zeer goed geholpen met de aanschaf van onze werkkleding. Ook keuze in grote maten. De bedrukking van de logo’s is slijtvast en de kleding van prima kwaliteit.', author: 'Overbeek Bouw' },
    brands: ['Snickers Workwear', 'FHB', 'Blåkläder', 'Hydrowear', 'Tricorp', 'U-Power', 'Grisport'],
    gallery: ['/veiligheidsschoenen-achterhoek-1.jpg', '/Bedrijfskleding-bedrukken-en-borduren.jpg'],
    faq: [
      { q: 'Voldoet de hi-vis kleding aan de RWS-eisen?', a: 'Ja. Voor werk langs de weg leveren we kleding die voldoet aan EN ISO 20471 en de geldende RWS-eisen. We bepalen samen welke klasse bij jouw werk hoort.' },
      { q: 'Kunnen jullie grote maten leveren?', a: 'Zeker. We hebben een ruim maatbereik en bestellen indien nodig een pasmaat, zodat iedereen op de ploeg goed zit.' },
      { q: 'Hoe snel kan een nieuwe medewerker zijn kleding hebben?', a: 'Als je lijn bij ons vastligt, regelen we een nieuwe set meestal binnen een paar werkdagen, inclusief logo.' },
    ],
  },
  {
    slug: 'installatie-en-techniek',
    name: 'Werkkleding voor installatie en techniek',
    navLabel: 'Installatie & techniek',
    metaTitle: 'Werkkleding installatie en techniek in de Achterhoek',
    metaDescription:
      'Werkkleding voor installateurs, elektromonteurs, servicemonteurs en garages in de Achterhoek. Kniezakken, vlamboog, ESD-schoenen en jouw logo erop.',
    image: '/Frederiks-bedrijfskleding-1.jpg',
    heroIntro:
      'Voor wie de hele dag op de knieën ligt, onder een aanrecht, in een meterkast of bij de klant thuis.',
    body: [
      'Een installateur heeft andere kleding nodig dan een timmerman. Je werkt binnen, vaak bij mensen thuis, en ligt de halve dag op je knieën of op je rug. Een broek met goede kniezakken, een zak voor je meter en je telefoon, en een polo die er om vier uur nog netjes uitziet als je bij de volgende klant aanbelt. Daar kiezen we op, met de Service-lijn van Snickers Workwear als basis.',
      'In de elektrotechniek telt bescherming. Wie aan of bij een installatie onder spanning werkt, heeft kleding nodig die tegen een vlamboog beschermt, in de klasse die bij de installatie hoort. Die leveren we van Fristads en Hydrowear. Voor werk aan elektronica, zonnepanelen en laadpalen zijn ESD-schoenen vaak de verstandige keuze; daar hebben we een ruime lijn van U-Power in.',
      'De installatiebranche in de Achterhoek groeit mee met de warmtepompen, zonnepanelen en laadpalen, en vrijwel elk bedrijf zoekt monteurs. Nette, herkenbare kleding helpt daarbij: bij de klant aan de deur en bij nieuwe collega’s. Ook garages en autobedrijven kleden we zo, met werkplaatskleding die tegen olie kan en polo’s voor de showroom.',
    ],
    levering: [
      { title: 'Broeken voor werk op de knieën', text: 'Kniezakken waarin de kussens op de goede plek blijven, versterkte zitvlakken en een snit waarin je kunt bukken en kruipen. Met of zonder holsterzakken, afhankelijk van hoe je werkt.' },
      { title: 'Vlamboog en multinorm', text: 'Voor elektrotechnisch werk aan installaties onder spanning leveren we kleding volgens IEC 61482 in de juiste klasse. We kijken met je naar de risicoanalyse, zodat je niet meer betaalt dan nodig.' },
      { title: 'ESD- en veiligheidsschoenen', text: 'Schoenen die statische lading afvoeren voor werk aan elektronica, en S3 met composiet neus voor de bouwplaats. Passen doe je bij ons, want je staat er de hele dag op.' },
      { title: 'Netjes bij de klant', text: 'Een polo of softshell met geborduurd logo, in een kleur die past bij je bus en je huisstijl. Zo ziet elke monteur er hetzelfde uit, ook de nieuwe.' },
    ],
    items: ['Werkbroeken met kniezakken', 'Polo’s en T-shirts', 'Softshells en jassen', 'Vlamboogkleding', 'ESD- en veiligheidsschoenen', 'Sweaters en bodywarmers'],
    normen: ['IEC 61482 (vlamboog)', 'EN 1149-5 (antistatisch)', 'EN 14404 (kniebescherming)', 'EN ISO 20345 (veiligheidsschoenen)'],
    voorbeeld: { quote: 'Vanaf het eerste moment merkte ik dat er geluisterd werd naar wat ik nodig had. Binnen een paar dagen een duidelijke offerte en een week later lag alles klaar.', author: 'Elektrotechniek Achterhoek' },
    brands: ['Snickers Workwear', 'Fristads', 'Hydrowear', 'U-Power', 'Tricorp', 'FHB'],
    gallery: ['/veiligheidsschoenen-achterhoek-1.jpg', '/Bedrijfskleding-bedrukken-en-borduren.jpg'],
    faq: [
      { q: 'Welke vlamboogklasse heb ik nodig?', a: 'Dat hangt af van de installatie waaraan je werkt: hoe hoger de kortsluitstroom, hoe hoger de klasse. Klasse 1 is getest bij 4 kA, klasse 2 bij 7 kA. Neem de risicoanalyse mee of vraag het je leidinggevende; wij zoeken er de juiste kleding bij.' },
      { q: 'Wat is het verschil tussen antistatisch en ESD?', a: 'Antistatische kleding en schoenen voorkomen vonken door opgebouwde lading. ESD gaat een stap verder en voert de lading gecontroleerd af, zodat je gevoelige elektronica niet beschadigt. Voor werk aan printplaten, omvormers en laadpalen is ESD de betere keuze.' },
      { q: 'Kunnen jullie een vaste set per monteur vastleggen?', a: 'Ja. We leggen per functie vast wat iemand krijgt, met maat en logo. Komt er een monteur bij, dan bestel je zijn set in het portaal en ligt hij er meestal binnen een paar werkdagen.' },
    ],
  },
  {
    slug: 'industrie-en-logistiek',
    name: 'Werkkleding voor industrie en logistiek',
    navLabel: 'Industrie & logistiek',
    metaTitle: 'Werkkleding industrie & logistiek Achterhoek',
    metaDescription:
      'Werkkleding voor productie, metaal en logistiek in de Achterhoek. Multinorm en vlamvertragend, ESD-schoenen, hi-vis voor het terrein. Met jouw logo.',
    image: '/Bedrijfskleding-achterhoek-borduren.jpg',
    heroIntro:
      'Lange diensten vragen om kleding die comfortabel blijft en niet na een half jaar versleten is.',
    body: [
      'In de logistiek en productie draait het om uren maken. Kleding die schuurt of te warm is, kost je dan elke dag iets. Wij kiezen modellen die de hele dienst zitten, met stof die tegen wassen kan en kleuren die herkenbaar blijven. De maakindustrie in de Achterhoek zit op terreinen als Hofskamp Oost in Varsseveld, De Mars in Zutphen en Laarberg bij Groenlo, en die bedrijven kennen we.',
      'Bij laden en lossen of werk op het terrein is zichtbaarheid belangrijk. We leveren hi-vis waar dat nodig is en gewone werkkleding waar dat genoeg is. Je betaalt niet voor functies die je niet gebruikt. Voor wie last, bij een oven staat of met brandbare stoffen werkt, leveren we multinorm kleding van Hydrowear en Fristads die vlamvertragend en antistatisch is. Bij elektronica en schone productie horen ESD-schoenen; daar hebben we een ruime keus in van U-Power.',
      'Veel transportbedrijven werken met een vaste lijn over meerdere chauffeurs. Die leggen we vast, zodat een nieuwe chauffeur dezelfde set krijgt en je niet elke keer opnieuw hoeft te kiezen. Eén polo, een softshell en een bodywarmer in de huiskleur, en je hele wagenpark ziet er hetzelfde uit.',
    ],
    levering: [
      { title: 'Slijtvaste werkbroeken en jassen', text: 'Modellen die tegen dagelijks gebruik kunnen, met genoeg zakken voor scanner, telefoon en handschoenen. Stof die tegen industriële was kan zonder snel te verkleuren.' },
      { title: 'Hi-vis waar het moet', text: 'Voor het laad- en losterrein leveren we zichtbaarheidskleding in de juiste klasse, zonder dat het de rest van het team onnodig opzadelt.' },
      { title: 'Comfortabel bij wisselend weer', text: 'Van ademende zomershirts tot gevoerde winterjassen, zodat de kleding klopt, ook als het vriest op het terrein of juist warm is in de loods.' },
      { title: 'Multinorm en vlamvertragend', text: 'Lassers, operators en monteurs in de procesindustrie dragen kleding die tegen vonken, hitte en statische lading beschermt. We kijken met je naar de RI&E welke normen echt nodig zijn, zodat je niet te veel en niet te weinig betaalt.' },
      { title: 'Een vaste lijn per functie', text: 'We leggen vast wat een operator, chauffeur, magazijnmedewerker of monteur draagt. Nabestellen is daarna een belletje of een klik in het portaal.' },
    ],
    items: ['Werkbroeken', 'Multinorm en laskleding', 'Overalls', 'Softshell- en winterjassen', 'Hi-vis kleding', 'Polo’s en sweaters', 'Veiligheidsschoenen en ESD-schoenen'],
    normen: ['EN ISO 11612 (hitte en vlammen)', 'EN ISO 11611 (lassen)', 'EN 1149-5 (antistatisch)', 'EN ISO 20471 (hi-vis)', 'EN ISO 20345 (veiligheidsschoenen)'],
    voorbeeld: { quote: 'Wij zijn altijd super tevreden met de service. Jessi is snel en vakkundig in het uitzoeken en leveren van onze bedrijfskleding, en prettig in contact.', author: 'Bouwbedrijf Goossens Melgers' }, // Was "Een transportbedrijf uit de regio", maar dit citaat komt uit de review van Goossens Melgers (content/reviews.ts). Nooit een citaat aan een andere afzender toeschrijven.
    brands: ['Hydrowear', 'Fristads', 'Snickers Workwear', 'Tricorp', 'U-Power'],
    gallery: ['/Bedrijfskleding-bedrukken-en-borduren.jpg'],
    faq: [
      { q: 'Kunnen jullie snel nabestellen voor een nieuwe chauffeur?', a: 'Ja. Je lijn ligt bij ons vast, dus we leveren dezelfde set inclusief logo meestal binnen een paar dagen.' },
      { q: 'Leveren jullie ook gevoerde winterkleding?', a: 'Zeker, van bodywarmers tot gevoerde softshells en winterjassen, geschikt voor werk in en rond de loods.' },
      { q: 'Hebben jullie vlamvertragende kleding voor lassers?', a: 'Ja. We leveren multinorm kleding die voldoet aan EN ISO 11612 en EN ISO 11611, vaak ook antistatisch. Welke klasse je nodig hebt hangt af van het laswerk; dat bekijken we samen.' },
    ],
  },
  {
    slug: 'horeca-en-food',
    name: 'Bedrijfskleding voor horeca en food',
    navLabel: 'Horeca & food',
    metaTitle: 'Horecakleding met logo voor restaurants en hotels in de Achterhoek',
    metaDescription:
      'Horecakleding voor keuken, bediening en foodbedrijven: koksbuizen, schorten, blouses en gilets. Met logo geborduurd, passen in de Achterhoek.',
    image: '/Kleding-horeca-Achterhoek.jpg',
    fit: 'contain',
    heroIntro:
      'In de horeca is je team het eerste wat een gast ziet. De kleding mag dat laten zien.',
    body: [
      'Een goede koksbuis ademt, een schort zit niet in de weg en een overhemd ziet er aan het eind van de avond nog net zo netjes uit als aan het begin. Daar kiezen we op. Voor de bediening werken we met Xirtrum, dat kleding maakt voor hotels en restaurants, en voor de keuken met koksbuizen van WK. Designed To Work.',
      'We kijken naar de sfeer van je zaak. Een grandcafé vraagt iets anders dan een sterrenrestaurant of een lunchroom. Samen kiezen we kleur, model en stof die daarbij horen. In een hete keuken telt ademend katoen of een katoenmix, achter de bar mag het wat strakker en netter.',
      'Voor het logo adviseren we vaak borduren. Dat oogt verzorgd en gaat goed door de vaak hete was van horecatextiel. Voor de zaken in Doetinchem, Zutphen, Doesburg en de rest van de Achterhoek leveren we van koksbuis tot antislipschoen, en ook voor bakkers, slagers en foodproductie, waar hygiëne en vaak wassen voorop staan.',
    ],
    levering: [
      { title: 'Koksbuizen en koksbroeken', text: 'Ademende stoffen, modellen voor heren en dames, en kleuren die verder gaan dan standaard wit. Knopen of een drukstrip, korte of lange mouw, zoals jij het wilt.' },
      { title: 'Schorten in veel stijlen', text: 'Van klassiek lang tot kort sloofschort of leren look, passend bij de uitstraling van je zaak. Met of zonder borstzak voor pen en bonnenboekje.' },
      { title: 'Bediening die klopt', text: 'Overhemden, blouses en polo’s die de dienst doorstaan en netjes blijven, ook na een drukke avond en de was die daarop volgt.' },
      { title: 'Logo dat de was overleeft', text: 'Meestal geborduurd, zodat het ook na tientallen wasbeurten op hoge temperatuur strak blijft.' },
    ],
    items: ['Koksbuizen', 'Schorten', 'Overhemden en blouses', 'Gilets en vesten', 'Polo’s', 'Antislip werkschoenen'],
    voorbeeld: { quote: 'Wij hebben werkjassen besteld en zijn hier heel tevreden over. Warm, goede kwaliteit, goede service en mooie logo’s. Echt een aanrader.', author: 'Café-zaal De Jongens' },
    brands: ['Xirtrum', 'WK. Designed To Work', 'Mi-piace', 'Brook Taverner'],
    gallery: ['/Horeca-en-hospitality-achterhoek.jpg'],
    faq: [
      { q: 'Borduren of bedrukken voor horeca?', a: 'Voor horeca adviseren we meestal borduren. Het oogt verzorgd en gaat goed door de hete was. Per kledingstuk bekijken we wat het mooiste resultaat geeft.' },
      { q: 'Hebben jullie ook antislip werkschoenen voor de keuken?', a: 'Ja, we leveren keukenschoenen met antislipzool en goede demping voor lange diensten.' },
    ],
  },
  {
    slug: 'kantoor-en-retail',
    name: 'Bedrijfskleding voor kantoor en retail',
    navLabel: 'Kantoor & retail',
    metaTitle: 'Bedrijfskleding kantoor, winkel en showroom Achterhoek',
    metaDescription:
      'Zakelijke bedrijfskleding voor kantoor, receptie, winkel en showroom: overhemden, blouses, polo’s en vesten met subtiel logo, passen in de Achterhoek.',
    image: '/werkkleding-kantoor-achterhoek.jpg',
    fit: 'contain',
    heroIntro:
      'Voor wie de klant als eerste ziet: op kantoor, aan de balie, in de winkel of in de showroom.',
    body: [
      'Een receptioniste, verkoper in de showroom, winkelmedewerker of accountmanager is het gezicht van je bedrijf. De eerste indruk zit deels in de kleding. We stellen een lijn samen die zakelijk oogt en toch praktisch is om de hele dag in te werken, met overhemden en pantalons van Brook Taverner en blouses van Mi-piace en TQ Amsterdam.',
      'Denk aan een nette polo onder een softshell met daarop je logo, of een overhemd dat past bij de huisstijl. We houden de set consistent, zodat je hele team dezelfde uitstraling heeft, of het nu de buitendienst is of de mensen op kantoor. Voor heren en dames hetzelfde beeld, in modellen die voor allebei goed zitten.',
      'Kleur en logo-positie kiezen we samen, afgestemd op je huisstijl. Vaak is een subtiel geborduurd logo sterker dan een grote print. We leggen de RAL- of Pantone-kleur en de logo-positie vast, zodat een nabestelling er over een jaar nog precies hetzelfde uitziet.',
    ],
    levering: [
      { title: 'Polo’s en overhemden', text: 'Modellen die netjes blijven en passen bij je huisstijl, voor heren en dames, in stof die niet snel kreukt of uitlubbert.' },
      { title: 'Softshells en bodywarmers', text: 'Een laag eroverheen die zakelijk oogt en toch warm en praktisch is, ideaal voor wie binnen en buiten werkt.' },
      { title: 'Winkel en showroom', text: 'Herkenbaar voor de klant en comfortabel voor wie de hele dag staat. In winkels wisselt het personeel vaak; in het portaal bestel je een nieuwe set in de juiste maat zonder opnieuw te hoeven kiezen.' },
      { title: 'Consistente uitstraling', text: 'We houden kleur, model en logo gelijk over het hele team en leggen het vast, zodat het er als een geheel uitziet en blijft.' },
    ],
    items: ['Overhemden en blouses', 'Pantalons en rokken', 'Colberts en blazers', 'Polo’s', 'Truien en vesten', 'Softshells en bodywarmers'],
    voorbeeld: { quote: 'Sinds enige tijd gebruiken wij de werkkleding van Frederiks. Onze ervaring is heel goed en aan te bevelen. Topservice en kwaliteit.', author: 'BZV Zonwering' },
    brands: ['Brook Taverner', 'Mi-piace', 'TQ Amsterdam', 'Xirtrum', 'WK. Designed To Work'],
    gallery: ['/Representatie-werkkleding-achterhoek-leverancier.jpg'],
    faq: [
      { q: 'Kunnen jullie de kleding op onze huisstijl afstemmen?', a: 'Ja. We kiezen kleur, model en logo-positie zo dat het past bij je huisstijl en consistent is over het hele team.' },
      { q: 'Leggen jullie de kleur en logo-positie vast voor nabestellingen?', a: 'Zeker. We leggen de kleur en de plek van het logo vast, zodat een nabestelling er over een jaar nog precies hetzelfde uitziet als de eerste set.' },
    ],
  },
  {
    slug: 'agrarisch-en-groen',
    name: 'Werkkleding voor agrarisch en groen',
    navLabel: 'Agrarisch & groen',
    metaTitle: 'Werkkleding agrarisch, hovenier en groen Achterhoek',
    metaDescription:
      'Werkkleding voor boeren, loonwerkers en hoveniers in de Achterhoek: overalls, regenkleding, gevoerde jassen en S3-schoenen. Met jouw logo.',
    image: '/Bedrijfskleding-Achterhoek.jpg',
    heroIntro:
      'Buiten werken vraagt om kleding die tegen weer, modder en lange dagen kan.',
    body: [
      'In de agrarische en groene sector is je kleding elke dag in de weer met regen, stof en aarde. Dan moet stof stevig zijn en moet een jas droog houden zonder dat je erin staat te zweten. We kiezen modellen die daarvoor gemaakt zijn. De Achterhoek is boerenland: melkveehouders, akkerbouwers, loonbedrijven en hoveniers vormen een groot deel van onze klanten, en hun werk kennen we van dichtbij.',
      'Het werk wisselt met het seizoen. In de oogsttijd of bij het kuilen maak je lange dagen in de zon, in de winter sta je in de kou bij het voeren of het snoeiwerk. Daarom denken we in lagen: een licht shirt voor de zomer, een bodywarmer voor het tussenseizoen en een gevoerde jas voor de winter. Zo klopt de kleding het hele jaar.',
      'Stevige werkschoenen of laarzen horen erbij. Wie de hele dag in de stal of op nat land loopt, heeft andere zolen nodig dan wie op de trekker zit. We helpen je kiezen wat past bij het terrein waarop je werkt, en bedrukken het logo van je melkveebedrijf of loonbedrijf in eigen huis.',
    ],
    levering: [
      { title: 'Overalls en tuinbroeken', text: 'Stevige modellen die tegen modder en machines kunnen, met genoeg ruimte om in te werken en zakken voor tang, mes en touw.' },
      { title: 'Weerbestendige jassen', text: 'Jassen die droog houden en ademen, met gevoerde varianten voor de winter en lichtere voor het voor- en najaar.' },
      { title: 'Schoenen en laarzen', text: 'Van veiligheidsschoenen tot laarzen, afgestemd op nat en zwaar terrein, de stal of het land.' },
    ],
    items: ['Overalls', 'Tuinbroeken', 'Winterjassen', 'Bodywarmers', 'Veiligheidsschoenen en laarzen'],
    voorbeeld: { quote: 'We kopen al jaren onze bedrijfskleding bij Jessi. Ruime collectie, en als het er niet is bestelt ze een pasmaat. Ze denkt mee en kijkt naar de mogelijkheden.', author: 'All Waves' },
    brands: ['FHB', 'Snickers Workwear', 'Hydrowear', 'Grisport', 'Pfanner'],
    faq: [
      { q: 'Hebben jullie kleding die echt droog houdt bij regen?', a: 'Ja, we leveren waterdichte en ademende jassen, zodat je droog blijft zonder dat je erin staat te zweten.' },
      { q: 'Leveren jullie ook laarzen voor in de stal en op het land?', a: 'Zeker. Van veiligheidsschoenen tot stevige laarzen, afgestemd op nat en zwaar terrein. We helpen je kiezen wat bij je werk past.' },
    ],
  },
  {
    slug: 'zorg-en-salon',
    name: 'Bedrijfskleding voor zorg en salons',
    navLabel: 'Zorg & salon',
    metaTitle: 'Zorgkleding en salonkleding met logo in de Achterhoek',
    metaDescription:
      'Kleding voor praktijken, thuiszorg, kappers en salons in de Achterhoek: zorgbroeken, polo’s, blouses en tunieken die heet gewassen mogen worden.',
    image: '/Schoonheidsspecialist-kkapper-leding-Achterhoek-1.jpg',
    fit: 'contain',
    heroIntro:
      'Kleding die de hele dag fris blijft en vertrouwen wekt bij wie tegenover je zit.',
    body: [
      'In de zorg en in salons werk je dicht op de huid van een ander. Dan helpt het als je kleding er verzorgd uitziet en makkelijk schoon te houden is. We kiezen stoffen die vaak en heet gewassen mogen worden en die toch hun vorm houden. Voor een huisartsenpraktijk, een fysiopraktijk of een tandartsassistente luistert dat nauw, want een tuniek die na tien wasbeurten slap hangt straalt niet veel uit.',
      'Comfort telt zwaar. Wie de hele dag tilt, bukt en strekt, voelt het meteen als een tuniek of jas knelt. We passen daarom op de persoon, niet op een standaardmaat, en kijken naar modellen met wat rek en goede armsgaten. In de salon is een schort of jas die niet in de weg zit bij het knippen of behandelen net zo belangrijk.',
      'Voor salons en beauty kijken we ook naar uitstraling. Een rustige kleur met een subtiel geborduurd logo doet vaak meer dan een opvallende print. Voor kappers, schoonheidsspecialisten en nagelstudio’s in de Achterhoek leveren we een lijn die bij de sfeer van de zaak past en jaren mooi blijft.',
    ],
    levering: [
      { title: 'Zorgbroeken, polo’s en tunieken', text: 'Comfortabele modellen die met je meebewegen en op 60 graden gewassen kunnen worden. Met praktische zakken voor wat je de hele dag bij je draagt.' },
      { title: 'Salon- en beautykleding', text: 'Verzorgde modellen in rustige kleuren, passend bij de sfeer van je salon. Schorten en jassen die niet in de weg zitten tijdens het werk.' },
      { title: 'Subtiel geborduurd logo', text: 'Klein en netjes op de borst, zodat het verzorgd oogt en lang mooi blijft, ook na de vele wasbeurten die zorgtextiel maakt.' },
    ],
    items: ['Zorgbroeken', 'Polo’s', 'Blouses', 'Tunieken', 'Schorten'],
    brands: ['WK. Designed To Work', 'Mi-piace', 'Tricorp'],
    faq: [
      { q: 'Kan de kleding op hoge temperatuur gewassen worden?', a: 'Ja, we kiezen bewust stoffen die vaak en heet gewassen kunnen worden en toch hun vorm houden.' },
      { q: 'Leveren jullie ook voor kappers en schoonheidssalons?', a: 'Ja. Voor salons en beauty hebben we verzorgde schorten, tunieken en jassen in rustige kleuren, met een subtiel logo dat past bij de sfeer van je zaak.' },
    ],
  },
  {
    slug: 'clubs-en-verenigingen',
    name: 'Kleding voor clubs en verenigingen',
    navLabel: 'Clubs & verenigingen',
    metaTitle: 'Clubkleding en teamkleding met logo Achterhoek',
    metaDescription:
      'Clubkleding voor verenigingen, teams en evenementen in de Achterhoek: shirts, hoodies en jassen met logo, sponsor of naam. Ook kleine oplagen.',
    image: '/Promotionele-sportkleding-Achterhoek.jpg',
    // Foto is maar 355 px breed: niet schermvullend oprekken.
    fit: 'contain',
    heroIntro:
      'Voor clubs, teams en sponsoren. Herkenbare kleding waarmee je opvalt.',
    body: [
      'Een team dat er als een team uitziet, dat straalt iets uit. Voor clubs, sponsoracties en evenementen leveren we shirts, hoodies en accessoires met jouw logo of dat van de sponsor. De Achterhoek heeft een rijk verenigingsleven, van voetbal en handbal tot schutterij en de vele zomerevenementen, en daar maken we graag de kleding voor.',
      'Kleine oplage of groot, we regelen het allebei. Voor een enkel team kiezen we vaak een ander druktechniek dan voor een hele vereniging. Voor een sponsorlogo op een shirt kijken we naar een techniek die lang meegaat, ook na het wassen en het sporten, zodat de sponsor het hele seizoen goed in beeld blijft.',
      'Heb je meerdere sponsoren of namen op de rug nodig, dan denken we mee over de opzet zodat het overzichtelijk blijft. Voor evenementen leveren we ook caps, tassen en andere promotieartikelen, zodat alles in één stijl bij elkaar past.',
    ],
    levering: [
      { title: 'Team- en clubshirts', text: 'Sportieve modellen met logo of sponsor, in de kleuren van je club, met namen en nummers waar je die wilt.' },
      { title: 'Hoodies en sweaters', text: 'Voor naast het veld en de derde helft, met opdruk of borduring in je clubkleuren.' },
      { title: 'Kleine en grote oplagen', text: 'Van een enkel team tot een hele vereniging, met een druktechniek die past bij de oplage en het budget.' },
    ],
    items: ['T-shirts', 'Hoodies en sweaters', 'Trainingsjassen', 'Caps en accessoires'],
    brands: ['WK. Designed To Work', 'Kariban'],
    hoofdmenu: false,
    faq: [
      { q: 'Kunnen jullie ook namen en nummers op de rug zetten?', a: 'Ja, we verzorgen namen, nummers en sponsoren. Bij meerdere namen denken we mee over een overzichtelijke opzet.' },
      { q: 'Doen jullie ook kleine oplagen voor één team?', a: 'Zeker. Of het nu om één team gaat of een hele vereniging, we kiezen een druktechniek die bij de oplage past zodat het ook voor een kleine bestelling betaalbaar blijft.' },
    ],
  },
];

/** Branches in het hoofdmenu en de branchetegels. */
export const hoofdBranches = branches.filter((b) => b.hoofdmenu !== false);

export const branchesBySlug = Object.fromEntries(branches.map((b) => [b.slug, b]));
