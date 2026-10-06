import type { BrancheVerdieping } from './type';

export const verdieping: BrancheVerdieping | null = {
  slug: 'bouw-en-infra',
  bijgewerkt: '2026-10-06',
  regioIntro:
    'Bouw en infra in de Achterhoek is vooral een branche van familiebedrijven en kleine tot middelgrote aannemers, aangevuld met grondverzet, wegenbouw, installateurs en veel zzp’ers die op het werk van een hoofdaannemer meedraaien. Volgens het UWV zit ruim 6% van alle banen in de regio in de bouw, iets meer dan landelijk. Het UWV ziet een voorzichtig herstel, maar personeelstekort, stikstofregels, netcongestie en een gebrek aan bouwlocaties houden de groei tegen. Wie voor een hoofdaannemer of voor Rijkswaterstaat werkt, krijgt de kledingeis vaak mee van de opdrachtgever.',
  kerncijfers: [
    {
      waarde: 'ruim 6%',
      label: 'van alle banen in de Achterhoek zit in de bouw, iets meer dan landelijk',
      bron: 'UWV, Regionale arbeidsmarktprognose 2026-2028 Achterhoek',
      bronUrl: 'https://www.uwv.nl/assets-kai/files/4ae9dd0f-027f-469b-b8a8-ca30833b2cbb/achterhoek-regionale-arbeidsmarktprognose-2026-2028.pdf',
    },
    {
      waarde: '3,5 per persoon',
      label: 'vacatures per kortdurend werkzoekende in de Achterhoek, alle beroepen samen',
      bron: 'UWV, Regio in Beeld Achterhoek 2025',
      bronUrl: 'https://www.uwv.nl/nl/arbeidsmarktinformatie/regio/achterhoek/regio-in-beeld-2025',
    },
    {
      waarde: '80 per 1.000',
      label: 'openstaande vacatures per duizend werkenden in de bouw in Nederland, tweede kwartaal 2025, de hoogste van alle sectoren',
      bron: 'EIB, Trends op de bouwarbeidsmarkt 2025-2029',
      bronUrl: 'https://www.eib.nl/wp-content/uploads/2025/10/EIB-rapport-Trends-op-de-bouwarbeidsmarkt-2025-2029.pdf',
    },
    {
      waarde: '75.000',
      label: 'extra voltijdse arbeidskrachten nodig in de bouw in Nederland in 2026 tot en met 2029',
      bron: 'EIB, 75.000 voltijds arbeidskrachten nodig in de bouw',
      bronUrl: 'https://www.eib.nl/nieuws/75-000-voltijds-arbeidskrachten-nodig-in-de-bouw/',
    },
  ],
  functies: [
    {
      functie: 'Timmerman',
      werk: 'Bouwt kozijnen, vloeren, daken en afbouw, werkt veel op de knieën en bukt de hele dag.',
      kleding: 'Werkbroek met kniezakken en inschuifbare kniebeschermers, hamerlus, lange- en korte-mouwshirts, softshell, regenjas, veiligheidsschoenen.',
      normen: 'EN ISO 20345 (S3 op de bouwplaats), EN 14404 voor kniebeschermers, EN 343 voor regenkleding. Hi-vis volgens EN ISO 20471 alleen als het project dat eist.',
      sets: '2 tot 3 broeken, 4 shirts, 1 softshell, 1 regenjas, 1 paar schoenen',
      vakgebied: 'bouw-en-aannemers',
    },
    {
      functie: 'Metselaar en betonwerker',
      werk: 'Metselt, stort en strijkt beton, werkt buiten in weer en wind met nat en schurend materiaal.',
      kleding: 'Stevige werkbroek met slijtvaste knie- en zitvlakdelen, shirts met lange mouw, regenkleding, winterjas, veiligheidsschoenen of laarzen.',
      normen: 'EN ISO 20345 (S3, bij nat werk ook laarzen met S5), EN 343 voor regenkleding.',
      sets: '3 broeken, 4 shirts, 1 winterjas, 1 regenpak, 1 paar schoenen',
      vakgebied: 'bouw-en-aannemers',
    },
    {
      functie: 'Grondwerker en kraanmachinist',
      werk: 'Graaft, grondverzet en rijdt materieel, vaak naast of op een rijbaan of een bouwweg met passerend materieel.',
      kleding: 'Hi-vis werkbroek of werkbroek met hi-vis jack, hi-vis shirts, regenpak, bodywarmer of winterjas, S3-schoenen of laarzen.',
      normen: 'EN ISO 20471 klasse 2 of 3 afhankelijk van het project, EN ISO 20345 (S3 of S5), EN 343 voor regenkleding.',
      sets: '2 hi-vis broeken of jacks, 3 hi-vis shirts, 1 regenpak, 1 winterjas, 1 paar schoenen of laarzen',
    },
    {
      functie: 'Wegenbouwer en verkeersregelaar',
      werk: 'Legt asfalt en bestrating en werkt direct langs of op de weg, overdag en in het donker.',
      kleding: 'Signaalkleding in fluorescerend oranje-rood bij werk voor Rijkswaterstaat, hi-vis jas of pak, hi-vis shirts, regenpak, veiligheidsschoenen.',
      normen: 'EN ISO 20471 klasse 2 overdag en klasse 3 in het donker volgens de CROW-specificatie voor signaalkleding, EN ISO 20345 S3, EN 343.',
      sets: '2 hi-vis broeken of pakken, 1 hi-vis jas, 3 hi-vis shirts, 1 regenpak, 1 paar schoenen',
    },
    {
      functie: 'Uitvoerder en voorman',
      werk: 'Loopt over het werk, stuurt de ploeg aan, overlegt met opdrachtgever en moet op de bouwplaats herkenbaar zijn.',
      kleding: 'Polo’s en overhemden met logo, softshell of bodywarmer, werkbroek, hi-vis hesje of jas voor op het werk, veiligheidsschoenen die ook bij een gesprek niet storen.',
      normen: 'EN ISO 20345 (S1P of S3), hi-vis klasse 2 of 3 volgens EN ISO 20471 zodra het project dat vraagt.',
      sets: '2 broeken, 3 polo’s, 1 softshell, 1 hi-vis hesje of jas, 1 paar schoenen',
    },
    {
      functie: 'Installateur op de bouw',
      werk: 'Monteert leidingen, kanalen, kabels of apparatuur in een nieuwbouw- of renovatieproject, wisselend binnen en buiten.',
      kleding: 'Werkbroek met holsterzakken en gereedschapslussen, shirts, softshell, veiligheidsschoenen, hi-vis hesje voor de bouwplaats.',
      normen: 'EN ISO 20345 (S3), EN ISO 20471 alleen als het project dat vraagt. Kleding zelf heeft geen specifieke norm, tenzij het werk dat afdwingt.',
      sets: '2 tot 3 broeken, 4 shirts, 1 softshell, 1 hi-vis hesje, 1 paar schoenen',
      vakgebied: 'installatie-en-techniek',
    },
    {
      functie: 'Lasser en constructiebankwerker op de bouwplaats',
      werk: 'Last en slijpt staalconstructies, trappen en leuningen, met vonken en hitte om zich heen.',
      kleding: 'Vlamvertragend lasjack en lasbroek, lasschoenen of S3 met afgedekte veters, brandvertragend ondergoed, regenkleding die bij lassen mag.',
      normen: 'EN ISO 11611 voor lasserskleding, EN ISO 20345 (S3), bij kans op elektrostatische ontlading EN 1149-5.',
      sets: '2 lasjacks, 2 lasbroeken, 4 vlamvertragende shirts, 1 paar schoenen',
      vakgebied: 'metaal-en-industrie',
    },
  ],
  uitdagingen: [
    {
      titel: 'Elke opdrachtgever stelt zijn eigen eis',
      probleem: 'Het ene project vraagt klasse 2, het andere klasse 3, een derde alleen een hesje. Bij Rijkswaterstaat komt daar kleur en reflectie bij. Wie met één set voor alle projecten werkt, staat vroeg of laat op een bouwplaats met de verkeerde kleding.',
      aanpak: 'We vragen per project of per opdrachtgever de eis op en vertalen die naar een set per functie. Die leggen we vast in het kledingportaal, zodat iedere medewerker de goede klasse en kleur krijgt en je niet hoeft te onthouden wie wat draagt.',
    },
    {
      titel: 'Kniezakken en zitvlak slijten, hi-vis verbleekt',
      probleem: 'Op de bouw gaat een broek in een jaar door veel meer dan in een winkel. Bij hi-vis komt daar bij dat de fluorescerende kleur en de banden minder worden. Volgens de Arboportaal moet beschermende kleding na de opgegeven levensduur vervangen worden, en betaalt de werkgever dat.',
      aanpak: 'Met nabestellen in het portaal vervang je één broek of één jas zonder dat je een hele set opnieuw bestelt. Je geeft elke medewerker een budget, dus je ziet wat er is uitgegeven. We kiezen modellen met versterkte slijtplekken in plaats van goedkope broeken die na een half jaar op zijn.',
    },
    {
      titel: 'Wisselend personeel, uitzendkrachten en zzp’ers',
      probleem: 'In de bouw komen mensen binnen voor één project en gaan weer weg. Elke nieuwe kracht heeft maat, schoenmaat en logo nodig, en kleding die meegaat naar huis kost je geld.',
      aanpak: 'Maten en functie liggen per medewerker vast in het portaal. Een nieuwe kracht past bij ons op locatie en krijgt dezelfde set als zijn collega’s. Je ziet in het overzicht wie welke kleding heeft, ook als iemand vertrekt.',
    },
    {
      titel: 'Logo en reflectiestrepen komen elkaar in de weg',
      probleem: 'Op hi-vis hoort het logo niet over de reflecterende banden te komen en de minimale vlakken van de norm moeten intact blijven. Een logo dat verkeerd is geplaatst, kan een goed hesje afkeuren.',
      aanpak: 'We bepalen de plaats van het logo bij het ontwerp en laten je voor de productie een drukproef zien. Op de borst, rug of mouw, buiten de banden. Bedrukken en borduren doen we in eigen huis, dus de plaatsing blijft onder ons eigen oog.',
    },
    {
      titel: 'Regen, kou en hitte op één werkplek',
      probleem: 'Een timmerman of wegenbouwer werkt het hele jaar buiten. Zonder goede regenkleding en een warme laag gaat de ploeg in november met natte kleren aan het werk, en in de zomer is een zware broek te warm.',
      aanpak: 'We adviseren per seizoen: een lichtere zomerbroek, een softshell en bodywarmer voor de overgang, en regenkleding volgens EN 343 voor de natte maanden. Wie liever zelf een jas wil kiezen, doet dat bij ons op locatie met de kleding in de hand.',
    },
  ],
  veranderingen: [
    {
      titel: 'Rijkswaterstaat: signaalkleding in fluorescerend oranje-rood',
      tekst:
        'Volgens de CROW-specificatie voor signaalkleding van wegwerkers is de basiskleur fluorescerend oranje-rood. Nieuwe kleding moest sinds 1 januari 2021 die kleur hebben, andere kleuren waren toegestaan tot 1 januari 2026. Overdag is minimaal klasse 2 nodig, in het donker of bij beperkt zicht klasse 3. Vraag bij je opdrachtgever welke eis voor jouw project geldt en controleer of je oudere hesjes en jassen er nog aan voldoen.',
      bronUrl: 'https://kennisbank.crow.nl/public/gastgebruiker/WERKUIT/WIU_2020_%E2%80%93_Specificaties_voor_materiaal_en_materieel/Signaalkleding_wegwerkers/110752',
    },
    {
      titel: 'Nieuwe norm voor veiligheidsschoenen: EN ISO 20345:2022',
      tekst:
        'Nieuwe modellen moeten sinds 2022 voldoen aan EN ISO 20345:2022. Daarin staan nieuwe klassen (S6 en S7), een aparte aanduiding voor doorstapbescherming van metaal of textiel, een nieuwe waterbestendigheidstest en één antislip-aanduiding (SR). Tot eind 2027 liggen schoenen met zowel de oude als de nieuwe certificering in de winkel. Je oude schoenen hoeven niet weg zolang ze goed zijn.',
      bronUrl: 'https://www.wurth.nl/nl/wuerth_nl/onderneming/blog/productinformatie/2023_2/veiligheidsschoenen_blog.php',
    },
    {
      titel: 'Krapte op de bouwarbeidsmarkt blijft hoog',
      tekst:
        'Het EIB verwacht dat de bouw in 2026 tot en met 2029 ongeveer 75.000 extra voltijdse arbeidskrachten nodig heeft, waarvan ruim 50.000 uit het onderwijs kunnen komen. De vacaturegraad lag in het tweede kwartaal van 2025 op 80 per duizend werkenden. Voor een werkgever betekent dat concurreren om mensen, ook met de eerste indruk die je nieuwe collega krijgt.',
      bronUrl: 'https://www.eib.nl/wp-content/uploads/2025/10/EIB-rapport-Trends-op-de-bouwarbeidsmarkt-2025-2029.pdf',
    },
  ],
  kansen: [
    {
      titel: 'Onbelast verstrekken met een logo van minimaal 70 cm²',
      tekst:
        'Kleding die je medewerker ook buiten het werk kan dragen, moet volgens de Belastingdienst een beeldmerk van minimaal 70 cm² hebben. We controleren je logo op die maat en plaatsen het zo, dat de kleding herkenbaar blijft als bedrijfskleding. Overleg bij twijfel met je boekhouder.',
    },
    {
      titel: 'Een nieuwe collega die op dag één compleet is',
      tekst:
        'Met 3,5 vacatures per kortdurend werkzoekende in de regio kiest een kandidaat ook op wat hij ziet. Een werkgever die iemand in een goed zittende, nette set laat beginnen, geeft een andere eerste indruk dan een bedrijf waar iemand de eerste weken in zijn eigen kleren werkt.',
    },
    {
      titel: 'Kledingbeheer in het portaal in plaats van in een Excel',
      tekst:
        'Je zet per medewerker een budget, legt maten vast, laat nabestellingen goedkeuren en ziet wie wat heeft gekregen. Voor een planner of kantoormanager scheelt dat telefoontjes en briefjes op het kantoor.',
    },
    {
      titel: 'Herkenbaar op de bouwplaats en bij de klant',
      tekst:
        'Op een bouwplaats waar meerdere bedrijven werken, valt een ploeg met dezelfde kleur en hetzelfde logo op. Voor een uitvoerder of voorman is het ook praktisch: je ziet in één oogopslag wie bij jouw team hoort, en een particuliere klant ziet een bedrijf dat zijn zaken op orde heeft.',
    },
  ],
  extraFaq: [
    {
      q: 'Wie betaalt werkkleding en veiligheidsschoenen, werkgever of werknemer?',
      a: 'Persoonlijke beschermingsmiddelen betaalt de werkgever. Veiligheidsschoenen, hi-vis en kleding met een beschermende functie vallen daaronder. Volgens de Arboportaal krijgt de werknemer deze middelen zonder er zelf kosten voor te maken. Voor gewone werkbroeken zonder beschermende functie hangt het af van je cao of afspraken in het contract.',
    },
    {
      q: 'Wat is het verschil tussen hi-vis klasse 2 en klasse 3?',
      a: 'Klasse 3 heeft meer fluorescerend en reflecterend materiaal en bedekt ook de armen of benen. Klasse 2 is een hesje of broek met minder oppervlak. Volgens de CROW-specificatie voor wegwerkers is klasse 2 genoeg overdag en is klasse 3 nodig in het donker of bij beperkt zicht. Hoofdaannemers stellen soms een hogere klasse verplicht, dus vraag het vooraf.',
    },
    {
      q: 'Mag ik een logo op hi-vis laten drukken?',
      a: 'Ja, als de reflecterende banden vrij blijven en de minimale vlakken van de norm intact blijven. Het logo gaat dus op een plek buiten de banden, bijvoorbeeld op de borst of de rug in de vrije stof. Wij tonen je voor de productie een drukproef.',
    },
    {
      q: 'Wanneer moet ik hi-vis kleding vervangen?',
      a: 'Zodra de fluorescerende kleur zichtbaar verbleekt of de reflecterende banden slijten of loslaten. De fabrikant geeft een levensduur of aantal wasbeurten op. Volgens de Arboportaal moet beschermende kleding na die periode vervangen worden en komen de kosten voor de werkgever.',
    },
    {
      q: 'Moeten mijn oude veiligheidsschoenen weg door de nieuwe norm EN ISO 20345:2022?',
      a: 'Nee. De nieuwe norm geldt voor nieuwe modellen. Je oude schoenen mag je blijven gebruiken zolang ze goed zijn en binnen de levensduur van de fabrikant vallen. Tot eind 2027 zijn schoenen met beide certificeringen in de handel.',
    },
  ],
  bronnen: [
    { titel: 'UWV, Regionale arbeidsmarktprognose 2026-2028 Achterhoek', url: 'https://www.uwv.nl/assets-kai/files/4ae9dd0f-027f-469b-b8a8-ca30833b2cbb/achterhoek-regionale-arbeidsmarktprognose-2026-2028.pdf' },
    { titel: 'UWV, Regio in Beeld Achterhoek 2025', url: 'https://www.uwv.nl/nl/arbeidsmarktinformatie/regio/achterhoek/regio-in-beeld-2025' },
    { titel: 'EIB, Trends op de bouwarbeidsmarkt 2025-2029', url: 'https://www.eib.nl/wp-content/uploads/2025/10/EIB-rapport-Trends-op-de-bouwarbeidsmarkt-2025-2029.pdf' },
    { titel: 'EIB, 75.000 voltijds arbeidskrachten nodig in de bouw', url: 'https://www.eib.nl/nieuws/75-000-voltijds-arbeidskrachten-nodig-in-de-bouw/' },
    { titel: 'CROW, Signaalkleding wegwerkers (WIU 2020)', url: 'https://kennisbank.crow.nl/public/gastgebruiker/WERKUIT/WIU_2020_%E2%80%93_Specificaties_voor_materiaal_en_materieel/Signaalkleding_wegwerkers/110752' },
    { titel: 'Arboportaal, Beschikbaar stellen van persoonlijke beschermingsmiddelen', url: 'https://www.arboportaal.nl/onderwerpen/persoonlijke-beschermingsmiddelen/beschikbaar-stellen-van-persoonlijke-beschermingsmiddelen' },
    { titel: 'Arboportaal, Beschermende kleding', url: 'https://www.arboportaal.nl/onderwerpen/persoonlijke-beschermingsmiddelen/verschillende-soorten-persoonlijke-beschermingsmiddelen/beschermende-kleding' },
    { titel: 'Würth, De nieuwe norm EN ISO 20345:2022 voor veiligheidsschoenen', url: 'https://www.wurth.nl/nl/wuerth_nl/onderneming/blog/productinformatie/2023_2/veiligheidsschoenen_blog.php' },
    { titel: 'Belastingdienst, Werkkleding', url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/winst/inkomstenbelasting/inkomstenbelasting_voor_ondernemers/zakelijke_kosten/kosten-voor-werkkleding' },
  ],
  vragenVoorJessi: [
    'Welke hi-vis klasse en kleur vragen jouw bouwklanten het vaakst, en hoe vaak komt het voor dat een hoofdaannemer een kledingstuk afkeurt?',
    'Welke werkbroek en welke schoen adviseer je echt voor een timmerman, en welke voor een grondwerker?',
    'Waar gaat het mis bij een nieuwe medewerker of uitzendkracht: maten, schoenen, logo of tijd?',
    'Hoeveel sets geven bouwbedrijven hun mensen daadwerkelijk mee, en wat is de normale vervangtermijn van een broek en van hi-vis?',
    'Wat vragen klanten over bedrukken van hi-vis, en waar plaats je het logo zodat de banden vrij blijven?',
    'Welke vragen krijg je van bedrijven die voor Rijkswaterstaat of een grote hoofdaannemer werken, en wat wil je dat de pagina daarover zegt?',
  ],
};
