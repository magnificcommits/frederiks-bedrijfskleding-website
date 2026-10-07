import type { BrancheVerdieping } from './type';

export const verdieping: BrancheVerdieping | null = {
  slug: 'agrarisch-en-groen',
  bijgewerkt: '2026-10-06',
  regioIntro:
    'Agri in de Achterhoek is meer dan melkvee en maïs. Het agro-complex telt in de regio 16.435 werkzame personen en is daarmee het vierde cluster van de Achterhoek. Naast melkveehouders, varkenshouders en akkerbouwers werken hier loonbedrijven, hoveniers en groenvoorzieners, en bedrijven in afval en recycling. Hun werkdag verschilt, maar de kleding krijgt dezelfde klappen: nat, vuil, machines en lange dagen.',
  kerncijfers: [
    {
      waarde: '16.435',
      label: 'werkzame personen in het agro-complex van de Achterhoek, 2023 (vierde cluster van de regio)',
      bron: 'Achterhoek Monitor 2024/25',
      bronUrl: 'https://www.achterhoekmonitor.nl/Achterhoek-Monitor-2024-25.pdf',
    },
    {
      waarde: 'bijna 4x',
      label: 'zoveel vacatures als kortdurend werkzoekenden in de Achterhoek, eind tweede kwartaal 2025',
      bron: 'UWV, Regio in Beeld Achterhoek 2025-2026',
      bronUrl: 'https://www.uwv.nl/assets-kai/files/ae4165b2-f127-43cc-b692-7c4d7a440731/Regio_in_Beeld_2025-2026_Achterhoek.pdf',
    },
    {
      waarde: '21,1% minder',
      label: 'banen in de agrarische sector in de Achterhoek tussen 2007 en 2023',
      bron: 'Achterhoek Monitor 2024/25',
      bronUrl: 'https://www.achterhoekmonitor.nl/Achterhoek-Monitor-2024-25.pdf',
    },
    {
      waarde: '12.809',
      label: 'melkveebedrijven in Nederland, 2024 (in 2000 waren het er 23.280)',
      bron: 'Agrimatie, op basis van de CBS Landbouwtelling',
      bronUrl: 'https://agrimatie.nl/ThemaResultaat.aspx?subpubID=2232&themaID=2286&indicatorID=3049',
    },
  ],
  functies: [
    {
      functie: 'Melkveehouder en stalmedewerker',
      werk: 'Melken, voeren, strooien en het erf bijhouden, vaak in de stal en bij elk weer buiten.',
      kleding:
        'Overall of tuinbroek in een stevige stof, shirts of polo’s eronder, een gevoerde jas of bodywarmer voor de winter en een regenjas. Aan de voeten rubberen of kunststof laarzen.',
      normen:
        'Geen specifieke norm voor de kleding zelf. Veiligheidslaarzen met teenbescherming vallen onder EN ISO 20345, bijvoorbeeld S5 voor volledig rubberen of kunststof laarzen. Regenkleding kan EN 343 dragen.',
      sets: 'Advies: 2 overalls of tuinbroeken, 3 shirts, 1 bodywarmer, 1 gevoerde jas, 1 regenjas',
      vakgebied: 'agrarisch-en-loonwerk',
    },
    {
      functie: 'Varkenshouder en medewerker varkensstal',
      werk: 'Verzorgen en controleren van de dieren, schoonmaken van afdelingen en werken volgens de hygiëneregels van het bedrijf.',
      kleding:
        'Wasbare overall of broek met jas in een lichte kleur, zodat vuil zichtbaar is. Laarzen die je makkelijk schoonmaakt. Vaak een eigen set voor in de stal, die niet mee naar huis gaat.',
      normen:
        'Geen specifieke norm voor de kleding. Hygiëne- en bioveiligheidsregels komen van je bedrijf, je keten of je dierenarts. Laarzen met teenbescherming: EN ISO 20345.',
      sets: 'Advies: 3 overalls of sets, omdat stalkleding vaak dagelijks gewassen wordt, plus 1 jas voor buiten de stal',
      vakgebied: 'agrarisch-en-loonwerk',
    },
    {
      functie: 'Akkerbouwer en medewerker op het land',
      werk: 'Poten, zaaien, onderhouden en oogsten, daarnaast sleutelen in de werkplaats en sorteren in de loods.',
      kleding:
        'Stevige werkbroek of overall, regenjas of regenpak voor het natte voorjaar en najaar, een gevoerde jas voor de winter. Voor de werkplaats en de loods veiligheidsschoenen of -laarzen.',
      normen:
        'Geen specifieke norm voor de broek en overall. Regenkleding kan EN 343 dragen. Veiligheidsschoenen: EN ISO 20345, vaak S3 in de werkplaats.',
      sets: 'Advies: 2 broeken of overalls, 3 shirts, 1 jas, 1 regenjas of regenpak',
      vakgebied: 'agrarisch-en-loonwerk',
    },
    {
      functie: 'Loonwerker en machinist',
      werk: 'Maaien, kuilen, mesten en grondverzet voor andere bedrijven. Lange dagen op de trekker, soms op of langs de openbare weg.',
      kleding:
        'Werkbroek met veel zakken, shirts, een jas die ademt en een warme laag. Voor werk op of langs de weg, zoals bermen maaien, signaalkleding in fluorescerend oranje-rood.',
      normen:
        'Signaalkleding: EN ISO 20471. Voor wegwerk geldt volgens CROW overdag minimaal klasse 2 en in het donker klasse 3. Veiligheidsschoenen: EN ISO 20345.',
      sets: 'Advies: 3 werkbroeken, 4 shirts, 1 jas, 1 bodywarmer en 1 signaaljas of hesje als er langs de weg gewerkt wordt',
      vakgebied: 'agrarisch-en-loonwerk',
    },
    {
      functie: 'Hovenier en groenvoorziener',
      werk: 'Aanleggen en onderhouden van tuinen, parken en bermen. Snoeien, maaien, planten, bestraten.',
      kleding:
        'Werkbroek met kniezakken, shirts en polo’s met logo, een softshell of gevoerde jas, regenjas en veiligheidsschoenen. Langs de weg signaalkleding in fluorescerend oranje-rood.',
      normen:
        'Veiligheidsschoenen: EN ISO 20345. Signaalkleding: EN ISO 20471, klasse volgens CROW en je risico-inventarisatie. Verder geen specifieke norm voor de werkkleding.',
      sets: 'Advies: 3 werkbroeken, 4 shirts, 1 softshell of jas, 1 regenjas, 1 signaaljas voor werk langs de weg',
      vakgebied: 'hoveniers-en-groenvoorziening',
    },
    {
      functie: 'Boomverzorger en medewerker met kettingzaag',
      werk: 'Snoeien, vellen en opruimen van bomen, houtwallen en storm- of snoeihout met een kettingzaag.',
      kleding:
        'Zaagbroek of zaagoverall, zaagschoenen of -laarzen, een jas en onderkleding die goed zit onder de zaagbroek. Bovenlichaam, handschoenen en beenkappen bestaan als aparte onderdelen.',
      normen:
        'Kettingzaagkleding: EN ISO 11393, in delen. Beenbescherming staat in deel 2 (voorheen EN 381-5), jassen in deel 6. De klasse volgt uit de kettingsnelheid van de zaag.',
      sets: 'Advies: 1 zaagbroek per medewerker die zaagt, 3 werkshirts, 1 jas. Zaagbescherming valt onder persoonlijke beschermingsmiddelen en gaat dus op kosten van de werkgever',
      vakgebied: 'hoveniers-en-groenvoorziening',
    },
    {
      functie: 'Medewerker gewasbescherming (spuiter)',
      werk: 'Het uitbrengen van gewasbeschermingsmiddelen op het land of in de tuin, met een spuit achter de trekker of met een rugspuit.',
      kleding:
        'Spuitoverall of beschermende kleding, handschoenen en schoeisel zoals het etiket van het middel voorschrijft. Daaronder gewone werkkleding die je apart wast.',
      normen:
        'EN 13034 type 6 geeft beperkte bescherming tegen lichte nevel en spatten. Het is niet bedoeld voor druk, langdurig contact of onderdompeling. Wat je nodig hebt volgt uit het etiket en je risico-inventarisatie.',
      sets: 'Advies: de beschermende kleding koop je op basis van het etiket en de RI&E. We schrijven geen vaste set voor',
      vakgebied: 'agrarisch-en-loonwerk',
    },
    {
      functie: 'Medewerker afval en recycling',
      werk: 'Inzamelen, sorteren en verwerken van afval en grondstoffen, op het terrein, aan de weg of in de hal.',
      kleding:
        'Werkbroek of tuinbroek, shirts, een waterdichte jas en veiligheidsschoenen. Op het terrein en aan de weg signaalkleding, in de hal vaak een jas of vest met reflectie.',
      normen:
        'Signaalkleding: EN ISO 20471, klasse 2 of 3 afhankelijk van je risico-inventarisatie en het verkeer op het terrein. Veiligheidsschoenen: EN ISO 20345, vaak S3.',
      sets: 'Advies: 3 broeken, 4 shirts, 1 signaaljas, 1 regenjas',
    },
  ],
  uitdagingen: [
    {
      titel: 'Nat, modder en mest slijten kleding sneller dan je budget',
      probleem:
        'Een overall of broek die elke dag door de stal, het land en de wasmachine gaat, ziet er na een seizoen anders uit dan op dag één. Zakken scheuren, knieën slijten en kleuren verlopen.',
      aanpak:
        'We adviseren per functie een stevig model en een tweede set, zodat er altijd iets schoons klaarhangt. Als het model bevalt, bestel je dezelfde stukken na via het portaal.',
    },
    {
      titel: 'Wie betaalt wat: werkkleding of beschermingsmiddel',
      probleem:
        'Veiligheidsschoenen, een zaagbroek en signaalkleding voor wegwerk zijn persoonlijke beschermingsmiddelen. Die betaalt de werkgever. Gewone werkkleding is dat niet, en daar ontstaat discussie over.',
      aanpak:
        'We splitsen je bestelling in beschermingsmiddelen en gewone werkkleding. In het portaal stel je een budget per medewerker in, zodat iedereen weet waar hij aan toe is.',
    },
    {
      titel: 'Seizoenskrachten, stagiairs en wisselende maten',
      probleem:
        'In de oogst, bij het kuilen en in het snoeiseizoen komen er mensen bij die na een paar weken weer weg zijn. Je wilt ze snel kleden, in de juiste maat, zonder een kast vol losse maten.',
      aanpak:
        'We passen op locatie, op je erf of in je loods, zodat de maten kloppen. De maten per medewerker staan in het portaal, dus een nieuwe collega bestellen kost je geen uitzoekwerk.',
    },
    {
      titel: 'Werk langs de weg vraagt de juiste signaalkleding',
      probleem:
        'Bermen maaien, snoeien langs de weg of afval ophalen betekent werken in het verkeer. De eisen aan kleur, klasse en reflectie zijn de afgelopen jaren veranderd, en kleding die oud is voldoet niet altijd meer.',
      aanpak:
        'We controleren samen met jou of je signaalkleding bij je werk past, in de juiste klasse en kleur. Daarna bedrukken we je logo in eigen huis en leggen we de uitvoering vast voor nabestellen.',
    },
    {
      titel: 'Hygiëne in de stal en op het erf',
      probleem:
        'Op veel bedrijven mag stalkleding de stal niet uit, of juist niet in huis komen. Als alle sets er hetzelfde uitzien, raken ze door elkaar en weet niemand meer welke schoon is.',
      aanpak:
        'We adviseren een aparte kleur of een aparte logo-plek per afdeling of functie. Het logo bedrukken we in eigen huis, met een drukproef vooraf, zodat de sets herkenbaar blijven.',
    },
    {
      titel: 'Beschermende kleding slijt, ook als je het niet ziet',
      probleem:
        'Spuitkleding met EN 13034 beschermt dankzij een behandeling die door wassen verdwijnt. Beschadigde beschermende kleding vervang je, ook als het op het eerste gezicht meevalt.',
      aanpak:
        'We adviseren bij aanschaf over de onderhoudsinstructie van de fabrikant. Als het tijd is voor vervanging, bestel je dezelfde maat en hetzelfde model na via het portaal.',
    },
  ],
  veranderingen: [
    {
      titel: 'Signaalkleding bij wegwerk moet oranje-rood zijn',
      tekst:
        'Volgens CROW is nieuwe signaalkleding voor wegwerkers sinds 1 januari 2021 fluorescerend oranje-rood. Andere kleuren zijn sinds 1 januari 2026 niet meer toegestaan. De eisen gelden voor werk op of langs wegen die open zijn voor openbaar verkeer. Overdag is minimaal klasse 2 nodig, in het donker klasse 3.',
      bronUrl: 'https://kennisbank.crow.nl/public/gastgebruiker/WERKUIT/WIU_2020_%E2%80%93_Specificaties_voor_materiaal_en_materieel/Signaalkleding_wegwerkers/110752',
    },
    {
      titel: 'Veiligheidsschoenen krijgen een nieuwe norm',
      tekst:
        'EN ISO 20345:2022 vervangt de versie uit 2011. De S-klassen lopen nu van S1 tot en met S7 en de markering voor slipvastheid is aangepast. Volgens Safetyline geldt een overgangsperiode tot en met 2027 waarin schoenen volgens beide versies mogen worden verkocht en gebruikt. Controleer bij nieuwe aankoop welke versie op het label staat.',
      bronUrl: 'https://www.safetyline.nl/nieuwe_normering_voor_veiligheidsschoenen',
    },
    {
      titel: 'Kettingzaagkleding volgt EN ISO 11393 in plaats van EN 381',
      tekst:
        'De oude norm EN 381 is in 2020 vervangen door EN ISO 11393. De norm bestaat uit delen voor beenbescherming, handschoenen, beenkappen en jassen. Zoek bij nieuwe aanschaf dus naar EN ISO 11393 op het label, niet naar EN 381.',
      bronUrl: 'https://sip-protection.com/en/standards-certifications/en-iso-11393',
    },
    {
      titel: 'Textiel wordt producentenverantwoordelijkheid',
      tekst:
        'Sinds 1 juli 2023 geldt de uitgebreide producentenverantwoordelijkheid voor textiel, en die omvat ook bedrijfskleding. Producenten en importeurs moeten inzameling en recycling regelen en financieren. De doelen voor hergebruik en recycling liggen op 50% in 2025 en 75% in 2030. Als gebruiker van werkkleding hoef je hier zelf niets voor te regelen.',
      bronUrl: 'https://www.ilent.nl/onderwerpen/producentenverantwoordelijkheid/upv-textiel',
    },
  ],
  kansen: [
    {
      titel: 'Onbelast kleden met een logo van 70 cm²',
      tekst:
        'Werkkleding met een duidelijk logo van minimaal 70 cm² verstrek je onbelast. We checken je ontwerp vooraf op die regel, zodat het logo goed zichtbaar is en je geen belasting betaalt over de kleding.',
    },
    {
      titel: 'Personeel werven en houden in een krappe regio',
      tekst:
        'De Achterhoek had eind tweede kwartaal 2025 bijna vier keer zoveel vacatures als kortdurend werkzoekenden, en UWV noemt de arbeidsmarkt voor hoveniers, tuinders en kwekers zeer krap. Schone, passende kleding op dag één laat zien dat je het goed regelt. Het is een kleine zaak, maar mensen merken het.',
    },
    {
      titel: 'Kledingbeheer in het portaal in plaats van losse bonnetjes',
      tekst:
        'In ons gratis kledingportaal staat per medewerker het budget en de maat. Je laat nabestellen en goedkeuren, ook voor seizoenskrachten. Dat scheelt appjes en telefoontjes in het drukke seizoen.',
    },
    {
      titel: 'Herkenbaar op het erf, op de weg en bij de klant',
      tekst:
        'Een loonbedrijf, hovenier of recyclingbedrijf waarvan het team er in dezelfde kleding en met hetzelfde logo uitziet, valt op bij opdrachtgevers, gemeenten en omwonenden. Op de weg is het bovendien een veiligheidsvoordeel.',
    },
  ],
  extraFaq: [
    {
      q: 'Moet ik als werkgever veiligheidsschoenen en een zaagbroek voor mijn medewerkers betalen?',
      a: 'Ja. Persoonlijke beschermingsmiddelen stelt de werkgever beschikbaar en de kosten zijn voor de werkgever. Dat geldt voor veiligheidsschoenen, zaagbescherming, signaalkleding bij wegwerk en beschermende kleding, als je risico-inventarisatie ze vraagt. Gewone werkkleding valt daar niet onder.',
    },
    {
      q: 'Welke zaagbroek heb ik nodig voor snoeiwerk met een kettingzaag?',
      a: 'Een zaagbroek volgens EN ISO 11393-2, in een klasse die past bij de kettingsnelheid van je zaag. De klassen lopen van 16 m/s (klasse 0) tot 28 m/s (klasse 3). Type A beschermt de voorkant van de benen, type C beschermt rondom en is ook bedoeld voor wie af en toe zaagt.',
    },
    {
      q: 'Welke kleur en klasse signaalkleding heb ik nodig bij bermwerk?',
      a: 'Fluorescerend oranje-rood. Volgens CROW zijn andere kleuren voor wegwerk sinds 1 januari 2026 niet meer toegestaan. Overdag is minimaal klasse 2 nodig, bijvoorbeeld een hesje, en in het donker klasse 3, bijvoorbeeld een jas of pak. Je risico-inventarisatie kan een hogere eis stellen.',
    },
    {
      q: 'Beschermt een spuitoverall tegen gewasbeschermingsmiddelen?',
      a: 'Gedeeltelijk. Kleding met EN 13034 type 6 beschermt tegen lichte nevel en kleine spatten, niet tegen druk, langdurig contact of onderdompeling. De bescherming zit in een behandeling die door wassen verdwijnt, dus tel de wasbeurten mee. Wat je moet dragen, staat op het etiket van het middel en in je risico-inventarisatie.',
    },
  ],
  bronnen: [
    { titel: 'Achterhoek Monitor 2024/25', url: 'https://www.achterhoekmonitor.nl/Achterhoek-Monitor-2024-25.pdf' },
    { titel: 'UWV, Regio in Beeld Achterhoek 2025-2026', url: 'https://www.uwv.nl/assets-kai/files/ae4165b2-f127-43cc-b692-7c4d7a440731/Regio_in_Beeld_2025-2026_Achterhoek.pdf' },
    { titel: 'Agrimatie: Bedrijfsstructuur, verdere daling aantal bedrijven in 2024', url: 'https://agrimatie.nl/ThemaResultaat.aspx?subpubID=2232&themaID=2286&indicatorID=3049' },
    { titel: 'CROW Kennisbank: Signaalkleding wegwerkers (WIU 2020)', url: 'https://kennisbank.crow.nl/public/gastgebruiker/WERKUIT/WIU_2020_%E2%80%93_Specificaties_voor_materiaal_en_materieel/Signaalkleding_wegwerkers/110752' },
    { titel: 'Safetyline: nieuwe normering EN ISO 20345:2022', url: 'https://www.safetyline.nl/nieuwe_normering_voor_veiligheidsschoenen' },
    { titel: 'SIP Protection: EN ISO 11393', url: 'https://sip-protection.com/en/standards-certifications/en-iso-11393' },
    { titel: 'Kübler: EN 13034, bescherming tegen vloeibare chemicaliën', url: 'https://www.kuebler.eu/nl/dienst/beschermingsnormen/en-13034/' },
    { titel: 'Arboportaal: beschikbaar stellen van persoonlijke beschermingsmiddelen', url: 'https://www.arboportaal.nl/onderwerpen/persoonlijke-beschermingsmiddelen/beschikbaar-stellen-van-persoonlijke-beschermingsmiddelen' },
    { titel: 'ILT: Uitgebreide producentenverantwoordelijkheid textiel', url: 'https://www.ilent.nl/onderwerpen/producentenverantwoordelijkheid/upv-textiel' },
    { titel: 'Stichting UPV Textiel: regelgeving', url: 'https://www.stichtingupvtextiel.nl/regelgeving/' },
    { titel: 'Elis: signaalkleding en klassen EN ISO 20471', url: 'https://nl.elis.com/nl/oplossingen/bedrijfskleding/zichtbaarheidskleding' },
  ],
  vragenVoorJessi: [
    'Welke sets adviseer je in de praktijk voor een melkveehouder met een of twee medewerkers, en hoeveel overalls of broeken per persoon?',
    'Wat is het eerste dat bij agrarische klanten stuk gaat of slijt, en welke merken of modellen houden het het langst vol?',
    'Hoe vaak vragen klanten naar zaagbroeken, spuitkleding en signaalkleding, en weten ze zelf wat ze nodig hebben?',
    'Hoe regelen loonbedrijven en hoveniers kleding voor seizoenskrachten en stagiairs, en wat werkt het best?',
    'Komt het voor dat een klant stalkleding in een aparte kleur per afdeling vraagt, en hoe lossen jullie dat op?',
    'Welke vragen krijg je over de nieuwe kleur signaalkleding en de nieuwe schoennorm, en wat antwoord je?',
  ],
};
