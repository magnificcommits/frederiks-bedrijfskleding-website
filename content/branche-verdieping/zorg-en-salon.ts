import type { BrancheVerdieping } from './type';

export const verdieping: BrancheVerdieping | null = {
  slug: 'zorg-en-salon',
  bijgewerkt: '2026-10-06',
  regioIntro:
    'Zorg en welzijn is in de Achterhoek een van de drie grootste werkgevers. Het gaat om thuiszorgteams en verpleeghuizen, instellingen voor gehandicaptenzorg, fysio- en tandartspraktijken en een groot aantal kleine zelfstandigen: kappers, schoonheidsspecialisten en pedicures in elk dorp. De kleding verschilt per tak. In de zorg draait het om hygiëne en wasbaarheid, in de salon om uitstraling en comfort. Beide hebben baat bij één vast aanspreekpunt, omdat teams vaak klein zijn en personeel wisselt.',
  kerncijfers: [
    {
      waarde: '28.080',
      label: 'werkzame personen in gezondheids- en welzijnszorg in de Achterhoek (2023), 18,4% van alle werk',
      bron: 'Achterhoek Monitor 2024/25, p. 29',
      bronUrl: 'https://www.achterhoekmonitor.nl/Achterhoek-Monitor-2024-25.pdf',
    },
    {
      waarde: '26.400',
      label: 'werknemersbanen in zorg en welzijn in de Achterhoek (2025), ongeveer 19% van alle banen',
      bron: 'UWV, Regio in Beeld Achterhoek 2024-2025',
      bronUrl: 'https://www.uwv.nl/assets-kai/files/1f835c23-7233-4ed3-a3e9-9c1991a5718d/Regio_in_Beeld_2024-2025_Achterhoek.pdf',
    },
    {
      waarde: '230.000',
      label: 'verwacht tekort aan personeel in zorg en welzijn in 2033, in Nederland',
      bron: 'UWV, Regio in Beeld Achterhoek 2024-2025',
      bronUrl: 'https://www.uwv.nl/assets-kai/files/1f835c23-7233-4ed3-a3e9-9c1991a5718d/Regio_in_Beeld_2024-2025_Achterhoek.pdf',
    },
    {
      waarde: '60 °C',
      label: 'minimale wastemperatuur voor werkkleding in de zorg, tenzij 40 tot 60 °C met strijken of machinaal drogen (in Nederland)',
      bron: 'Richtlijn Handhygiëne en persoonlijke hygiëne medewerker, SRI',
      bronUrl: 'https://richtlijnendatabase.nl/richtlijn/handhygi_ne_persoonlijke_hygi_ne_medewerker/persoonlijke_hygi_ne_kleding_en_gezicht/kleding.html',
    },
  ],
  functies: [
    {
      functie: 'Thuiszorgmedewerker en wijkverpleegkundige',
      werk: 'Bezoekt cliënten thuis voor verzorging en verpleging, rijdt van adres naar adres en werkt in alle weersomstandigheden.',
      kleding: 'Polo of tuniek met korte mouwen, broek met rek, vest of softshell voor buiten, gesloten werkschoenen.',
      normen: 'Geen productnorm. De richtlijn Basishygiëne Wijkverpleging vraagt onbedekte onderarmen en dagelijks schoon gewassen kleding.',
      sets: '4 tot 5 shirts of tuniek (dagelijks schoon), 2 broeken, 1 softshell of jas',
      vakgebied: 'zorg-en-welzijn',
    },
    {
      functie: 'Verzorgende en helpende in het verpleeghuis',
      werk: 'Helpt bewoners met wassen, aankleden en eten, tilt en bukt de hele dag en wisselt tussen kamers en gemeenschappelijke ruimtes.',
      kleding: 'Tuniek of polo met korte mouwen, rekbare broek, gesloten schoenen die schoon te maken zijn.',
      normen: 'Geen productnorm. Wel de SRI-richtlijn persoonlijke hygiëne medewerker: kleding minimaal op 60 °C wasbaar of 40 tot 60 °C met strijken of machinaal drogen.',
      sets: '5 shirts of tuniek, 2 tot 3 broeken, 1 vest voor tussendoor',
      vakgebied: 'zorg-en-welzijn',
    },
    {
      functie: 'Begeleider in de gehandicaptenzorg',
      werk: 'Begeleidt cliënten bij wonen, dagbesteding en activiteiten, vaak ook buiten en bij sport of uitstapjes.',
      kleding: 'Polo of sweater met logo, stevige broek, softshell of fleece, schoenen waar je in kunt rennen.',
      normen: 'Geen specifieke norm. Of er korte mouwen verplicht zijn hangt af van de aard van de zorgtaak en het beleid van de instelling.',
      sets: '4 polo’s of sweaters, 2 broeken, 1 fleece of softshell',
      vakgebied: 'zorg-en-welzijn',
    },
    {
      functie: 'Fysiotherapeut en praktijkassistent',
      werk: 'Behandelt en oefent met patiënten, buigt, tilt en laat bewegingen voordoen. Contact met huid en vaak lange dagen op de been.',
      kleding: 'Polo of tuniek met rek in de rug en schouders, soepele broek, schone sportieve schoenen.',
      normen: 'Geen specifieke norm. Bij contact met patiënten gelden de hygiënerichtlijnen van de praktijk.',
      sets: '4 shirts, 2 broeken, 1 vest of jack',
      vakgebied: 'zorg-en-welzijn',
    },
    {
      functie: 'Mondhygiënist en tandartsassistent',
      werk: 'Werkt dicht op de patiënt in een mondzorgpraktijk met spatten, aerosolen en strikte hygiëneprotocollen.',
      kleding: 'Tuniek of jas met korte mouwen, wasbare broek, gesloten schoenen. Praktijkkleding wordt dagelijks gewisseld.',
      normen: 'Geen productnorm voor de kleding zelf. Volg de KNMT-richtlijn Infectiepreventie in mondzorgpraktijken (module persoonlijke hygiëne en beschermingsmiddelen).',
      sets: '5 tunieken of jassen, 3 broeken',
      vakgebied: 'zorg-en-welzijn',
    },
    {
      functie: 'Kapper',
      werk: 'Knipt, kleurt en wast haar, staat de hele dag, werkt met water, verf en haar dat in kleding blijft hangen.',
      kleding: 'Schort of jas die niet in de weg zit, shirt of polo, zwarte of donkere broek, schoenen met demping.',
      normen: 'Geen specifieke norm voor kleding. De arbocatalogus schrijft bij kleuren, ontkleuren en permanenten poedervrije nitrilhandschoenen voor, bij wassen PVC-handschoenen met lange manchet.',
      sets: '2 tot 3 schorten of jassen, 4 shirts, 2 broeken',
    },
    {
      functie: 'Schoonheidsspecialist en nagelstylist',
      werk: 'Behandelt gezicht, huid en nagels in een rustige setting, waar uitstraling en hygiëne gelijk opgaan.',
      kleding: 'Tuniek of salonjas in een rustige kleur met subtiel geborduurd logo, soepele broek, comfortabele schoenen.',
      normen: 'Geen specifieke norm. Latexvrije, chemicaliënbestendige handschoenen worden aanbevolen bij werk met producten.',
      sets: '3 tot 4 tunieken of jassen, 2 broeken',
    },
    {
      functie: 'Pedicure',
      werk: 'Behandelt voeten van klanten, zit lang voorovergebogen en werkt met scherp gereedschap en desinfectiemiddel.',
      kleding: 'Tuniek of jas met zakken voor gereedschap, wasbare broek, gesloten schoenen.',
      normen: 'Geen specifieke norm voor kleding.',
      sets: '3 tot 4 tunieken of jassen, 2 broeken',
    },
  ],
  uitdagingen: [
    {
      titel: 'Kleding moet vaak en heet gewassen kunnen worden',
      probleem:
        'In de zorg geldt dat werkkleding dagelijks schoon is en wasbaar op minimaal 60 °C, of op 40 tot 60 °C met strijken of machinaal drogen. Een tuniek die daar niet tegen kan, krimpt of verkleurt na een paar maanden.',
      aanpak:
        'We kiezen stoffen en modellen die voor intensief wassen gemaakt zijn en laten je de wasvoorschriften per artikel zien voor je bestelt. Over de wasprocedure op je locatie beslis je zelf of samen met je wasserij.',
    },
    {
      titel: 'Korte mouwen en onbedekte onderarmen',
      probleem:
        'Bij werk met besmettingsrisico vragen de richtlijnen onbedekte onderarmen en geen lange mouwen of sieraden aan handen en onderarmen. Veel standaard overhemden en vesten voldoen daar niet aan.',
      aanpak:
        'We stellen sets samen met korte mouwen voor de dagelijkse zorgtaken en een los vest of softshell voor tussendoor of buiten. Zo blijft het werk hygiënisch en zijn medewerkers niet koud.',
    },
    {
      titel: 'Medewerkers wassen thuis',
      probleem:
        'Onderzoek in de richtlijn laat zien dat kleding die medewerkers thuis wassen een hogere besmettingsgraad had. De voorkeur is wassen door de werkgever of een professionele wasserij.',
      aanpak:
        'We leveren de kleding in een vaste set per medewerker met een eenduidig uiterlijk, zodat de werkgever of wasserij de was makkelijk kan scheiden en terugbrengen. Nabestellen van een ontbrekend stuk gaat via het portaal.',
    },
    {
      titel: 'Wisselend personeel en flexkrachten',
      probleem:
        'In de zorg lopen veel mensen in korte periodes mee. Maten moeten snel kloppen en iedereen moet er in een team hetzelfde uitzien.',
      aanpak:
        'In het online portaal staan de maten per medewerker, met een budget per persoon. Een nieuwe collega bestelt zijn set zelf, jij of de teamleider keurt goed.',
    },
    {
      titel: 'Comfort in een lange dag',
      probleem:
        'Wie de hele dag tilt, bukt en opstaat, merkt direct een tuniek die knelt of een broek zonder rek. Dat kost energie en geeft uitval in het team.',
      aanpak:
        'We passen op locatie, dus bij jou in de praktijk of salon, en kijken naar rek, armsgaten en broekpijpen. Een medewerker die twijfelt probeert een andere maat of model voor je beslist.',
    },
    {
      titel: 'Uitstraling bij kleine zaken',
      probleem:
        'In een salon of kleine praktijk is kleding onderdeel van het gevoel dat een klant krijgt. Een verwassen en versleten tuniek straalt weinig uit.',
      aanpak:
        'We borduren een subtiel logo in eigen huis, maken een drukproef voor je akkoord geeft en houden de stijl rustig, zodat de set na vele wasbeurten er nog netjes uitziet.',
    },
  ],
  veranderingen: [
    {
      titel: 'Richtlijn persoonlijke hygiëne medewerker bijgewerkt in 2025',
      tekst:
        'Het Samenwerkingsverband Richtlijnen Infectiepreventie publiceerde de huidige versie op 1 juli 2025. Die vraagt onder meer onbedekte onderarmen, dagelijks schoon gewassen kleding, wassen op minimaal 60 °C of 40 tot 60 °C met strijken of machinaal drogen, en bij voorkeur wassen door de werkgever of een professionele wasserij.',
      bronUrl: 'https://richtlijnendatabase.nl/richtlijn/handhygi_ne_persoonlijke_hygi_ne_medewerker/persoonlijke_hygi_ne_kleding_en_gezicht/kleding.html',
    },
    {
      titel: 'Basishygiëne wijkverpleging met module kleding',
      tekst:
        'De RIVM-richtlijn Basishygiëne Wijkverpleging (gepubliceerd 27 september 2024) heeft een module over kleding, schoeisel en tassen. Daarin staat onder meer dat je een reserveset schone werkkleding bij je hebt en bij zichtbare verontreiniging direct verschoont.',
      bronUrl: 'https://www.rivm.nl/hygienerichtlijnen/wijkverpleging',
    },
    {
      titel: 'UPV Textiel geldt ook voor bedrijfskleding',
      tekst:
        'Sinds 1 juli 2023 zijn producenten en importeurs verantwoordelijk voor het afval van kleding en textiel, ook bedrijfskleding. De doelen lopen op: in 2025 moet 50% van het verkochte textiel worden voorbereid voor hergebruik of recycling, in 2030 en daarna 75%. Het levert op termijn meer aandacht voor kwaliteit en levensduur.',
      bronUrl: 'https://www.ilent.nl/onderwerpen/producentenverantwoordelijkheid/upv-textiel',
    },
    {
      titel: 'Krapte op de arbeidsmarkt in zorg en welzijn',
      tekst:
        'UWV noemt de arbeidsmarkt in zorg en welzijn zeer krap, met de grootste tekorten bij helpenden, verzorgenden en verpleegkundigen. Landelijk loopt het verwachte tekort in 2033 op tot circa 230.000 personen.',
      bronUrl: 'https://www.uwv.nl/assets-kai/files/1f835c23-7233-4ed3-a3e9-9c1991a5718d/Regio_in_Beeld_2024-2025_Achterhoek.pdf',
    },
  ],
  kansen: [
    {
      titel: 'Onbelast verstrekken met logo van 70 cm²',
      tekst:
        'Volgens de Belastingdienst telt kleding die ook buiten het werk te dragen is als werkkleding als er een beeldmerk op zit van minimaal 70 cm² dat naar de onderneming verwijst. We controleren de afmeting van je logo voor we bedrukken, zodat je zeker weet dat de set onbelast kan.',
    },
    {
      titel: 'Een team dat er in één oogopslag uitziet als een team',
      tekst:
        'Bij thuiszorg, praktijken en salons werken vaak kleine teams met flexkrachten. Eén herkenbare set helpt cliënten en klanten te zien wie bij de organisatie hoort en geeft nieuwe collega’s direct een plek.',
    },
    {
      titel: 'Goede kleding als arbeidsvoorwaarde',
      tekst:
        'Met een krappe markt in zorg en welzijn telt elk detail dat laat zien dat je voor je mensen zorgt. Kleding die goed zit en comfortabel is, kost weinig tegenover wat vertrek en werving kosten.',
    },
    {
      titel: 'Kledingbeheer in het portaal',
      tekst:
        'Je ziet per medewerker de maat en het budget, bestelt na en keurt goed zonder telefoontjes of mailtjes. Dat scheelt tijd bij een teamleider of praktijkmanager die al genoeg te regelen heeft.',
    },
  ],
  extraFaq: [
    {
      q: 'Mag een zorgmedewerker lange mouwen dragen?',
      a: 'Bij werk met besmettingsrisico is het antwoord nee. De richtlijnen vragen onbedekte onderarmen en geen lange mouwen aan handen en onderarmen. Voor je dagelijkse zorgtaken kies je dus een shirt of tuniek met korte mouwen. Een vest of softshell draag je alleen over je kleding als je niet de zorghandeling doet.',
    },
    {
      q: 'Op hoeveel graden moet zorgkleding gewassen worden?',
      a: 'Minimaal 60 °C, of 40 tot 60 °C als je de kleding daarna strijkt of machinaal droogt. Dat staat in de richtlijn voor persoonlijke hygiëne van medewerkers. Controleer bij elk artikel de wasvoorschriften op het label, want niet elke stof kan dat aan.',
    },
    {
      q: 'Moet de werkgever de zorgkleding wassen?',
      a: 'De richtlijn heeft voorkeur voor wassen door de werkgever of een professionele wasserij. Onderzoek liet zien dat thuis gewassen kleding vaker besmet was. Of je het intern regelt of uitbesteedt, bepaal je zelf. Wij leveren de kleding en regelen de was niet.',
    },
    {
      q: 'Welke handschoenen horen bij een kapperszaak?',
      a: 'De arbocatalogus kappers noemt poedervrije nitrilhandschoenen voor kleuren, ontkleuren en permanenten, en PVC-handschoenen met een lange manchet voor haar wassen. Wie veel met water en zeep werkt loopt ook risico op huidirritatie. Dat bespreek je met je arbodienst of vakorganisatie.',
    },
    {
      q: 'Hoeveel sets heeft een medewerker in de zorg nodig?',
      a: 'Reken op minimaal vijf shirts of tunieken als er dagelijks gewisseld wordt, plus twee of drie broeken. Zo heb je altijd een schone set terwijl de rest in de was zit. Bij thuiszorg hoort daarbij een reserveset in de auto.',
    },
  ],
  bronnen: [
    { titel: 'Achterhoek Monitor 2024/25', url: 'https://www.achterhoekmonitor.nl/Achterhoek-Monitor-2024-25.pdf' },
    { titel: 'UWV, Regio in Beeld Achterhoek 2024-2025', url: 'https://www.uwv.nl/assets-kai/files/1f835c23-7233-4ed3-a3e9-9c1991a5718d/Regio_in_Beeld_2024-2025_Achterhoek.pdf' },
    { titel: 'Richtlijn Handhygiëne en persoonlijke hygiëne medewerker, Kleding (SRI, 2025)', url: 'https://richtlijnendatabase.nl/richtlijn/handhygi_ne_persoonlijke_hygi_ne_medewerker/persoonlijke_hygi_ne_kleding_en_gezicht/kleding.html' },
    { titel: 'RIVM, Basishygiëne Wijkverpleging', url: 'https://www.rivm.nl/hygienerichtlijnen/wijkverpleging' },
    { titel: 'KNMT, Infectiepreventie in mondzorgpraktijken', url: 'https://knmt.nl/praktijkzaken/veilig-werken/infectiepreventie' },
    { titel: 'ILT, Uitgebreide producentenverantwoordelijkheid textiel', url: 'https://www.ilent.nl/onderwerpen/producentenverantwoordelijkheid/upv-textiel' },
    { titel: 'Belastingdienst, Kosten voor werkkleding', url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/winst/inkomstenbelasting/inkomstenbelasting_voor_ondernemers/zakelijke_kosten/kosten-voor-werkkleding' },
    { titel: 'Nederlandse Cosmetica Vereniging, Arbocatalogus kappers', url: 'https://www.ncv-cosmetica.nl/infocentrum/voor-de-kapper/wet-en-regelgeving/arbocatalogus/' },
    { titel: 'Werken met Huidcheck (RIVM), Kapper, schoonheidssalon, nagelstudio', url: 'https://werkenhuidcheck.nl/nl/factsheets/kapper-schoonheidssalon-nagelstudio/' },
  ],
  vragenVoorJessi: [
    'Welke zorg- en beautyklanten bel je het vaakst en wat vragen zij als eerste: prijs, wasbaarheid of uitstraling?',
    'Welke tunieken, polo’s en broeken verkoop je het meest aan thuiszorg en praktijken, en waarom juist die?',
    'Wat gaat er het vaakst mis bij zorgkleding: maat, krimp, kleur na wassen of slijtage? En wat doe je daaraan?',
    'Hoe stel je een set samen voor een kapper of schoonheidsspecialist, en welke kleur en logoplek werken het best?',
    'Vragen klanten naar de wasvoorschriften of de 60 graden-eis, en hoe leg je dat uit?',
    'Hoe vaak komt het voor dat een zorginstelling of praktijk flexkrachten of nieuwe collega’s tussentijds laat aankleden, en hoe pak je dat aan?',
  ],
};
