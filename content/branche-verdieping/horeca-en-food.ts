import type { BrancheVerdieping } from './type';

export const verdieping: BrancheVerdieping | null = {
  slug: 'horeca-en-food',
  bijgewerkt: '2026-10-06',
  regioIntro:
    'De Achterhoek is een regio waar mensen komen om te eten, te fietsen en te overnachten. Het onderzoek naar toerisme in de regio telt drie delen: horeca, verblijfsrecreatie (vakantieparken, campings, B&B’s, hotels) en dagrecreatie. Voor je kleding betekent dat dat je team in een restaurant, een zaal, een lunchroom of op een park werkt met heel verschillende eisen. In de keuken telt hygiëne en grip, in de bediening uitstraling, bij onderhoud en schoonmaak slijtvastheid. In de zomer en op drukke weekenden komt daar vaak tijdelijk personeel bij.',
  kerncijfers: [
    {
      waarde: '€ 428,2 mln',
      label: 'Toeristische bestedingen in de Achterhoek in 2024 (2022: € 362,4 mln)',
      bron: 'Monitor Toerisme Achterhoek 2024, Achterhoek Toerisme',
      bronUrl: 'https://achterhoektoerisme.nl/storage/files/Monitor_Toerisme_Achterhoek_Ginder_-_2024_FACTSHEET_ALGEMEEN_1.pdf',
    },
    {
      waarde: '4,3 mln',
      label: 'Overnachtingen in de Achterhoek in 2024, naast 16,4 mln dagbezoeken',
      bron: 'Monitor Toerisme Achterhoek 2024, Achterhoek Toerisme',
      bronUrl: 'https://achterhoektoerisme.nl/storage/files/Monitor_Toerisme_Achterhoek_Ginder_-_2024_FACTSHEET_ALGEMEEN_1.pdf',
    },
    {
      waarde: '4,2 banen',
      label: 'Per werkzoekende Achterhoeker, medio 2024 (Nederland: 4,0)',
      bron: 'Achterhoek Monitor 2024/25',
      bronUrl: 'https://www.achterhoekmonitor.nl/Achterhoek-Monitor-2024-25.pdf',
    },
    {
      waarde: 'Ruim 30%',
      label: 'Van de horecaondernemers in Nederland had in het tweede kwartaal van 2026 een personeelstekort',
      bron: 'CBS, via Ondernemersplein',
      bronUrl: 'https://ondernemersplein.overheid.nl/feiten-en-cijfers/factsheet-horeca/',
    },
  ],
  functies: [
    {
      functie: 'Kok en keukenmedewerker',
      werk: 'Bereidt gerechten in een warme keuken, vaak staand en in een tempo dat per dienst verschilt.',
      kleding:
        'Koksbuis van ademend katoen of een katoenmix, koksbroek, schort, keukenschoenen met antislipzool en eventueel een koksmuts of hoofddoek.',
      normen:
        'Geen specifieke norm voor de koksbuis. Hygiëne volgt uit je HACCP-plan of de Hygiënecode voor de Horeca. Schoenen volgens EN ISO 20347 (zonder neusbescherming) of EN ISO 20345 (met neusbescherming), met slipweerstand.',
      sets: '2 koksbroeken, 4 koksbuizen, 3 schorten',
      vakgebied: 'horeca-en-food',
    },
    {
      functie: 'Bediening en gastheer of gastvrouw',
      werk: 'Ontvangt gasten, neemt bestellingen op en loopt een dienst lang heen en weer tussen keuken en zaal.',
      kleding:
        'Overhemd of blouse, polo, schort of gilet, nette broek of rok en gesloten schoenen met antislipzool.',
      normen: 'Geen specifieke norm. Voor de schoenen is slipweerstand verstandig op natte en vette vloeren.',
      sets: '1 broek of rok, 3 overhemden of polo’s, 1 schort',
      vakgebied: 'horeca-en-food',
    },
    {
      functie: 'Barmedewerker',
      werk: 'Tapt, mixt en rekent af, staand achter de bar met veel contact met gasten.',
      kleding: 'Overhemd of polo met geborduurd logo, schort of lang barschort, strakke broek en antislipschoenen.',
      normen: 'Geen specifieke norm.',
      sets: '2 broeken, 3 overhemden of polo’s, 2 schorten',
      vakgebied: 'horeca-en-food',
    },
    {
      functie: 'Receptionist hotel of vakantiepark',
      werk: 'Is het eerste en laatste gezicht van de gast, regelt check-in en beantwoordt vragen over de omgeving.',
      kleding: 'Blouse of overhemd, blazer of vest, eventueel een stropdas of sjaal in de huiskleur. Geborduurd logo op borst of revers.',
      normen: 'Geen specifieke norm.',
      sets: '1 blazer of vest, 3 blouses of overhemden, 1 stropdas of sjaal',
      vakgebied: 'kantoor-en-receptie',
    },
    {
      functie: 'Housekeeping en schoonmaak',
      werk: 'Maakt kamers, huisjes en gemeenschappelijke ruimtes schoon, met veel tillen, bukken en schoonmaakmiddelen.',
      kleding: 'Tuniek of polo met rekbare stof, broek met zakken, schort en schoenen met antislipzool.',
      normen: 'Geen specifieke norm. Slipweerstand van de schoen is belangrijk op natte vloeren.',
      sets: '2 broeken, 3 tuniekjes of polo’s, 1 schort',
    },
    {
      functie: 'Technische dienst en terreinbeheer park',
      werk: 'Onderhoudt gebouwen, huisjes, speeltuinen en groen op het terrein, binnen en buiten, in elk weer.',
      kleding: 'Werkbroek, softshell of werkjas, regenjas, veiligheidsschoenen en eventueel een hesje.',
      normen:
        'EN ISO 20345 (S3 bij nat terrein of scherp materiaal, als je risico-inventarisatie dat aangeeft), EN 343 voor regenkleding, EN ISO 20471 bij werk langs de rijweg of in het donker.',
      sets: '2 werkbroeken, 3 shirts of polo’s, 1 softshell of jas, 1 regenjas',
      vakgebied: 'hoveniers-en-groenvoorziening',
    },
    {
      functie: 'Catering en evenementen',
      werk: 'Serveert op locatie, op feesten en vergaderingen, vaak met wisselende teams.',
      kleding: 'Zwarte of donkere broek, overhemd of polo met logo, schort, gesloten schoenen.',
      normen: 'Geen specifieke norm. Bereiding op locatie valt onder je HACCP-plan.',
      sets: '1 broek, 2 overhemden of polo’s, 1 schort',
      vakgebied: 'horeca-en-food',
    },
  ],
  uitdagingen: [
    {
      titel: 'Veel wasbeurten, kleding die snel slijt',
      probleem:
        'Keukenkleding en schorten gaan vaak en heet door de was. Stoffen die dun worden, kleuren die verbleken en logo’s die loslaten zien je gasten meteen.',
      aanpak:
        'We kiezen stoffen en modellen voor frequent wassen, borduren het logo waar dat kan en geven je in het advies mee hoeveel wisselsets er per medewerker nodig zijn. Nabestellen kan in dezelfde lijn.',
    },
    {
      titel: 'Hygiëne zonder gedoe',
      probleem:
        'In de keuken moet kleding schoon zijn en niet in de weg zitten. Je HACCP-plan of de Hygiënecode voor de Horeca bepaalt wat jij vastlegt, en je personeel moet zich eraan kunnen houden.',
      aanpak:
        'Je legt in je eigen plan vast hoe vaak er verschoond wordt. Wij zorgen dat er genoeg wissel is en dat modellen en stof dat dagelijks verschonen makkelijk maken. Dat stemmen we af met jouw werkwijze.',
    },
    {
      titel: 'Gladde vloeren in keuken en bediening',
      probleem:
        'Vet, water en natte vloeren zijn de dagelijkse praktijk. Schoenen zonder goede slipweerstand en met slechte demping merk je aan het eind van een lange dienst in je rug en benen.',
      aanpak:
        'We laten je schoenen passen op locatie, met antislipzool en demping voor lange diensten. Of ze onder EN ISO 20347 of EN ISO 20345 vallen, hangt af van je risico-inventarisatie.',
    },
    {
      titel: 'Seizoenskrachten en wisselend personeel',
      probleem:
        'In de zomer en op drukke weekenden komen er tijdelijke krachten bij. Wie vandaag begint, moet morgen in de juiste maat en uitstraling in de zaal staan.',
      aanpak:
        'In het kledingportaal staan maten per medewerker en een budget per persoon. Je medewerker kiest binnen dat budget, jij keurt goed en nabestellen blijft eenvoudig.',
    },
    {
      titel: 'Uitstraling die bij je zaak past',
      probleem:
        'Een grand-café, een lunchroom en een recreatiepark hebben elk een eigen stijl. Een standaardlijn past zelden bij alle drie.',
      aanpak:
        'We zoeken samen model, stof en kleur die bij jouw zaak passen. Via de drukproef zie je vooraf hoe het logo eruit komt te zien.',
    },
    {
      titel: 'Passen van een heel team op één moment',
      probleem:
        'Een team is nooit hetzelfde. Wie bij elke bestelling maten moet raden, krijgt retouren en een bijeenkomst die weer opnieuw moet.',
      aanpak:
        'We komen langs voor een passessie op locatie. Eén vast aanspreekpunt legt de maten vast, zodat die in het portaal staan voor volgende bestellingen.',
    },
  ],
  veranderingen: [
    {
      titel: 'Nieuwe uitgave van de normen voor werkschoenen',
      tekst:
        'EN ISO 20345:2022 (veiligheidsschoenen) en EN ISO 20347:2022 (werkschoenen zonder neusbescherming) zijn vernieuwd. De slipweerstand krijgt het symbool SR en de veiligheidsklassen zijn uitgebreid. Schoenen die volgens de oude uitgave zijn gekeurd, mogen volgens fabrikanten en adviseurs nog tot eind 2027 gebruikt worden. Bij een nieuwe bestelling kies je beter de nieuwe uitgave.',
      bronUrl: 'https://www.wurth.nl/nl/wuerth_nl/onderneming/blog/productinformatie/2023_2/veiligheidsschoenen_blog.php',
    },
    {
      titel: 'UPV Textiel geldt ook voor bedrijfskleding',
      tekst:
        'Sinds 1 juli 2023 geldt de uitgebreide producentenverantwoordelijkheid voor textiel, ook voor bedrijfskleding. Producenten moeten een oplopend deel van hun verkochte textiel voorbereiden op hergebruik of recycling: 50% in 2025 en 75% in 2030. De plicht ligt bij de producent. Kleding die lang meegaat en die je in dezelfde lijn kunt nabestellen past daarbij.',
      bronUrl: 'https://www.ilent.nl/onderwerpen/producentenverantwoordelijkheid/upv-textiel',
    },
    {
      titel: 'Krappe arbeidsmarkt in de horeca',
      tekst:
        'In het tweede kwartaal van 2026 waren er in Nederland 28.100 vacatures in de horeca en had ruim 30% van de ondernemers een personeelstekort. In de Achterhoek had een werkzoekende medio 2024 gemiddeld 4,2 banen om uit te kiezen.',
      bronUrl: 'https://ondernemersplein.overheid.nl/feiten-en-cijfers/factsheet-horeca/',
    },
  ],
  kansen: [
    {
      titel: 'Bedrijfskleding onbelast verstrekken',
      tekst:
        'Een logo van samen minimaal 70 cm² per kledingstuk, goed zichtbaar, maakt verstrekken onbelast mogelijk. Een geborduurd logo op borst en schort kan dat halen. Wij controleren dit voor je bestelt.',
    },
    {
      titel: 'Personeel werven en binden',
      tekst:
        'Als er 4,2 banen per werkzoekende zijn, telt elk detail van de werkplek. Een nieuwe kracht die op de eerste dag in goede, passende kleding staat, voelt zich welkom. Dat kost weinig en valt op.',
    },
    {
      titel: 'Kledingbeheer in het portaal',
      tekst:
        'Maten, budget per medewerker en goedkeuring staan in het gratis kledingportaal. Je hoeft niet bij elke nieuwe kracht te bellen of een lijst bij te houden.',
    },
    {
      titel: 'Uitstraling bij gasten',
      tekst:
        'Een team in één lijn, met een logo dat netjes en scherp blijft, laat zien dat de zaak op orde is. Met de drukproef zie je dat vooraf.',
    },
  ],
  extraFaq: [
    {
      q: 'Moet ik als horecaondernemer de werkkleding van mijn personeel betalen?',
      a: 'Dat hangt af van wat voor kleding het is. Persoonlijke beschermingsmiddelen, zoals veiligheidsschoenen die uit je risico-inventarisatie volgen, zijn voor rekening van de werkgever. Voor gewone horecakleding kijk je in je cao of arbeidsovereenkomst. Leg afspraken schriftelijk vast.',
    },
    {
      q: 'Zijn antislipschoenen verplicht in een restaurantkeuken?',
      a: 'Niet automatisch. Of je ze moet verstrekken, volgt uit je risico-inventarisatie en -evaluatie. Zie je gevaar voor uitglijden op vette of natte vloeren, dan zijn antislipschoenen een logische maatregel. Zijn ze nodig, dan verstrek je ze kosteloos.',
    },
    {
      q: 'Welke hygiëneregels gelden voor mijn horecakleding?',
      a: 'Je werkt met een HACCP-voedselveiligheidsplan. Gebruik je de goedgekeurde Hygiënecode voor de Horeca van KHN, dan voldoe je aan die wettelijke plicht, aldus de NVWA. Wat daarin over kleding staat, leg je vast in je eigen werkwijze. Wij leveren de kleding, jij bepaalt hoe vaak er wordt verschoond.',
    },
    {
      q: 'Kan ik horecakleding met logo onbelast verstrekken?',
      a: 'Ja, als het logo samen minimaal 70 cm² beslaat en per kledingstuk goed zichtbaar is. Dat geldt dus voor elk shirt, elke schort en elk jasje apart. Wij controleren je logo vooraf.',
    },
  ],
  bronnen: [
    {
      titel: 'Monitor Toerisme Achterhoek 2024, factsheet (Achterhoek Toerisme)',
      url: 'https://achterhoektoerisme.nl/storage/files/Monitor_Toerisme_Achterhoek_Ginder_-_2024_FACTSHEET_ALGEMEEN_1.pdf',
    },
    {
      titel: 'Vitaliteitsonderzoek horeca, verblijfs- en dagrecreatie Achterhoek (Achterhoek Toerisme)',
      url: 'https://achterhoektoerisme.nl/storage/files/5bce42fd7d49c5c991998ca981ac64cc.pdf',
    },
    {
      titel: 'Achterhoek Monitor 2024/25',
      url: 'https://www.achterhoekmonitor.nl/Achterhoek-Monitor-2024-25.pdf',
    },
    {
      titel: 'Factsheet horeca (CBS, via Ondernemersplein)',
      url: 'https://ondernemersplein.overheid.nl/feiten-en-cijfers/factsheet-horeca/',
    },
    {
      titel: 'Uitgebreide producentenverantwoordelijkheid textiel (ILT)',
      url: 'https://www.ilent.nl/onderwerpen/producentenverantwoordelijkheid/upv-textiel',
    },
    {
      titel: 'De nieuwe norm EN ISO 20345:2022 voor veiligheidsschoenen (Würth)',
      url: 'https://www.wurth.nl/nl/wuerth_nl/onderneming/blog/productinformatie/2023_2/veiligheidsschoenen_blog.php',
    },
    {
      titel: 'Safety shoes: new standards 2023 (Mensura)',
      url: 'https://www.mensura.be/en/expert-opinion/safety-shoes-new-standards-2023',
    },
    {
      titel: 'Voedselveiligheidsplan of hygiënecode voor horeca (NVWA)',
      url: 'https://www.nvwa.nl/onderwerpen/voedselveiligheid/voedselveilig-werken-in-horeca-ambacht-en-retail/hygienecode',
    },
    {
      titel: 'Wie is codehouder van de Hygiënecode (KHN)',
      url: 'https://www.khn.nl/veelgestelde-vragen/gezond-duurzaam/wie-is-codehouder-van-de-hygienecode',
    },
    {
      titel: 'Beschikbaar stellen van persoonlijke beschermingsmiddelen (Arboportaal)',
      url: 'https://www.arboportaal.nl/onderwerpen/persoonlijke-beschermingsmiddelen/beschikbaar-stellen-van-persoonlijke-beschermingsmiddelen',
    },
    {
      titel: 'Zijn werkschoenen verplicht in de horeca (Bowork)',
      url: 'https://www.bowork.nl/blog/post/zijn-werkschoenen-voor-in-de-horeca-verplicht',
    },
    {
      titel: 'Werkkleding onbelast (Jongbloed Fiscaal Juristen)',
      url: 'https://www.jongbloed-fiscaaljuristen.nl/tips_trucs/tips_bedrijven/werkkleding_onbelast/',
    },
  ],
  vragenVoorJessi: [
    'Welke sets adviseer je echt per functie in de horeca, en hoeveel wisselkleding hebben koks en bediening in de praktijk nodig?',
    'Wat vragen horecaklanten het vaakst bij een eerste gesprek: prijs, uitstraling, was of logo?',
    'Waar gaat het mis bij horeca-bestellingen, zoals maten, kleur die niet past of slijtage na maanden?',
    'Welke keukenschoenen en antislipschoenen passen klanten het vaakst, en welke merken bevallen goed?',
    'Hoe gaan klanten om met seizoenskrachten en tijdelijk personeel en kleding voor hen?',
    'Welke stoffen en kleuren houden het langst mooi na veel wasbeurten, en welke afraden je?',
  ],
};
