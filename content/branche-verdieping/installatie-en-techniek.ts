import type { BrancheVerdieping } from './type';

export const verdieping: BrancheVerdieping | null = {
  slug: 'installatie-en-techniek',
  bijgewerkt: '2026-10-07',
  regioIntro:
    'In de Achterhoek is installatietechniek vooral werk van kleine en middelgrote installateurs, elektrotechnische bedrijven en eenmanszaken die van Lochem tot Winterswijk met een bus vol materiaal de weg op gaan. Daar komen warmtepomp- en zonnepaneelmonteurs bij, servicemonteurs die bij mensen thuis een ketel onderhouden, en garages en autobedrijven met een eigen werkplaats. Volgens het UWV is de arbeidsmarkt voor technische beroepen in de Achterhoek nog krapper dan gemiddeld, en automonteurs horen bij de beroepen waar het tekort het grootst is. Een monteur die vandaag een meterkast in Vorden doet, staat morgen op een dak in Groenlo en zit overmorgen bij een klant in Ruurlo aan de keukentafel.',
  kerncijfers: [
    {
      waarde: '29.400',
      label: 'openstaande vacatures in de technische installatiebranche in Nederland, medio 2025',
      bron: 'Wij Techniek, Uitkomsten bedrijvenenquête 2025 (KBA Nijmegen)',
      bronUrl: 'https://trendfiles.wij-techniek.nl/wp-content/uploads/Uitkomsten-bedrijvenenquete-Wij-Techniek-2025.pdf',
    },
    {
      waarde: '46%',
      label: 'van de installatiebedrijven heeft een of meer moeilijk vervulbare vacatures voor zelfstandig monteurs',
      bron: 'Wij Techniek, Uitkomsten bedrijvenenquête 2025 (KBA Nijmegen)',
      bronUrl: 'https://trendfiles.wij-techniek.nl/wp-content/uploads/Uitkomsten-bedrijvenenquete-Wij-Techniek-2025.pdf',
    },
    {
      waarde: '736.000',
      label: 'warmtepompen in Nederland volgens een schatting op basis van verkoopcijfers, waarvan 125.000 verkocht in 2024',
      bron: 'CBS, Monitor Warmtepompen 2025',
      bronUrl: 'https://www.cbs.nl/nl-nl/longread/aanvullende-statistische-diensten/2025/monitor-warmtepompen-2025/4-totaalbeeld',
    },
    {
      waarde: '28,6 GWp',
      label: 'opgesteld vermogen aan zonnepanelen in Nederland eind 2024, bijna 60% daarvan bij bedrijven',
      bron: 'CBS, Grootste deel zonnepanelen ligt bij bedrijven (augustus 2025)',
      bronUrl: 'https://www.cbs.nl/nl-nl/nieuws/2025/32/grootste-deel-zonnepanelen-ligt-bij-bedrijven',
    },
  ],
  functies: [
    {
      functie: 'Installatiemonteur werktuigbouw (W)',
      werk: 'Legt leidingwerk aan, monteert cv-ketels, warmtepompen en sanitair, en ligt daarvoor geregeld in een kruipruimte of op een zolder.',
      kleding: 'Werkbroek met kniezakken en holsterzakken, zoals de Snickers AllroundWork of FlexiWork, shirts of polo’s met logo, sweater of softshell, bodywarmer voor onverwarmde ruimtes, veiligheidsschoenen.',
      normen: 'EN 14404 voor kniebeschermers, EN ISO 20345 (S3 op de bouw, S1P of S3 bij servicewerk). Voor de kleding zelf geldt geen specifieke norm.',
      sets: '2 tot 3 broeken, 4 shirts of polo’s, 1 sweater of softshell, 1 bodywarmer, 1 paar schoenen',
      vakgebied: 'elektro-en-servicetechniek',
    },
    {
      functie: 'Elektromonteur',
      werk: 'Werkt aan meterkasten, groepenkasten en verdeelinrichtingen in woningen en bedrijfspanden, soms in de buurt van delen die onder spanning staan.',
      kleding: 'Multinorm werkbroek en jack met vlamboogbescherming, zoals Fristads Flamestat of Hydrowear multinorm, vlamvertragend shirt of FR-polo als onderlaag, veiligheidsschoenen zonder metaal.',
      normen: 'IEC 61482-2 (klasse 1 of 2, volgens de risicobeoordeling), EN ISO 11612, EN 1149-5, EN ISO 20345. Het werk zelf valt onder NEN 3140.',
      sets: '2 multinorm broeken, 1 multinorm jack, 3 tot 4 vlamvertragende shirts of polo’s, 1 paar schoenen',
      vakgebied: 'elektro-en-servicetechniek',
    },
    {
      functie: 'Servicemonteur aan huis',
      werk: 'Onderhoudt ketels en warmtepompen, lost storingen op en legt de klant in de woonkamer uit wat er mis was.',
      kleding: 'Servicebroek of chino met verborgen kniezakken, zoals de Snickers Service-lijn, geborduurde polo’s, vest of softshell met logo, lage veiligheidsschoen die er net uitziet.',
      normen: 'EN ISO 20345 (S1P of S3), EN 14404 als je knielt met kniebeschermers. Verder geen specifieke norm.',
      sets: '2 servicebroeken, 3 polo’s, 1 sweater, 1 softshell, 1 paar schoenen',
      vakgebied: 'elektro-en-servicetechniek',
    },
    {
      functie: 'Zonnepaneel- en warmtepompmonteur',
      werk: 'Legt panelen op daken, plaatst buitenunits en omvormers en sluit thuisbatterijen aan, het hele jaar door en meestal buiten.',
      kleding: 'Stretchbroek met kniezakken, shirts met lange mouw tegen de zon, softshell, regenjas, veiligheidsschoenen met antislipzool.',
      normen: 'EN ISO 20345 (S3 met SR-antislip), EN 14404, EN 343 voor de regenjas. Valbeveiliging is een apart PBM en valt buiten de kleding.',
      sets: '2 tot 3 broeken, 4 shirts, 1 softshell, 1 regenjas, 1 paar schoenen',
      vakgebied: 'elektro-en-servicetechniek',
    },
    {
      functie: 'Koel- en klimaattechnicus',
      werk: 'Installeert en onderhoudt airco’s, koelinstallaties en ventilatiesystemen, in technische ruimtes, op platte daken en bij klanten op kantoor.',
      kleding: 'Werkbroek met holsterzakken, polo’s of shirts, bodywarmer of softshell, regenjas voor het dakwerk, veiligheidsschoenen.',
      normen: 'EN ISO 20345 (S3), EN 343 voor regenkleding. Bij werk aan installaties onder spanning gelden dezelfde regels als bij elektrotechniek.',
      sets: '2 broeken, 4 polo’s of shirts, 1 bodywarmer, 1 regenjas, 1 paar schoenen',
      vakgebied: 'elektro-en-servicetechniek',
    },
    {
      functie: 'Paneelbouwer en monteur elektronica',
      werk: 'Bouwt besturingskasten en werkt aan printplaten en regelapparatuur, waar een statische ontlading een onderdeel kan beschadigen.',
      kleding: 'Werkbroek en polo of shirt, ESD-schoenen zoals de Upower-modellen, bij een ESD-werkplek ook antistatische of ESD-kleding.',
      normen: 'EN 61340-5-1 voor de ESD-werkplek en het schoeisel, EN 1149-5 voor antistatische kleding, EN ISO 20345 als het ook een veiligheidsschoen moet zijn.',
      sets: '2 broeken, 4 polo’s, 1 sweater, 1 paar ESD-schoenen',
      vakgebied: 'metaal-en-industrie',
    },
    {
      functie: 'Automonteur en werkplaatsmedewerker',
      werk: 'Doet onderhoud, reparatie en APK in de werkplaats, ligt onder de auto en werkt met olie, koelvloeistof en remreiniger.',
      kleding: 'Overall of werkbroek met kniezakken, shirts of polo’s, softshell of bodywarmer, veiligheidsschoenen met olie- en antislipbestendige zool. Voor de balie een nette polo met logo.',
      normen: 'EN ISO 20345 (S1P of S3, SR-antislip). Voor de werkplaatskleding geen specifieke norm. Bij werk aan hoogvoltagesystemen van elektrische auto’s bepaalt de risicobeoordeling welke bescherming nodig is.',
      sets: '2 overalls of 3 broeken, 4 shirts of polo’s, 1 softshell, 1 paar schoenen',
      vakgebied: 'automotive-en-garage',
    },
  ],
  uitdagingen: [
    {
      titel: 'Netjes bij de klant en toch op je knieën in de kruipruimte',
      probleem: 'Een servicemonteur komt bij mensen thuis. Een broek met grote kniezakken en vlekken van gisteren geeft een andere indruk dan een monteur die er verzorgd uitziet. Tegelijk moet hij een uur later in een kruipruimte kunnen liggen zonder dat zijn knieën het voelen.',
      aanpak: 'We combineren een servicebroek of chino met verborgen kniezakken met een geborduurde polo en een vest met logo. Op locatie pas je de broek met kniebeschermers erin, zodat je weet dat de zak op de goede hoogte zit.',
    },
    {
      titel: 'Vlamboogkleding werkt alleen als de hele laag klopt',
      probleem: 'Bij een vlamboog bepaalt de zwakste laag hoe het afloopt. Een multinorm jack over een polyester shirt of een gewone fleece geeft schijnveiligheid, want die onderlaag kan smelten. Welke klasse nodig is, volgt uit de beveiliging voor de installatie, en dat weet de werkverantwoordelijke beter dan wij.',
      aanpak: 'We vragen eerst naar je risicobeoordeling en de klasse die daaruit volgt. Daarna stellen we een complete set samen, van onderlaag tot jack, uit de Fristads- en Hydrowear-lijnen die we voeren. In het kledingportaal leggen we vast wie welke set draagt, zodat een nieuwe monteur niet per ongeluk in gewone kleding aan een kast begint.',
    },
    {
      titel: 'Antistatisch is nog geen ESD',
      probleem: 'Een antistatische veiligheidsschoen mag volgens EN ISO 20345 een weerstand tot 1 gigaohm hebben. Voor een ESD-werkplek volgens EN 61340-5-1 ligt de grens op 100 megaohm. Wie op een ESD-vloer met de verkeerde schoen werkt, beschermt de elektronica niet.',
      aanpak: 'We vragen of je werkplek of die van je opdrachtgever een ESD-zone heeft. Is dat zo, dan adviseren we een schoen met ESD-markering. We voeren 19 ESD-modellen van Upower, van lage sneaker tot hoge S3.',
    },
    {
      titel: 'Veel nieuwe monteurs, steeds andere maten',
      probleem: 'Door de energietransitie nemen installateurs mensen aan zodra ze ze vinden: leerlingen, zij-instromers en monteurs van uitzendbureaus. Iedereen heeft een eigen maat en schoenmaat nodig, en de bus moet de volgende dag rijden.',
      aanpak: 'We komen langs en laten de nieuwe monteur passen. Maat en functie leggen we vast in het portaal. Daarna bestel je zijn starterpakket in een paar klikken, en een nabestelling gaat via het budget dat je per monteur instelt.',
    },
    {
      titel: 'Een logo op multinorm is geen gewone bedrukking',
      probleem: 'Op vlamvertragende en antistatische kleding mag je niet zomaar een transfer of borduursel zetten. Verkeerd materiaal kan branden of de afvoer van statische lading verstoren, en dan klopt de certificering niet meer.',
      aanpak: 'We gebruiken voor deze kleding materiaal dat daarvoor geschikt is en plaatsen het logo alleen op de plekken die de fabrikant vrijgeeft. Bedrukken en borduren doen we in eigen huis in Hengelo, dus we weten wat er op jouw kleding zit. Voor de productie zie je een drukproef.',
    },
  ],
  veranderingen: [
    {
      titel: 'NEN 3140 wordt herzien',
      tekst:
        'NEN 3140 regelt de bedrijfsvoering van elektrische installaties en is gebaseerd op EN 50110. Er ligt een conceptversie, de definitieve norm wordt verwacht in 2026 of 2027. In het concept staat dat er voor elk werk een risicobeoordeling moet zijn, dat een persoonlijk slot tegen herinschakelen verplicht wordt en dat een kast met metalen afscherming waar contact- of vlamboogrisico kan bestaan, spanningsvrij en vergrendeld moet zijn. De tabel waarmee je de vlamboogbescherming bepaalt aan de hand van de voorliggende beveiliging, blijft inhoudelijk gelijk. Controleer bij de definitieve versie of je kledingset nog past bij je werkinstructies.',
      bronUrl: 'https://www.euronorm.net/en/pages/wijzigingen-nen-3140-2026',
    },
    {
      titel: 'Warmtepompen en zonnepanelen veranderen het werk',
      tekst:
        'Volgens het CBS staan er naar schatting 736.000 warmtepompen in Nederland en leverden leveranciers er in 2022 tot en met 2024 samen 431.000. Het opgestelde vermogen aan zonnepanelen kwam eind 2024 uit op 28,6 gigawattpiek. Voor monteurs betekent dat meer werk op daken en bij buitenunits, en meer werk in meterkasten bij mensen thuis. Kleding moet daardoor zowel tegen weer en wind kunnen als representatief zijn.',
      bronUrl: 'https://www.cbs.nl/nl-nl/longread/aanvullende-statistische-diensten/2025/monitor-warmtepompen-2025/4-totaalbeeld',
    },
    {
      titel: 'De krapte op de arbeidsmarkt blijft',
      tekst:
        'Volgens de prognose van KBA Nijmegen voor de installatiebranche verlaten elk jaar ongeveer 23.000 mensen de branche. Blijft de instroom steken op 20.000 per jaar, dan loopt het tekort op tot ongeveer 15.000 werknemers in 2029. Wie goede monteurs wil houden en vinden, concurreert op meer dan loon alleen.',
      bronUrl: 'https://www.technieknederland.nl/media/mpengwwh/prognose-van-de-werkgelegenheid-in-de-technische-installatiebranche-tot-2030-1.pdf',
    },
  ],
  kansen: [
    {
      titel: 'Herkenbaar aan de deur',
      tekst:
        'Een klant laat een monteur binnen die hij niet kent. Een polo en vest met een duidelijk logo, en een bus in dezelfde stijl, geven vertrouwen voordat je iets gezegd hebt. Dat is voor een installateur in Aalten of Zutphen net zo belangrijk als het vakwerk zelf.',
    },
    {
      titel: 'Een starterpakket per functie',
      tekst:
        'Je legt per functie vast wat een monteur krijgt, bijvoorbeeld 2 servicebroeken met kniezakken, 3 polo’s, 1 sweater, 1 softshell en 1 paar ESD-schoenen. Een nieuwe collega is dan op dag één compleet, en je hoeft niet elke keer opnieuw te bedenken wat hij nodig heeft.',
    },
    {
      titel: 'Kledingbeheer per monteur',
      tekst:
        'In het klantportaal zet je per monteur een budget, leg je maten vast en keur je nabestellingen goed. Je ziet wie welke multinormset heeft en wanneer die is uitgegeven. Dat scheelt de planner telefoontjes en geeft je een overzicht als de Arbeidsinspectie of een opdrachtgever vraagt welke bescherming je mensen dragen.',
    },
    {
      titel: 'Werkkleding die als werkkleding telt',
      tekst:
        'Kleding die je ook buiten het werk kunt dragen, telt voor de Belastingdienst als werkkleding als er een logo van minimaal 70 cm² op staat. Kleding die verplicht is volgens de Arbowet en die je kosteloos verstrekt, telt ook mee. We controleren de maat van je logo bij het ontwerp. Overleg over de fiscale kant met je boekhouder.',
    },
  ],
  extraFaq: [
    {
      q: 'Wat is het verschil tussen vlamboogklasse 1 en klasse 2?',
      a: 'Bij de boxtest volgens IEC 61482-1-2 wordt klasse 1 getest bij een stroom van 4 kA en klasse 2 bij 7 kA. Klasse 2 beschermt dus tegen een zwaardere vlamboog. Welke klasse je monteurs nodig hebben, volgt uit de risicobeoordeling en de beveiliging voor de installatie waar ze aan werken.',
    },
    {
      q: 'Is een antistatische veiligheidsschoen hetzelfde als een ESD-schoen?',
      a: 'Nee. Een antistatische schoen volgens EN ISO 20345 mag een weerstand hebben van 100 kilo-ohm tot 1 gigaohm. Een ESD-schoen volgens EN 61340-5-1 moet onder de 100 megaohm blijven. Een ESD-schoen is dus altijd antistatisch, maar een antistatische schoen is niet altijd geschikt voor een ESD-werkplek.',
    },
    {
      q: 'Wie betaalt de vlamboogkleding en veiligheidsschoenen van mijn monteurs?',
      a: 'De werkgever. Volgens de Arboportaal stel je persoonlijke beschermingsmiddelen beschikbaar als het werk dat vraagt, en de werknemer maakt er zelf geen kosten voor. Vlamboogkleding, antistatische kleding en veiligheidsschoenen vallen daaronder. Voor een gewone werkbroek of polo hangt het af van je cao of je afspraken.',
    },
    {
      q: 'Hebben jullie kleding voor een servicemonteur die vooral bij mensen thuis komt?',
      a: 'Ja. De Snickers Service-lijn heeft broeken en chino’s met kniezakken die je van buiten bijna niet ziet, plus vesten en jassen in dezelfde stijl. Met een geborduurde polo erbij ziet je monteur er verzorgd uit en kan hij toch knielen. Je past het bij ons op locatie.',
    },
  ],
  bronnen: [
    { titel: 'Wij Techniek, Uitkomsten bedrijvenenquête 2025', url: 'https://trendfiles.wij-techniek.nl/wp-content/uploads/Uitkomsten-bedrijvenenquete-Wij-Techniek-2025.pdf' },
    { titel: 'Techniek Nederland en KBA Nijmegen, Prognose werkgelegenheid in de technische installatiebranche 2025-2029', url: 'https://www.technieknederland.nl/media/mpengwwh/prognose-van-de-werkgelegenheid-in-de-technische-installatiebranche-tot-2030-1.pdf' },
    { titel: 'UWV, Regio in Beeld Achterhoek 2025-2026', url: 'https://www.uwv.nl/assets-kai/files/ae4165b2-f127-43cc-b692-7c4d7a440731/Regio_in_Beeld_2025-2026_Achterhoek.pdf' },
    { titel: 'CBS, Monitor Warmtepompen 2025', url: 'https://www.cbs.nl/nl-nl/longread/aanvullende-statistische-diensten/2025/monitor-warmtepompen-2025/4-totaalbeeld' },
    { titel: 'CBS, Grootste deel zonnepanelen ligt bij bedrijven', url: 'https://www.cbs.nl/nl-nl/nieuws/2025/32/grootste-deel-zonnepanelen-ligt-bij-bedrijven' },
    { titel: 'Techniek Nederland, NEN 3140: doel en noodzaak', url: 'https://www.technieknederland.nl/media/etumyeiv/doel-en-noodzaak.pdf' },
    { titel: 'Euronorm, Wijzigingen NEN 3140 (concept)', url: 'https://www.euronorm.net/en/pages/wijzigingen-nen-3140-2026' },
    { titel: 'Imagewear, EN 61482-2:2020 bescherming tegen de thermische effecten van een vlamboog', url: 'https://www.imagewear.fi/en/pages/en-61482-2-2020-suojaus-valokaaren-termisilta-vaikutuksilta' },
    { titel: 'Wolters Kluwer, Hoe kies je de meest geschikte vlamboogkleding', url: 'https://www.wolterskluwer.com/nl-be/expert-insights/how-to-choose-the-most-suitable-electric-arc-clothing' },
    { titel: 'uvex, Het verschil tussen antistatisch en ESD', url: 'https://www.uvex-safety.com/blog/the-difference-between-antistatic-and-esd-a-safety-footwear-example/' },
    { titel: 'Arboportaal, Beschikbaar stellen van persoonlijke beschermingsmiddelen', url: 'https://www.arboportaal.nl/onderwerpen/persoonlijke-beschermingsmiddelen/beschikbaar-stellen-van-persoonlijke-beschermingsmiddelen' },
    { titel: 'Belastingdienst, Kosten voor werkkleding', url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/winst/inkomstenbelasting/inkomstenbelasting_voor_ondernemers/zakelijke_kosten/kosten-voor-werkkleding' },
    { titel: 'SRA, Wat is werkkleding, de Belastingdienst vult aan (februari 2026)', url: 'https://www.sra.nl/nieuws/004501/2026/02/wat-is-werkkleding-de-belastingdienst-vult-aan' },
  ],
  vragenVoorJessi: [
    'Welke installateurs, elektrotechnische bedrijven en garages bedien je nu al, en welke vraag stellen ze het vaakst als ze voor het eerst bij je komen?',
    'Vragen elektrotechnische klanten zelf naar een vlamboogklasse, of moet je ze daar meestal op wijzen? Welke klasse en welk merk lever je het meest?',
    'Wil je ESD-schoenen van Upower op voorraad houden in de gangbare maten, of bestel je ze per klant? En is er al een klant die om ESD-kleding vraagt?',
    'Welke broek adviseer je echt voor een servicemonteur die bij mensen thuis komt, en welke voor een monteur die vooral in kruipruimtes en op daken werkt?',
    'Hoeveel sets geven installateurs hun monteurs mee, en hoe snel slijt een broek bij hen vergeleken met de bouw?',
    'Bedruk of borduur je multinormkleding zelf, en welke techniek en plekken gebruik je daarvoor?',
  ],
};
