/**
 * Kennisbank-artikelen. Menselijk geschreven, antwoord-eerst (goed voor SEO + AI-overzichten),
 * geen em-dashes of clichéwoorden. Technische feiten geverifieerd (EN ISO 20345:2022,
 * EN ISO 20471, Belastingdienst-regels). Pas vrij aan en breid uit.
 */
export type Artikel = {
  slug: string;
  title: string;
  category: string;
  metaTitle: string;
  metaDescription: string;
  date: string;
  intro: string;
  sections: { h: string; p: string[] }[];
  relatedBranche?: string;
};

export const categorieen = [
  'Veiligheid en normen',
  'Bedrukken en branding',
  'Onderhoud',
  'Per branche',
  'Praktisch en zakelijk',
] as const;

export const artikelen: Artikel[] = [
  {
    slug: 'veiligheidsklasse-werkschoenen-kiezen',
    title: 'Welke veiligheidsklasse werkschoenen heb je nodig?',
    category: 'Veiligheid en normen',
    metaTitle: 'Veiligheidsklasse werkschoenen: S1, S3, S7 uitgelegd',
    metaDescription:
      'S1, S1P, S2, S3, S6 of S7? We leggen de veiligheidsklassen van werkschoenen uit volgens de norm EN ISO 20345:2022, zodat je de juiste kiest.',
    date: '2026-06-01',
    intro:
      'De juiste klasse hangt af van je werk: S1(P) voor droge binnenruimtes, S3 voor buiten en nat werk met doorstapbescherming. Sinds de norm EN ISO 20345:2022 zijn er ook S6 en S7 bijgekomen voor volledig waterdichte schoenen.',
    sections: [
      { h: 'Wat de basisklassen betekenen', p: [
        'Alle veiligheidsschoenen hebben een beschermende neus die een klap tot 200 joule opvangt. Het verschil zit in de rest. S1 is een gesloten, antistatische schoen met schokdemping in de hiel, bedoeld voor droge binnenomgevingen. S2 voegt daar waterafstotend bovenleer aan toe. S3 gaat verder met een doorstapbescherming in de zool en een geprofileerde buitenzool, de meest gekozen klasse voor bouw en buitenwerk.',
      ]},
      { h: 'Nieuw sinds 2022: S6, S7 en de P-markeringen', p: [
        'De norm EN ISO 20345:2022 heeft klassen toegevoegd. S6 is een S2 met een volledig waterdichte schoen, S7 is een S3 met diezelfde volledige waterdichtheid. De doorstapbescherming wordt nu ook preciezer aangeduid: P voor een stalen tussenzool, PL en PS voor metaalvrije varianten die getest zijn met een kleinere testpen.',
        'Oude en nieuwe norm mogen voorlopig naast elkaar bestaan. Zie je nog S1P of S3 op een schoen, dan klopt dat gewoon. Wij vertellen je per model wat de markering betekent voor jouw werk.',
      ]},
      { h: 'Veelgebruikte extra letters', p: [
        'Naast de klasse zie je soms losse codes. WR staat voor een volledig waterdichte schoen, SR voor een geteste antislipzool, ESD voor afleiding van statische lading (belangrijk in de elektronica), en HRO voor een hittebestendige zool. CI en HI gaan over koude- en warmte-isolatie.',
      ]},
      { h: 'Kort advies', p: [
        'Werk je binnen en droog, dan is S1P meestal genoeg. Werk je buiten, in de modder of op de bouw, kies dan S3 of S7. Twijfel je, dan kijken we samen naar je werk en laten we je passen. Een halve maat verkeerd voel je na acht uur.',
      ]},
    ],
    relatedBranche: 'bouw-en-infra',
  },
  {
    slug: 'hi-vis-kleding-welke-klasse',
    title: 'Hi-vis kleding: heb je klasse 1, 2 of 3 nodig?',
    category: 'Veiligheid en normen',
    metaTitle: 'Hi-vis kleding klasse 1, 2 of 3 (EN ISO 20471)',
    metaDescription:
      'Welke klasse zichtbaarheidskleding heb je nodig? We leggen EN ISO 20471 uit: de oppervlakte-eisen en wanneer je klasse 1, 2 of 3 draagt.',
    date: '2026-06-02',
    intro:
      'De klasse bepaalt hoeveel fluorescerend en reflecterend materiaal de kleding heeft. Hoe hoger de snelheid van het verkeer om je heen, hoe hoger de klasse. Voor werk langs drukke wegen is klasse 3 de norm.',
    sections: [
      { h: 'De drie klassen volgens EN ISO 20471', p: [
        'Klasse 1 heeft minimaal 0,14 m2 fluorescerend en 0,10 m2 reflecterend materiaal en is bedoeld voor situaties met weinig verkeer. Klasse 2 (0,50 m2 fluorescerend, 0,13 m2 reflecterend) is een veelgebruikte tussenklasse. Klasse 3 (0,80 m2 fluorescerend, 0,20 m2 reflecterend) biedt de hoogste zichtbaarheid en is bedoeld voor werk langs snel of druk verkeer en bij slecht zicht.',
      ]},
      { h: 'Hoe je aan een hogere klasse komt', p: [
        'De klasse geldt per kledingstuk. Een broek of een vest alleen haalt vaak klasse 1 of 2. Draag je een hi-vis broek en een hi-vis jas samen, dan tel je op naar klasse 3. Daarom leveren we voor werk langs de weg meestal een combinatie.',
        'De fluorescerende kleur mag geel, oranje-rood of rood zijn. De norm stelt ook eisen aan waar het reflecterende materiaal zit, zodat je vanuit elke hoek zichtbaar bent.',
      ]},
      { h: 'Let op na het wassen', p: [
        'Hi-vis kleding verliest na verloop van tijd zijn zichtbaarheid. De norm gaat uit van een maximaal aantal wasbeurten, vaak rond de 25 tot 50, afhankelijk van het kledingstuk. Verbleekte of dofgewassen kleding voldoet niet meer. Vervang het op tijd.',
      ]},
    ],
    relatedBranche: 'industrie-en-transport',
  },
  {
    slug: 'bedrukken-of-borduren',
    title: 'Werkkleding bedrukken of borduren: wat kun je het beste kiezen?',
    category: 'Bedrukken en branding',
    metaTitle: 'Bedrukken of borduren werkkleding: het verschil',
    metaDescription:
      'Bedrukken of borduren voor je logo op werkkleding? We leggen het verschil uit in look, duurzaamheid, kosten en wanneer je wat kiest.',
    date: '2026-06-03',
    intro:
      'Borduren oogt verzorgd en gaat het langst mee, ideaal voor polo’s, jassen en horecakleding. Bedrukken is voordeliger bij kleurrijke logo’s en grotere oplagen. Per kledingstuk bekijken we wat het beste resultaat geeft.',
    sections: [
      { h: 'Borduren', p: [
        'Bij borduren wordt het logo met garen in de stof genaaid. Het voelt stevig, gaat jarenlang mee en blijft strak door de was, ook op hogere temperaturen. Dat maakt het de logische keuze voor representatieve kleding en voor horeca, waar vaak heet gewassen wordt. Voor heel kleine details of kleurverlopen is borduren minder geschikt.',
      ]},
      { h: 'Bedrukken', p: [
        'Bij bedrukken brengen we het logo aan met transfer of zeefdruk. Dat geeft scherpe lijnen en veel kleur, ook bij ingewikkelde logo’s, en is voordelig bij grotere aantallen. Een goede druk gaat lang mee, al is borduren op de zwaarste werkkleding nog net iets duurzamer.',
      ]},
      { h: 'Wat wij adviseren', p: [
        'Voor een polo of jas met klantcontact kiezen we meestal borduren. Voor t-shirts, een kleurrijk sponsorlogo of een grote oplage is bedrukken vaak slimmer. Omdat we het in eigen huis doen, schakelen we snel en zie je vooraf hoe het eruit komt te zien. Lever je logo het liefst aan als vectorbestand (AI, EPS of PDF).',
      ]},
    ],
    relatedBranche: 'representatief',
  },
  {
    slug: 'bedrijfskleding-fiscaal-aftrekbaar',
    title: 'Is bedrijfskleding fiscaal aftrekbaar?',
    category: 'Praktisch en zakelijk',
    metaTitle: 'Bedrijfskleding fiscaal aftrekbaar? De 70 cm2-regel',
    metaDescription:
      'Wanneer is werkkleding fiscaal aftrekbaar? De Belastingdienst hanteert de 70 cm2-logoregel. We leggen de voorwaarden uit.',
    date: '2026-06-04',
    intro:
      'Werkkleding is aftrekbaar als die (bijna) alleen voor het werk te dragen is, of als er een bedrijfslogo van minimaal 70 cm2 op zit. Kleding die ook prima privé gedragen kan worden zonder zo’n logo, is niet aftrekbaar.',
    sections: [
      { h: 'De hoofdregel', p: [
        'De Belastingdienst ziet kleding als werkkleding wanneer die uitsluitend of nagenoeg uitsluitend geschikt is voor het werk, zoals een overall of een uniform. Is de kleding ook buiten het werk te dragen, dan moet er een duidelijk bedrijfslogo op met een oppervlakte van minimaal 70 vierkante centimeter.',
      ]},
      { h: 'Hoe groot is 70 cm2', p: [
        'Dat is bijvoorbeeld een logo van 10 bij 7 centimeter. Het mag ook uit meerdere kleinere logo’s bestaan die samen op 70 cm2 uitkomen, bijvoorbeeld op borst, rug en mouw. Het logo moet verwijzen naar je bedrijf en op ongeveer een meter afstand herkenbaar zijn als bedrijfslogo.',
      ]},
      { h: 'Een tweede route: op de werkplek', p: [
        'Kleding kan ook onbelast blijven als die aantoonbaar op de werkplek achterblijft. Huisstijlkleuren en andere huisstijlelementen tellen mee bij de beoordeling. Twijfel je over jouw situatie, leg het dan voor aan je boekhouder. Wij zorgen in elk geval dat het logo groot en duidelijk genoeg is om aan de eis te voldoen.',
      ]},
    ],
    relatedBranche: 'representatief',
  },
  {
    slug: 'werkkleding-wassen-en-onderhouden',
    title: 'Werkkleding wassen: zo gaat het langer mee',
    category: 'Onderhoud',
    metaTitle: 'Werkkleding wassen en onderhouden: tips',
    metaDescription:
      'Hoe was je werkkleding zodat die langer meegaat, en waar let je op bij hi-vis en bedrukte kleding? Praktische wastips.',
    date: '2026-06-05',
    intro:
      'Volg het wasvoorschrift, was niet warmer dan nodig en gebruik geen wasverzachter op functionele kleding. Zo behoud je kleur, pasvorm en bescherming, en gaat je kleding jaren langer mee.',
    sections: [
      { h: 'De basis', p: [
        'Kijk eerst naar het wasetiket, want elke stof vraagt iets anders. Was werkkleding binnenstebuiten om kleur en bedrukking te sparen, en vol maar niet overvol, zodat het vuil er echt uit gaat. Wasverzachter lijkt fijn, maar tast de ademende en waterafstotende eigenschappen van veel werkkleding aan. Laat het weg.',
      ]},
      { h: 'Hi-vis en functionele kleding', p: [
        'Zichtbaarheidskleding verliest na een aantal wasbeurten zijn felheid en reflectie. Was het apart van vuile werkkleding, op de voorgeschreven temperatuur, en vervang het zodra het dof wordt. Voor waterdichte jassen geldt: af en toe impregneren houdt de waterafstoting op peil.',
      ]},
      { h: 'Bedrukte en geborduurde kleding', p: [
        'Borduurwerk kan goed tegen de was. Bedrukking gaat het langst mee als je binnenstebuiten wast, niet te heet, en niet in de droger op hoge stand. Strijken doe je niet direct op de druk. Met deze gewoontes blijft je logo jaren strak.',
      ]},
    ],
  },
  {
    slug: 'werkkleding-voor-de-bouw',
    title: 'Werkkleding voor de bouw: waar let je op?',
    category: 'Per branche',
    metaTitle: 'Werkkleding voor de bouw kiezen',
    metaDescription:
      'Welke werkkleding heb je nodig op de bouw? Over stevige werkbroeken, hi-vis, veiligheidsschoenen en wat echt het verschil maakt.',
    date: '2026-06-06',
    intro:
      'Op de bouw telt slijtvastheid, veiligheid en comfort over een hele dag. Let op stevig naadwerk, kniezakken, de juiste hi-vis klasse bij werk langs de weg en S3-schoenen voor buiten.',
    sections: [
      { h: 'De werkbroek is je werkpaard', p: [
        'Een goede werkbroek heeft versterkt dubbeldoek op de knie en de zakken, inschuifbare kniestukken op de juiste hoogte en genoeg ruimte om in te bewegen. Merken als Snickers en Mascot zijn hier sterk in. Een broek die scheurt bij het bukken kost je meer dan een iets duurdere broek die jaren meegaat.',
      ]},
      { h: 'Veiligheid waar het moet', p: [
        'Werk je langs de weg, dan is hi-vis verplicht in de juiste klasse (zie ons artikel over hi-vis). Voor buitenwerk en oneffen terrein kies je S3-schoenen met doorstapbescherming. Vul aan met handschoenen, een helm en gehoorbescherming waar dat nodig is.',
      ]},
      { h: 'Lagen voor elk seizoen', p: [
        'Bouwwerk gaat het hele jaar door. Denk in lagen: een ademend shirt, een softshell voor het tussenseizoen en een gevoerde jas of bodywarmer voor de winter. Zo zit je team altijd goed, zonder dat je twee keer hetzelfde koopt.',
      ]},
    ],
    relatedBranche: 'bouw-en-infra',
  },
  {
    slug: 'horecakleding-kiezen',
    title: 'Horecakleding kiezen: koksbuis, schort en uitstraling',
    category: 'Per branche',
    metaTitle: 'Horecakleding kiezen: koksbuis, schort, bediening',
    metaDescription:
      'Hoe kies je horecakleding die comfortabel zit en past bij je zaak? Over koksbuizen, schorten, bediening en het logo.',
    date: '2026-06-07',
    intro:
      'Kies kleding die de hele dienst comfortabel blijft en past bij de sfeer van je zaak. Let op ademende stoffen voor de keuken, een schort dat niet in de weg zit, en een logo dat de hete was overleeft.',
    sections: [
      { h: 'In de keuken', p: [
        'Een koksbuis moet ademen en bewegen met je mee, want het is warm en druk. Er zijn modellen voor heren en dames en kleuren die verder gaan dan standaard wit. Antislip werkschoenen met demping maken een lange dienst een stuk aangenamer.',
      ]},
      { h: 'In de bediening', p: [
        'Hier telt uitstraling. Een net overhemd, een blouse of een polo die er aan het eind van de avond nog verzorgd uitziet, past bij de meeste zaken. Een schort kun je kiezen in klassiek lang, kort of een leren look, afhankelijk van de sfeer.',
      ]},
      { h: 'Het logo', p: [
        'Voor horeca adviseren we meestal borduren. Het oogt verzorgd en gaat goed door de vaak hete was van horecatextiel. We kijken samen naar kleur en plek, zodat het past bij je huisstijl.',
      ]},
    ],
    relatedBranche: 'horeca-en-hospitality',
  },
  {
    slug: 'duurzame-circulaire-bedrijfskleding',
    title: 'Duurzame en circulaire bedrijfskleding: wat verandert er?',
    category: 'Praktisch en zakelijk',
    metaTitle: 'Duurzame en circulaire bedrijfskleding 2025-2026',
    metaDescription:
      'Wat betekenen het digitaal productpaspoort, gescheiden textielinzameling en CSRD voor je bedrijfskleding? Een praktische uitleg.',
    date: '2026-06-08',
    intro:
      'Duurzaamheid wordt een aankoopcriterium. Er komen een digitaal productpaspoort voor textiel, verplichte gescheiden textielinzameling en rapportageplichten voor grotere bedrijven. Slim wassen, repareren en langer dragen is de goedkoopste vorm van duurzaamheid.',
    sections: [
      { h: 'Wat er speelt', p: [
        'De Europese regels rond textiel worden de komende jaren strenger. Er komt gefaseerd een digitaal productpaspoort dat laat zien waar een kledingstuk van gemaakt is en hoe het te recyclen valt. Daarnaast moet textiel gescheiden worden ingezameld en gelden er doelen voor hergebruik en recycling.',
      ]},
      { h: 'Wat dat voor jou betekent', p: [
        'Grotere bedrijven moeten via de CSRD over duurzaamheid rapporteren, en dat werkt door naar leveranciers en klanten. Ook als kleiner bedrijf is het slim om nu al te kiezen voor kleding die lang meegaat en te herstellen is. Dat scheelt op termijn geld en sluit aan bij wat opdrachtgevers steeds vaker vragen.',
      ]},
      { h: 'De simpelste winst', p: [
        'Het duurzaamste kledingstuk is het kledingstuk dat je niet hoeft te vervangen. Goede kwaliteit kiezen, op de juiste manier wassen en kleine reparaties laten doen in plaats van weggooien levert het meeste op. We denken hierin met je mee.',
      ]},
    ],
  },
  {
    slug: 'juiste-maat-werkkleding',
    title: 'De juiste maat werkkleding: zo voorkom je miskopen',
    category: 'Praktisch en zakelijk',
    metaTitle: 'De juiste maat werkkleding kiezen',
    metaDescription:
      'Hoe kies je de juiste maat werkkleding voor je team? Over maattabellen, passen op locatie en grote maten zonder gedoe.',
    date: '2026-06-09',
    intro:
      'Maten verschillen per merk, dus ga niet blind op een getal af. Passen voorkomt miskopen, retourzendingen en mensen die de hele dag in te krappe of te ruime kleding werken. Daarom komen wij langs om te passen.',
    sections: [
      { h: 'Waarom passen loont', p: [
        'Een maat L bij het ene merk is niet hetzelfde als een L bij het andere. Bij werkbroeken telt ook de beenlengte en de ruimte op de knie, bij jassen de bewegingsvrijheid in de schouders. Passen kost even tijd, maar voorkomt dat je achteraf moet ruilen en dat iemand maanden in verkeerde kleding loopt.',
      ]},
      { h: 'Grote maten en speciale pasvormen', p: [
        'Iedereen hoort goed in zijn kleding te zitten. We hebben een ruim maatbereik en bestellen indien nodig een pasmaat. Ook voor damesmodellen en bredere of langere pasvormen kijken we naar wat past. Niemand hoeft te werken in iets dat knelt of slobbert.',
      ]},
      { h: 'Maten vastleggen voor later', p: [
        'Als we een keer hebben gepast, leggen we de maten per medewerker vast. Komt er iemand nieuw bij, dan weet je meteen wat je bestelt en gaat de nalevering snel. Dat scheelt jou werk bij elke wisseling in je team.',
      ]},
    ],
  },
  {
    slug: 'werkkleding-voor-de-winter',
    title: 'Werkkleding voor de winter: warm en toch werkbaar',
    category: 'Per branche',
    metaTitle: 'Winterwerkkleding: laagjes, jassen en thermo',
    metaDescription:
      'Hoe houd je je team warm en werkbaar in de winter? Over laagjes, gevoerde jassen, bodywarmers en thermokleding.',
    date: '2026-06-10',
    intro:
      'Werk in lagen: een thermolaag tegen de huid, een isolerende laag en een wind- en waterdichte buitenlaag. Zo blijf je warm zonder te gaan zweten, en kun je een laag uitdoen als je het warm krijgt.',
    sections: [
      { h: 'Het laagjesprincipe', p: [
        'Eén dikke jas werkt minder goed dan meerdere dunnere lagen. Een thermoshirt voert zweet af, een fleece of bodywarmer houdt de warmte vast, en een softshell of gevoerde jas houdt wind en regen buiten. Word je het warm tijdens het werk, dan doe je gewoon een laag uit.',
      ]},
      { h: 'Buiten werken', p: [
        'Voor wie de hele dag buiten staat, is een gevoerde, waterdichte jas de basis, eventueel met een hi-vis uitvoering. Vul aan met een muts, warme handschoenen en gevoerde of geïsoleerde schoenen. Koude voeten verpesten elke werkdag.',
      ]},
      { h: 'Op tijd bestellen', p: [
        'De vraag naar winterkleding piekt zodra het kouder wordt, en dan zijn maten sneller uitverkocht. Regel het liefst in het najaar, dan ligt alles klaar voordat de eerste vorst komt. We denken met je mee over wat je team echt nodig heeft.',
      ]},
    ],
    relatedBranche: 'agri-en-milieu',
  },
  {
    slug: 'werkkleding-voor-zorg-en-beauty',
    title: 'Werkkleding voor zorg en beauty: hygiëne en uitstraling',
    category: 'Per branche',
    metaTitle: 'Werkkleding voor zorg en beauty kiezen',
    metaDescription:
      'Welke kleding past in de zorg en in salons? Over hygiëne, comfort, makkelijk wasbare stoffen en een verzorgde uitstraling.',
    date: '2026-06-11',
    intro:
      'Kies kleding die er verzorgd uitziet, comfortabel zit en heet gewassen kan worden. In de zorg en beauty werk je dicht op de ander, dus hygiëne en een nette uitstraling tellen zwaar.',
    sections: [
      { h: 'Hygiëne voorop', p: [
        'In de zorg en in salons moet kleding vaak en op hoge temperatuur gewassen kunnen worden zonder te vervormen of te verkleuren. We kiezen daarom stoffen die daar tegen kunnen en die snel drogen. Tunieken en zorgjassen zijn er in modellen die de hele dag goed blijven zitten.',
      ]},
      { h: 'Comfort de hele dag', p: [
        'Een tuniek of jas die knelt bij het bukken of strekken werkt de hele dag tegen je. Daarom passen we op de persoon en kijken we naar modellen die meebewegen. Voor salons en beauty kijken we ook naar kleur en uitstraling die past bij de sfeer.',
      ]},
      { h: 'Een subtiel logo', p: [
        'In deze sectoren werkt een klein, geborduurd logo vaak beter dan een grote print. Het oogt verzorgd, blijft netjes door de was en wekt vertrouwen bij wie tegenover je zit.',
      ]},
    ],
    relatedBranche: 'zorg-en-beauty',
  },
  {
    slug: 'werkkleding-voor-agrarisch-en-groen-werk',
    title: 'Werkkleding voor agrarisch en groen werk',
    category: 'Per branche',
    metaTitle: 'Werkkleding voor agri en groen: weerbestendig en stevig',
    metaDescription:
      'Welke kleding houdt stand bij agrarisch en groen werk? Over overalls, weerbestendige jassen, bodywarmers en stevige schoenen.',
    date: '2026-06-12',
    intro:
      'Kies stevige, weerbestendige kleding die tegen modder, machines en lange dagen kan. Denk in lagen voor de wisselende seizoenen en kies schoenen of laarzen die passen bij nat en zwaar terrein.',
    sections: [
      { h: 'Stevig en praktisch', p: [
        'Overalls en tuinbroeken met genoeg ruimte en stevige stof zijn de basis voor werk op het land en in het groen. Ze moeten tegen modder, takken en machines kunnen. Let op verstevigde knieën en zakken die niet meteen inscheuren.',
      ]},
      { h: 'Droog en warm blijven', p: [
        'Buiten werken betekent regen, wind en kou. Een waterdichte, ademende jas houdt je droog zonder dat je erin staat te zweten. Voor het tussenseizoen is een bodywarmer handig, voor de winter een gevoerde jas. Stevige werkschoenen of laarzen maken het af.',
      ]},
      { h: 'Zichtbaarheid bij machines en verkeer', p: [
        'Werk je langs de weg of met grote machines, dan is hi-vis verstandig of verplicht. We kijken samen of en welke klasse je nodig hebt, zodat je gezien wordt zonder onnodige extra’s.',
      ]},
    ],
    relatedBranche: 'agri-en-milieu',
  },
  {
    slug: 'pbm-en-werkkleding-werkgever',
    title: 'PBM en werkkleding: wat moet je als werkgever regelen?',
    category: 'Veiligheid en normen',
    metaTitle: 'PBM en werkkleding: verplichtingen werkgever',
    metaDescription:
      'Wat zijn je verplichtingen rond persoonlijke beschermingsmiddelen en werkkleding? Een praktische uitleg voor werkgevers.',
    date: '2026-06-13',
    intro:
      'Als werkgever ben je verantwoordelijk voor veilige werkomstandigheden. Waar risico’s niet anders zijn weg te nemen, stel je gratis de juiste persoonlijke beschermingsmiddelen beschikbaar en zorg je dat ze gebruikt en onderhouden worden.',
    sections: [
      { h: 'De volgorde van bescherming', p: [
        'Volgens de arbowetgeving pak je risico’s eerst bij de bron aan. Pas als dat niet genoeg helpt, komen persoonlijke beschermingsmiddelen in beeld: veiligheidsschoenen, gehoorbescherming, handschoenen, hi-vis kleding en zo verder. Een risico-inventarisatie laat zien wat in jouw situatie nodig is.',
      ]},
      { h: 'Wat dat in de praktijk betekent', p: [
        'Je stelt de middelen gratis ter beschikking, zorgt dat ze passen en goedgekeurd zijn, en dat medewerkers weten hoe ze ze gebruiken. Ook onderhoud en tijdige vervanging horen erbij. Versleten hi-vis of kapotte schoenen beschermen niet meer.',
      ]},
      { h: 'Waar wij bij helpen', p: [
        'Wij leveren de kleding en schoenen die bij jouw risico’s passen, in de juiste normklasse, en houden bij wat wanneer aan vervanging toe is. Zo voldoe je aan je verplichtingen zonder dat je het zelf hoeft uit te zoeken. Voor de formele kant verwijzen we je naar je arbodienst.',
      ]},
    ],
    relatedBranche: 'bouw-en-infra',
  },
  {
    slug: 'kledinglijn-opzetten-voor-je-team',
    title: 'Een kledinglijn opzetten voor je team: zo pak je het aan',
    category: 'Praktisch en zakelijk',
    metaTitle: 'Bedrijfskledinglijn opzetten voor je team',
    metaDescription:
      'Hoe zet je een vaste kledinglijn op voor je hele team, en hoe houd je nabestellen simpel? Een stappenplan.',
    date: '2026-06-14',
    intro:
      'Bepaal per functie wat mensen dragen, kies de modellen, maten en logo-posities, en leg dat vast als vaste lijn. Daarna is nabestellen voor een nieuwe medewerker een kwestie van een belletje.',
    sections: [
      { h: 'Begin bij het werk', p: [
        'Kijk per functie wat nodig is. Een monteur draagt iets anders dan iemand in de buitendienst of achter de balie. Daaruit volgt de kledinglijn: welke broek, jas, polo of schoenen, in welke kleur en met welke logo-posities. Zo krijgt iedereen een passende, herkenbare set.',
      ]},
      { h: 'Maak het schaalbaar', p: [
        'We leggen de lijn vast, inclusief maten per medewerker en de plek van het logo. Komt er iemand bij, dan bestel je dezelfde set zonder opnieuw te hoeven kiezen. Dat houdt je team uniform en bespaart jou tijd bij elke wisseling.',
      ]},
      { h: 'Eén aanspreekpunt', p: [
        'Bij ons regel je het op één plek: advies, passen, bedrukken en nalevering. Je hoeft niet met meerdere partijen te schakelen, en je hebt iemand die je bedrijf kent als er iets nodig is.',
      ]},
    ],
  },
  {
    slug: 'representatieve-bedrijfskleding',
    title: 'Representatieve bedrijfskleding: zo straalt je team je merk uit',
    category: 'Per branche',
    metaTitle: 'Representatieve bedrijfskleding kiezen',
    metaDescription:
      'Hoe kies je verzorgde bedrijfskleding voor functies met klantcontact? Over polo’s, overhemden, softshells en een consistente uitstraling.',
    date: '2026-06-15',
    intro:
      'Voor functies met klantcontact telt de eerste indruk. Kies een verzorgde, zakelijke lijn die past bij je huisstijl en houd die consistent over het hele team, zodat je er als een geheel uitziet.',
    sections: [
      { h: 'Verzorgd en praktisch', p: [
        'Een nette polo onder een softshell, een overhemd in de huisstijlkleur of een bodywarmer met logo: het oogt zakelijk en is toch praktisch om in te werken. Kies modellen die netjes blijven gedurende de dag en die er voor heren en dames goed uitzien.',
      ]},
      { h: 'Consistent over het team', p: [
        'Eén persoon in bedrijfskleding valt op, een heel team in dezelfde lijn maakt indruk. Houd kleur, model en logo-positie gelijk, zodat je merk overal hetzelfde overkomt. We stemmen het af op je huisstijl.',
      ]},
      { h: 'Subtiel logo, sterk effect', p: [
        'Vaak werkt een subtiel geborduurd logo sterker dan een grote print. Het oogt verzorgd en past bij een zakelijke uitstraling. We laten je vooraf zien hoe het eruitziet op de gekozen kleding.',
      ]},
    ],
    relatedBranche: 'representatief',
  },
  {
    slug: 'industrieel-wassen-werkkleding',
    title: 'Industrieel wassen van werkkleding: wat betekent dat voor de norm?',
    category: 'Onderhoud',
    metaTitle: 'Industrieel wassen werkkleding (EN ISO 15797)',
    metaDescription:
      'Gaat je werkkleding naar een industriële wasserij? EN ISO 15797 test of kleding daartegen kan. We leggen uit wat het PRO-label betekent en wanneer je hierop moet letten.',
    date: '2026-06-16',
    intro:
      'Laat je werkkleding door een wasserij reinigen, dan moet de stof tegen hoge temperaturen, sterke wasmiddelen en machinaal drogen kunnen. EN ISO 15797 is de testmethode die laat zien hoe goed kleding daartegen bestand is. Kleding met het PRO-label is hierop getest.',
    sections: [
      { h: 'Waarom industrieel wassen anders is', p: [
        'Een industriële wasserij wast heter, langer en met agressievere middelen dan een wasmachine thuis. Dat is nodig om olie, vet en hardnekkig vuil eruit te krijgen, maar gewone kleding houdt dat niet lang vol. Naden laten los, kleuren verschieten en de pasvorm verandert. Kleding die je via een wasserij of een leasecontract reinigt, moet daar bewust op gemaakt zijn.',
      ]},
      { h: 'Wat EN ISO 15797 doet', p: [
        'EN ISO 15797 is een testnorm, geen eisenpakket. De norm beschrijft was- en droogprocedures, genummerd 1 tot en met 8, waarmee fabrikanten hun kleding kunnen laten beoordelen op geschiktheid voor industrieel wassen. Het zegt dus niet dat kleding "geslaagd" of "gezakt" is, maar geeft een vergelijkbare indicatie van hoe de stof, kleur en vorm zich houden.',
        'Veel merken gebruiken hiervoor een eigen aanduiding. Mascot werkt bijvoorbeeld met een PRO-label en ProWash, dat aangeeft dat het kledingstuk volgens EN ISO 15797 getest is. Zie je zo’n label, dan weet je dat de kleding voor een wasserij geschikt is.',
      ]},
      { h: 'Het effect op beschermende kleding', p: [
        'Bij hi-vis en andere beschermende kleding is dit extra belangrijk. Industrieel wassen kan de fluorescentie en de reflectie sneller laten teruglopen. Een kledingstuk dat volgens EN ISO 20471 voldoet als het nieuw is, doet dat na te veel of te harde wasbeurten niet meer. Staat er geen maximum op het etiket, dan is de kleding standaard tot vijf keer wassen getest. Check dat voordat je een wascontract afsluit.',
      ]},
      { h: 'Ons advies', p: [
        'Ga je met een wasserij of een leasepartij werken, kies dan vanaf het begin kleding die voor industrieel wassen geschikt is. Dat scheelt je het verschil tussen kleding die na een half jaar versleten is en kleding die jaren meegaat. We vertellen je per model of het een industrieel-was-label heeft en wat dat voor jouw situatie betekent.',
      ]},
    ],
    relatedBranche: 'industrie-en-transport',
  },
  {
    slug: 'esd-antistatische-werkkleding',
    title: 'ESD- en antistatische werkkleding: wanneer heb je het nodig?',
    category: 'Veiligheid en normen',
    metaTitle: 'ESD-werkkleding en EN 61340-5-1 uitgelegd',
    metaDescription:
      'Wanneer is ESD- of antistatische werkkleding nodig en welke norm geldt? We leggen IEC/EN 61340-5-1 uit en het verschil tussen antistatisch en ESD.',
    date: '2026-06-17',
    intro:
      'ESD-kleding is nodig waar je met gevoelige elektronica werkt en statische ontlading schade kan veroorzaken. De norm die daarover gaat is IEC 61340-5-1 (in Europa als EN-versie). Let op: antistatisch en ESD zijn niet hetzelfde.',
    sections: [
      { h: 'Het verschil tussen antistatisch en ESD', p: [
        'Antistatische kleding voorkomt dat zich een grote lading opbouwt, bijvoorbeeld om vonken in een explosiegevaarlijke omgeving te vermijden. ESD-kleding gaat een stap verder: die leidt statische lading gecontroleerd af zodat gevoelige elektronische onderdelen niet beschadigen. De stof bevat daarvoor geleidende vezels, vaak in een ruitpatroon ingeweven. De twee worden vaak door elkaar gehaald, maar het zijn echt verschillende toepassingen.',
      ]},
      { h: 'Wat EN 61340-5-1 regelt', p: [
        'IEC 61340-5-1 heet voluit "bescherming van elektronische componenten tegen elektrostatische verschijnselen". De norm beschrijft hoe je een ESD-beheersprogramma opzet en onderhoudt. Kleding is daarin maar een onderdeel: het gaat ook om vloeren, polsbanden, werkplekken en aarding. De meest recente uitgave is IEC 61340-5-1:2024.',
        'De norm geldt voor organisaties die werken met onderdelen die gevoelig zijn vanaf 100 volt (human body model). Denk aan elektronicaproductie, reparatie en assemblage. Een losse ESD-jas maakt je werkplek dus nog niet veilig. Het hele systeem moet kloppen.',
      ]},
      { h: 'Wanneer dit voor jou speelt', p: [
        'Werk je in de elektronica, bij printplaatassemblage, in cleanrooms of bij bepaalde precisie-industrie, dan is ESD-kleding vaak verplicht gesteld door de opdrachtgever of in het kwaliteitssysteem. Buiten die omgevingen heb je het meestal niet nodig. Op veiligheidsschoenen zie je trouwens ook de letters ESD, wat aangeeft dat de schoen statische lading afvoert.',
      ]},
      { h: 'Hoe wij helpen', p: [
        'We leveren ESD-gecertificeerde polo’s, jassen en schoenen die passen binnen een ESD-omgeving. Wat we niet doen, is je ESD-programma inrichten of meten, daar is een gespecialiseerde partij voor. Wel zorgen we dat de kleding die je bij ons koopt de juiste certificering heeft en aansluit bij wat je opdrachtgever vraagt.',
      ]},
    ],
    relatedBranche: 'industrie-en-transport',
  },
  {
    slug: 'werkkostenregeling-werkkleding',
    title: 'Werkkleding en de werkkostenregeling: hoe houd je het onbelast?',
    category: 'Praktisch en zakelijk',
    metaTitle: 'Werkkleding en werkkostenregeling (WKR) uitgelegd',
    metaDescription:
      'Hoe houd je werkkleding onbelast onder de werkkostenregeling? De drie routes: arbeidsmiddel, logo van 70 cm2 of kleding die op de werkplek blijft.',
    date: '2026-06-18',
    intro:
      'Werkkleding kun je onbelast verstrekken als die onder een gerichte vrijstelling of nihilwaardering valt. Dat lukt op drie manieren: kleding die alleen geschikt is voor het werk, kleding met een logo van minimaal 70 cm2, of kleding die aantoonbaar op de werkplek blijft. Anders gaat het ten koste van je vrije ruimte.',
    sections: [
      { h: 'Verstrekken, niet schenken', p: [
        'Het begint met een onderscheid. Geef je kleding in eigendom (schenken), dan is het al snel loon. Stel je het ter beschikking (verstrekken), waarbij het in feite van het bedrijf blijft, dan kan een nihilwaardering gelden. Dat verschil bepaalt vaak of er belasting over betaald moet worden. Veel werkgevers regelen het daarom als terbeschikkingstelling.',
      ]},
      { h: 'De drie routes naar onbelast', p: [
        'Route een: de kleding is uitsluitend of nagenoeg uitsluitend geschikt voor het werk, zoals een overall of een uniform. Route twee: er zit een of meer logo’s op met samen minimaal 70 vierkante centimeter per kledingstuk, gemeten met een denkbeeldige rechthoek om de uiterste punten van het logo. Route drie: de kleding blijft aantoonbaar achter op de werkplek en gaat niet mee naar huis.',
        'Voldoe je aan een van deze routes, dan hoeft de waarde niet in de vrije ruimte van de werkkostenregeling. Dat is de ruimte waarbinnen je onbelast vergoedingen en verstrekkingen mag geven. Vul je die ruimte met werkkleding, dan houd je minder over voor andere dingen.',
      ]},
      { h: 'Waarom de logo-eis zo handig is', p: [
        'De logo-route is in de praktijk de makkelijkste. Een polo of jas is op zichzelf prima privé te dragen, maar met een logo van 70 cm2 of meer telt het als werkkleding. Dat is bijvoorbeeld een borduring van ongeveer 10 bij 7 centimeter, of meerdere kleinere logo’s op borst, rug en mouw die samen aan de eis komen. Wij zorgen dat het logo groot en duidelijk genoeg is.',
      ]},
      { h: 'Even kort over de grens', p: [
        'De regels rond de werkkostenregeling en de exacte percentages van de vrije ruimte veranderen geregeld. Voor de fiscale beoordeling van jouw situatie is je boekhouder of de Belastingdienst leidend. Wij regelen de kant die wij kennen: kleding met een logo dat aan de 70 cm2-eis voldoet, zodat die route in elk geval openstaat.',
      ]},
    ],
    relatedBranche: 'representatief',
  },
  {
    slug: 'oeko-tex-grs-keurmerken-werkkleding',
    title: 'OEKO-TEX en GRS: wat zeggen deze keurmerken op werkkleding?',
    category: 'Praktisch en zakelijk',
    metaTitle: 'OEKO-TEX en GRS keurmerken werkkleding uitgelegd',
    metaDescription:
      'OEKO-TEX Standard 100 en het Global Recycled Standard (GRS): wat betekenen ze echt? Het verschil tussen veilig getest op stoffen en aantoonbaar gerecycled.',
    date: '2026-06-19',
    intro:
      'OEKO-TEX Standard 100 zegt dat een kledingstuk getest is op schadelijke stoffen. GRS (Global Recycled Standard) zegt iets heel anders: dat het gerecyclede materiaal bevat en dat dit door de keten heen is gecontroleerd. Het ene gaat over gezondheid, het andere over recycling.',
    sections: [
      { h: 'OEKO-TEX Standard 100', p: [
        'Dit keurmerk test het eindproduct op schadelijke stoffen, op alle niveaus van de productie. Een kledingstuk met OEKO-TEX Standard 100 voldoet aan grenswaarden voor stoffen die slecht voor de gezondheid kunnen zijn. Belangrijk om te weten: het is een gezondheidskeurmerk, geen duurzaamheidskeurmerk. Het zegt niets over of de kleding milieuvriendelijk of gerecycled is.',
      ]},
      { h: 'GRS: Global Recycled Standard', p: [
        'GRS draait om gerecycled materiaal. Het legt vast welk percentage van een product uit gerecyclede grondstof bestaat en volgt dat door de hele productieketen, zodat de claim controleerbaar is. Daarnaast stelt GRS eisen aan milieubeheer en aan sociale omstandigheden in de fabriek. Wat GRS niet doet, is uitgebreid testen op schadelijke stoffen zoals OEKO-TEX dat wel doet.',
      ]},
      { h: 'Waarom je beide kunt tegenkomen', p: [
        'De twee keurmerken vullen elkaar aan. Een kledingstuk kan zowel OEKO-TEX Standard 100 als GRS hebben: het is dan getest op schadelijke stoffen én bevat aantoonbaar gerecycled materiaal. Zie je maar een van de twee, weet dan wat het wel en niet zegt. Een "gerecycled" label zonder GRS of vergelijkbare controle is lastiger te vertrouwen.',
      ]},
      { h: 'Waar je in de praktijk op let', p: [
        'Wil je voor je team duurzamere keuzes maken, kijk dan naar deze keurmerken in plaats van naar losse marketingteksten als "eco" of "groen", want die zijn niet beschermd. Vraag ons gerust welke modellen OEKO-TEX of GRS hebben. We zijn er eerlijk over: niet alles is gecertificeerd, en soms is een stevig kledingstuk dat tien jaar meegaat duurzamer dan een gerecycled stuk dat snel slijt.',
      ]},
    ],
    relatedBranche: 'representatief',
  },
  {
    slug: 'werkhandschoenen-en-388',
    title: 'Werkhandschoenen kiezen: de norm EN 388 uitgelegd',
    category: 'Veiligheid en normen',
    metaTitle: 'Werkhandschoenen norm EN 388:2016 uitgelegd',
    metaDescription:
      'Wat betekenen de cijfers en letters op werkhandschoenen? We leggen EN 388:2016 uit: schuren, snijden, scheuren, perforatie en de ISO 13997-snijtest.',
    date: '2026-06-20',
    intro:
      'De cijfers en letters onder het hamertje-pictogram op een werkhandschoen komen uit EN 388. Ze geven aan hoe goed de handschoen beschermt tegen schuren, snijden, scheuren en perforatie. Sinds de versie van 2016 is er een betrouwbaardere snijtest bijgekomen, aangeduid met een letter A tot F.',
    sections: [
      { h: 'Wat de cijfers betekenen', p: [
        'Onder het pictogram staan eerst vier cijfers. Het eerste is de schuurweerstand (1 tot 4), het tweede de snijweerstand volgens de oude coup-test (1 tot 5), het derde de scheurweerstand (1 tot 4) en het vierde de perforatieweerstand (1 tot 4). Hoe hoger het cijfer, hoe beter de bescherming op dat punt. Een X betekent dat er niet op getest is.',
      ]},
      { h: 'De letters: snijtest en impact', p: [
        'Na de cijfers kan een letter staan voor de snijweerstand volgens de TDM-test (EN ISO 13997). Die loopt van A tot F, waarbij F het hoogst is. Deze test is in 2016 toegevoegd omdat de oude coup-test onbetrouwbaar kon zijn: het mesje werd bot tijdens het testen van sterke materialen, wat de uitkomst vertekende. Staat er daarna nog een P, dan is de handschoen ook getest op impactbescherming op de knokkels.',
      ]},
      { h: 'Welke handschoen bij welk werk', p: [
        'Voor algemeen montagewerk volstaat vaak een handschoen met een redelijke schuur- en snijweerstand. Werk je met plaatmateriaal, glas of scherpe randen, dan let je op een hoge snijweerstand, dus een hoge letter in de ISO 13997-test. In de bouw bij sloop of zwaar werk telt impactbescherming mee. Een handschoen die te zwaar is voor het werk zit onhandig en wordt minder gedragen, dus overdrijf het niet.',
      ]},
      { h: 'Pasvorm en gebruik', p: [
        'Een handschoen die niet past, beschermt minder en wordt sneller uitgetrokken. Let op de maat en op grip, zeker bij nat of vettig werk. EN 388 zegt iets over de mechanische bescherming, maar niet over chemicaliën of warmte, daar gelden weer andere normen voor. We helpen je de juiste handschoen bij je werk te kiezen.',
      ]},
    ],
    relatedBranche: 'bouw-en-infra',
  },
  {
    slug: 'overgang-en-iso-20345-2022-veiligheidsschoenen',
    title: 'EN ISO 20345:2022: wat verandert er aan veiligheidsschoenen?',
    category: 'Veiligheid en normen',
    metaTitle: 'EN ISO 20345:2022: oude vs nieuwe schoennorm',
    metaDescription:
      'De norm voor veiligheidsschoenen is vernieuwd. Wat verandert er, wat betekenen de nieuwe codes en tot wanneer mag de oude norm nog gelden? Een praktische uitleg.',
    date: '2026-06-21',
    intro:
      'De norm EN ISO 20345:2022 verving de versie uit 2011. De grootste wijzigingen: nieuwe klassen S6 en S7 voor waterdichte schoenen, een preciezere aanduiding van de doorstapbescherming (P, PL, PS) en een strengere antisliptest. Oude en nieuwe norm mogen tijdens een overgangsperiode naast elkaar bestaan.',
    sections: [
      { h: 'Nieuwe klassen S6 en S7', p: [
        'De bekende klassen S1, S2 en S3 blijven bestaan. Daar zijn S6 en S7 bijgekomen voor volledig waterdichte schoenen. S6 is in feite een S2 met een waterdichte uitvoering, S7 is een S3 met diezelfde waterdichtheid. Deze schoenen zijn standaard voorzien van een membraan dat de schoen minimaal een bepaalde tijd waterdicht houdt. Voor wie de hele dag in nat werk staat, is dat een duidelijke aanvulling.',
      ]},
      { h: 'Preciezere doorstapbescherming', p: [
        'In de oude norm zag je een losse P voor doorstapbescherming. Nu wordt aangegeven waar die van gemaakt is. P staat voor een metalen tussenzool, getest tegen een pen van 4,5 mm. PL en PS staan voor metaalvrije, textiele tussenzolen: PL is getest met een pen van 4,5 mm, PS met een dunnere pen van 3 mm. Metaalvrije zolen zijn lichter en geleiden geen kou, maar bescherming tegen heel dunne spijkers vraagt aandacht.',
      ]},
      { h: 'Andere wijzigingen', p: [
        'De antisliptest is aangepast en strenger geworden, en de eisen rond grip op laddersporten zijn toegevoegd. Voor de meeste gebruikers verandert er in de praktijk weinig aan hoe een schoen aanvoelt, maar de markering op de schoen is preciezer geworden.',
      ]},
      { h: 'Oude en nieuwe norm naast elkaar', p: [
        'Er geldt een overgangsperiode tot eind 2027, waarin schoenen volgens zowel de oude als de nieuwe norm verkocht mogen worden. Zie je dus nog een S3 zonder de nieuwe codes, dan is dat gewoon goed gekeurd. Twijfel je wat de markering op een specifieke schoen betekent voor jouw werk, dan leggen we het per model uit. Zie ook ons artikel over het kiezen van de juiste veiligheidsklasse.',
      ]},
    ],
    relatedBranche: 'bouw-en-infra',
  },
];

export const artikelenBySlug = Object.fromEntries(artikelen.map((a) => [a.slug, a]));
