import type { BrancheVerdieping } from './type';

export const verdieping: BrancheVerdieping | null = {
  slug: 'industrie-en-logistiek',
  bijgewerkt: '2026-10-06',
  regioIntro:
    'In de Achterhoek zit meer industrie dan je op het eerste gezicht denkt. Het gaat om metaalbewerking, machinebouw, mechatronica en toeleveranciers, vaak familiebedrijven, naast distributie en transport. Werkgevers als Royal Kaak in Terborg (bakkerijmachines), NEDCON in Doetinchem (opslagsystemen), Kramp in Varsseveld (distributie) en Ter Horst Groep in Varsseveld (transport en logistiek) laten zien hoe breed dat is. Voor dat soort bedrijven leveren we kleding, van de werkplaats en productiehal tot het magazijn en het wagenpark.',
  kerncijfers: [
    {
      waarde: '17%',
      label: 'van alle werknemersbanen in de Achterhoek zit in de industrie',
      bron: 'UWV, Regio in Beeld Achterhoek 2025-2026',
      bronUrl: 'https://www.uwv.nl/assets-kai/files/ae4165b2-f127-43cc-b692-7c4d7a440731/Regio_in_Beeld_2025-2026_Achterhoek.pdf',
    },
    {
      waarde: '650',
      label: 'openstaande vacatures per kwartaal in de Achterhoekse industrie (gemiddeld in 2025)',
      bron: 'UWV, Regio in Beeld Achterhoek 2025-2026',
      bronUrl: 'https://www.uwv.nl/assets-kai/files/ae4165b2-f127-43cc-b692-7c4d7a440731/Regio_in_Beeld_2025-2026_Achterhoek.pdf',
    },
    {
      waarde: 'circa 6.000',
      label: 'vacatures voor vrachtwagenchauffeurs in Nederland (4e kwartaal 2025)',
      bron: 'STL, Sectormonitor 4e kwartaal 2025',
      bronUrl: 'https://www.stl.nl/over-stl/actueel/sectormonitor-4e-kwartaal-2025-0df1528b5d89145845908c407e6f180e/',
    },
    {
      waarde: '45,5 jaar',
      label: 'gemiddelde leeftijd van een vrachtwagenchauffeur in Nederland',
      bron: 'STL, Sectormonitor 4e kwartaal 2025',
      bronUrl: 'https://www.stl.nl/over-stl/actueel/sectormonitor-4e-kwartaal-2025-0df1528b5d89145845908c407e6f180e/',
    },
  ],
  functies: [
    {
      functie: 'Vrachtwagenchauffeur',
      werk: 'Rijdt vaste of wisselende routes en laadt en lost bij klanten, vaak op het terrein van een ander bedrijf.',
      kleding: 'Werkbroek met stevige knieën, polo of shirt met logo op borst en rug, softshell of bodywarmer, regenjas bij laden en lossen, lage veiligheidsschoen.',
      normen: 'EN ISO 20471 (hi-vis) in de klasse die het terrein van de klant eist, EN 343 voor de regenjas, EN ISO 20345 S1 of S3 voor schoenen.',
      sets: '2 broeken, 4 shirts of polo’s, 1 softshell of bodywarmer, 1 regenjas, 1 paar schoenen',
      vakgebied: 'transport-en-logistiek',
    },
    {
      functie: 'Magazijnmedewerker en orderpicker',
      werk: 'Pickt, verpakt en verplaatst goederen, de hele dienst in beweging en vaak met een scanner in de zak.',
      kleding: 'Lichte, rekbare werkbroek met weinig zakken aan de bovenbenen, polo of shirt, sweater of vest voor de koele loods, lichte veiligheidsschoen.',
      normen: 'EN ISO 20345 S1 of S3 voor schoenen, hi-vis (EN ISO 20471 of EN 17353) alleen als het magazijn dat voorschrijft, voor de rest geen specifieke norm.',
      sets: '2 broeken, 4 shirts, 1 sweater of vest, 1 paar schoenen',
      vakgebied: 'transport-en-logistiek',
    },
    {
      functie: 'Heftruck- en reachtruckchauffeur',
      werk: 'Rijdt tussen stellingen, laaddocks en voetgangers, in en buiten de loods.',
      kleding: 'Hi-vis jas of vest, werkbroek, gevoerde jas voor het laaddock, veiligheidsschoen met stalen of composiet neus.',
      normen: 'EN ISO 20471 klasse 2 of 3 waar het terrein dat eist, EN ISO 20345 S3, bij koude loodsen EN 342.',
      sets: '2 broeken, 3 shirts, 1 hi-vis jas of vest, 1 winterjas, 1 paar schoenen',
      vakgebied: 'transport-en-logistiek',
    },
    {
      functie: 'Lasser en constructiewerker',
      werk: 'Last en slijpt staal in de werkplaats of op locatie, met vonken en spatten rond het lichaam.',
      kleding: 'Lasjas en lasbroek of overall in vlamvertragend materiaal, shirt eronder van katoen of vlamvertragend, laskousen of lasschort naar behoefte, veiligheidsschoen met hoge schacht.',
      normen: 'EN ISO 11611 klasse 1 voor lichtere lasmethoden, klasse 2 voor zwaardere, EN ISO 20345 S3.',
      sets: '2 lasbroeken of overalls, 2 lasjassen, 3 shirts, 1 paar schoenen',
      vakgebied: 'metaal-en-industrie',
    },
    {
      functie: 'CNC-operator en machinebankwerker',
      werk: 'Bedient draai-, frees- en kantbanken en werkt met olie, spanen en zwaar gereedschap.',
      kleding: 'Stevige, goed sluitende werkbroek of overall zonder loshangende delen, shirt, werkjas of vest, veiligheidsschoen.',
      normen: 'EN ISO 20345 S3 voor schoenen, voor de kleding zelf geen specifieke norm.',
      sets: '3 broeken of overalls, 4 shirts, 1 jas of vest, 1 paar schoenen',
      vakgebied: 'metaal-en-industrie',
    },
    {
      functie: 'Productiemedewerker en assemblage',
      werk: 'Werkt aan een lijn of in een cel, staand en met herhalende bewegingen.',
      kleding: 'Lichte werkbroek, poloshirt of T-shirt, sweater, comfortabele werkschoen.',
      normen: 'EN ISO 20345 S1 of S3 als de risico-inventarisatie dat vraagt, anders geen specifieke norm.',
      sets: '2 broeken, 4 shirts, 1 sweater, 1 paar schoenen',
      vakgebied: 'metaal-en-industrie',
    },
    {
      functie: 'Onderhoudsmonteur en servicemonteur machinebouw',
      werk: 'Onderhoudt en repareert machines in de fabriek of bij klanten, soms buiten en soms op hoogte.',
      kleding: 'Werkbroek met veel opbergruimte, shirt of polo, softshell, regenjas, hi-vis bij werk op het terrein van een klant, veiligheidsschoen.',
      normen: 'EN ISO 20345 S3, EN ISO 20471 waar het terrein dat eist, EN 343 voor regenkleding.',
      sets: '3 broeken, 4 shirts, 1 softshell, 1 regenjas, 1 paar schoenen',
      vakgebied: 'installatie-en-techniek',
    },
    {
      functie: 'Medewerker koelhuis of vrieshuis',
      werk: 'Pickt en verlaadt in de koude, met korte wissels tussen koud en buitentemperatuur.',
      kleding: 'Gevoerde jas en broek of overall, thermisch ondergoed, muts en handschoenen, geïsoleerde veiligheidsschoen.',
      normen: 'EN 342 voor koudebeschermende kleding, EN ISO 20345 voor schoenen.',
      sets: '1 koude-jas, 1 koude-broek of overall, 3 shirts om onder te dragen, 1 paar schoenen',
      vakgebied: 'transport-en-logistiek',
    },
  ],
  uitdagingen: [
    {
      titel: 'Het logo op hi-vis kleding',
      probleem:
        'Hi-vis moet een minimale oppervlakte fluorescerend en reflecterend materiaal houden, bij klasse 2 bijvoorbeeld 0,50 m² fluorescerend en 0,13 m² reflecterend. Een te groot of verkeerd geplaatst logo haalt daar vanaf en het kledingstuk valt dan buiten de klasse.',
      aanpak:
        'We bepalen de plek en het formaat van het logo voor we iets bedrukken of borduren, en laten je eerst een drukproef zien. Zo weet je vooraf dat het logo op borst en rug staat zonder de zichtbaarheid aan te tasten.',
    },
    {
      titel: 'Nieuwe medewerkers, uitzendkrachten en wisselende ploegen',
      probleem:
        'In een magazijn of productiehal komt er regelmatig iemand bij of af. Wie elke keer opnieuw maten, modellen en bedrukking moet uitzoeken, verliest tijd, en iemand die in een eigen shirt start valt op in het team.',
      aanpak:
        'Je lijn per functie ligt bij ons vast. In het gratis kledingportaal stelt een leidinggevende een budget per medewerker in, de medewerker kiest zijn maat en je keurt de bestelling goed. Nabestellen kost geen uitzoekwerk meer.',
    },
    {
      titel: 'Maten die niet kloppen',
      probleem:
        'Een broek die knelt bij het bukken of een jas die te krap zit bij het sjouwen wordt niet gedragen. Medewerkers kopen dan zelf iets, of lopen in oude kleding die niet meer voldoet.',
      aanpak:
        'We komen langs voor een passessie op locatie, in de pauze of aan het eind van een dienst. Iedereen past de echte modellen en de maat gaat vast in het portaal, dus een volgende bestelling is meteen goed.',
    },
    {
      titel: 'Veiligheidsschoenen en het juiste niveau',
      probleem:
        'S1, S1P, S3: veel werkgevers weten niet welk niveau bij welke functie past, en sinds de nieuwe norm EN ISO 20345:2022 staan er extra letters op de schoen. Te zwaar is slecht voor het comfort, te licht is een risico.',
      aanpak:
        'We adviseren per functie een niveau op basis van wat de medewerker doet. De risico-inventarisatie van je eigen bedrijf blijft leidend, wij vertalen die naar concrete modellen en maten.',
    },
    {
      titel: 'Kleding die de was niet overleeft',
      probleem:
        'Werkkleding in de industrie gaat op hoge temperatuur door de was. Kleuren verschieten, reflecterende banden slijten en een opgestreken logo laat los.',
      aanpak:
        'We kiezen stoffen en bedrukkingen die tegen jouw wasmethode kunnen en maken bij twijfel eerst een drukproef. Voor kleding die vaak en heet wordt gewassen adviseren we borduren of een slijtvaste bedrukking.',
    },
    {
      titel: 'Elke dienst weer andere kleding',
      probleem:
        'Een chauffeur op het terrein van een klant, een lasser in de werkplaats en een picker in de koude loods hebben elk andere eisen. Zonder vaste lijn draagt iedereen wat hij zelf kocht, en dat ziet de klant ook.',
      aanpak:
        'We leggen per functie een vaste set vast met dezelfde huiskleur en hetzelfde logo, met een vast aanspreekpunt bij ons voor alle vragen. De set is daarna voor iedereen in het portaal hetzelfde te bestellen.',
    },
  ],
  veranderingen: [
    {
      titel: 'Nieuwe norm voor veiligheidsschoenen: EN ISO 20345:2022',
      tekst:
        'De norm is voor het eerst sinds 2011 herzien. Nieuwe modellen die na 30 maart 2022 op de markt kwamen, moeten volgens de nieuwe norm zijn gecertificeerd, en er is een overgangsperiode waarin beide versies naast elkaar bestaan. De klassen lopen nu van SB tot S7 en er zijn nieuwe markeringen bijgekomen, zoals SC (slijtbestendige neuskap) en LG (grip voor ladders). Op de schoen staat welke versie geldt.',
      bronUrl: 'https://www.wurth.nl/nl/wuerth_nl/onderneming/blog/productinformatie/2023_2/veiligheidsschoenen_blog.php',
    },
    {
      titel: 'UPV Textiel sinds 1 juli 2023',
      tekst:
        'Producenten en importeurs die bedrijfskleding voor het eerst in Nederland op de markt brengen, moeten inzameling en verwerking organiseren en financieren. De doelen zijn 50% voorbereiding voor hergebruik en recycling in 2025 en 75% in 2030. Als afnemer merk je dit vooral bij leveranciers en bij wat er met afgedankte kleding gebeurt.',
      bronUrl: 'https://www.stichtingupvtextiel.nl/regelgeving/',
    },
    {
      titel: 'Krappe arbeidsmarkt in industrie en transport',
      tekst:
        'UWV beschrijft de arbeidsmarkt voor technische beroepen in de Achterhoek als zeer krap tot krap, met gemiddeld 650 vacatures per kwartaal in de industrie in 2025. Voor vrachtwagenchauffeurs noemt UWV de arbeidsmarkt zeer krap. Werkgevers concurreren dus op meer dan loon, en zichtbare zorg voor werkkleding hoort daar bij.',
      bronUrl: 'https://www.uwv.nl/assets-kai/files/ae4165b2-f127-43cc-b692-7c4d7a440731/Regio_in_Beeld_2025-2026_Achterhoek.pdf',
    },
    {
      titel: 'Zichtbaarheid binnen: EN 17353 naast EN ISO 20471',
      tekst:
        'Voor magazijnen en terreinen met een lager risico dan een openbare weg bestaat naast EN ISO 20471 de norm EN 17353. Die laat meer kleuren toe dan het klassieke fluorescerende geel, oranje en rood. Zo kan zichtbaarheid beter bij de huisstijl passen, mits de norm past bij het risico in jouw bedrijf.',
      bronUrl: 'https://www.gergotal.nl/tips-gergotal/werkkleding-logistiek-comfort-zichtbaarheid-en-functionaliteit/',
    },
  ],
  kansen: [
    {
      titel: 'Onbelast verstrekken via een logo van minimaal 70 cm²',
      tekst:
        'Kleding met een zichtbaar bedrijfslogo van minstens 70 cm² geldt volgens de regels als werkkleding. Wij controleren vooraf of het logo op elk stuk aan die maat voldoet, zodat je de kleding onbelast aan je medewerkers kunt verstrekken. Persoonlijke beschermingsmiddelen die de Arbowet vraagt, betaal je als werkgever sowieso zelf.',
    },
    {
      titel: 'Een complete set op de eerste werkdag',
      tekst:
        'Er staan in Nederland circa 6.000 vacatures voor vrachtwagenchauffeurs open en de Achterhoekse industrie heeft gemiddeld 650 vacatures per kwartaal. Wie nieuw begint met een passende set, goede schoenen en het bedrijfslogo erop, voelt zich eerder deel van het team. In een krappe markt telt zo’n detail mee.',
    },
    {
      titel: 'Kledingbeheer in het portaal in plaats van bij de planner',
      tekst:
        'Met budget per medewerker, vaste maten en goedkeuring door de leidinggevende hoeft niemand meer tussendoor te bellen voor een nieuwe broek. Dat haalt werk weg bij de planner of kantoorbeheerder.',
    },
    {
      titel: 'Herkenbaar bij je klanten',
      tekst:
        'Een chauffeur staat bij klanten op de laad- en losplek, een monteur staat in hun fabriek. Een logo op borst en rug in een vaste kleur maakt je bedrijf herkenbaar zonder dat je er iets extra voor doet.',
    },
  ],
  extraFaq: [
    {
      q: 'Welke hi-vis klasse heb ik nodig voor mijn chauffeurs?',
      a: 'Dat bepaalt het terrein waar ze komen en je risico-inventarisatie, niet de wet alleen. Klasse 1 vraagt minimaal 0,14 m² fluorescerend materiaal, klasse 2 0,50 m² en klasse 3 0,80 m². Vraag het na bij de klanten waar je chauffeurs komen, dan kiezen wij de bijpassende kleding.',
    },
    {
      q: 'Mag er een logo op hi-vis kleding?',
      a: 'Ja, maar het mag de minimale fluorescerende en reflecterende vlakken niet te klein maken. Daarom bepalen we plek en formaat van het logo voor we beginnen en laten we je een drukproef zien. Op borst en rug past een logo meestal prima.',
    },
    {
      q: 'Moet ik veiligheidsschoenen en veiligheidskleding voor mijn medewerkers betalen?',
      a: 'Ja, voor persoonlijke beschermingsmiddelen die je als werkgever beschikbaar stelt, zijn de kosten voor jou. Dat staat in de Arbowet. Een medewerker hoort er dus niet zelf voor te betalen of mee te betalen.',
    },
    {
      q: 'Wat is het verschil tussen laskleding klasse 1 en klasse 2?',
      a: 'Klasse 1 is bedoeld voor lichtere lasmethoden met minder spatten, klasse 2 voor zwaardere methoden met meer spatten. Het materiaal moet bij klasse 1 minimaal 15 en bij klasse 2 minimaal 25 druppels gesmolten metaal doorstaan. Welke klasse past hangt af van je lasmethode en lasplek.',
    },
    {
      q: 'Welke kleding hoort bij werken in een koelcel of vrieshuis?',
      a: 'Kijk naar EN 342, de norm voor koudebeschermende kleding. De kleding krijgt een isolatiewaarde en een klasse voor wind- en dampdoorlatendheid. Werk je daarnaast met korte wissels tussen koud en buiten, dan werkt kleding in lagen beter dan één dikke jas.',
    },
  ],
  bronnen: [
    { titel: 'UWV, Regio in Beeld Achterhoek 2025-2026', url: 'https://www.uwv.nl/assets-kai/files/ae4165b2-f127-43cc-b692-7c4d7a440731/Regio_in_Beeld_2025-2026_Achterhoek.pdf' },
    { titel: 'STL, Sectormonitor 4e kwartaal 2025', url: 'https://www.stl.nl/over-stl/actueel/sectormonitor-4e-kwartaal-2025-0df1528b5d89145845908c407e6f180e/' },
    { titel: 'Nieuwe Transport, record aantal werknemers in logistiek (1 oktober 2026)', url: 'https://www.nt.nl/logistiek/2026/10/01/recordaantal-werknemers-in-logistiek-maar-tekort-aan-chauffeurs-houdt-aan/' },
    { titel: 'Helemaal Achterhoek, de maakindustrie in de Achterhoek', url: 'https://www.helemaalachterhoek.nl/de-maakindustrie-in-de-achterhoek-motor-van-werkgelegenheid/' },
    { titel: 'Onverwachte Hoek, internationale bedrijven in de Achterhoek', url: 'https://onverwachtehoek.nl/internationale-bedrijven-achterhoek/' },
    { titel: 'AchterhoekWerkt, werkgevers in Varsseveld', url: 'https://achterhoekwerkt.nl/werkgevers/varsseveld/' },
    { titel: 'AchterhoekWerkt, werkgevers in Terborg', url: 'https://achterhoekwerkt.nl/werkgevers/terborg/' },
    { titel: 'Würth, de nieuwe norm EN ISO 20345:2022', url: 'https://www.wurth.nl/nl/wuerth_nl/onderneming/blog/productinformatie/2023_2/veiligheidsschoenen_blog.php' },
    { titel: 'Stichting UPV Textiel, regelgeving', url: 'https://www.stichtingupvtextiel.nl/regelgeving/' },
    { titel: 'Arboportaal, beschikbaar stellen van persoonlijke beschermingsmiddelen', url: 'https://www.arboportaal.nl/onderwerpen/persoonlijke-beschermingsmiddelen/beschikbaar-stellen-van-persoonlijke-beschermingsmiddelen' },
    { titel: 'Blåkläder, EN ISO 20471', url: 'https://www.blaklader.nl/nl/merk/productfeiten/en-normen/en-iso-20471' },
    { titel: 'Fristads, EN ISO 11611', url: 'https://www.fristads.com/nl-nl/productinformatie/productfeiten/standaardfeiten/en-iso-11611' },
    { titel: 'Bowork, EN 342 koudebescherming', url: 'https://www.bowork.nl/blog/post/en-342-norm-bescherming-tegen-koude-omgevingen' },
    { titel: 'Gergotal, werkkleding voor logistiek', url: 'https://www.gergotal.nl/tips-gergotal/werkkleding-logistiek-comfort-zichtbaarheid-en-functionaliteit/' },
    { titel: 'Stolwijk Kennisnetwerk, werkkleding 2026 en de Belastingdienst', url: 'https://stolwijkkennisnetwerk.nl/wat-is-werkkleding-volgens-de-belastingdienst-dit-moet-je-als-werkgever-weten-in-2026/' },
  ],
  vragenVoorJessi: [
    'Welke functies in industrie en transport vragen je het vaakst om kleding, en welke set adviseer je daar echt voor (aantallen broeken, shirts, jassen)?',
    'Eisen klanten in de logistiek of op hun terrein vaak een bepaalde hi-vis klasse, en hoe vaak loopt een logo daarbij tegen de eis aan?',
    'Welke schoenniveaus (S1, S1P, S3) bestellen industriebedrijven in jouw praktijk het meest, en waar kiezen ze te zwaar of te licht?',
    'Hoe gaan bedrijven met uitzendkrachten en seizoenspieken om, en hoe regel je dat nu met een vaste lijn?',
    'Waar gaat het in deze branche het vaakst mis: maat, slijtage na de was, logo dat loslaat of de verkeerde norm?',
    'Welke bedrijven of typen bedrijven in Doetinchem, Terborg, Varsseveld en Groenlo vragen je om een passessie op locatie, en hoe verloopt dat in een dienstrooster?',
  ],
};
