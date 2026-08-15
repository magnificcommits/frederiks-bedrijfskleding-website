/**
 * Normeringen voor werkkleding en veiligheidsschoenen.
 *
 * Iemand die "EN ISO 20471 klasse 3" intypt heeft geen behoefte aan een
 * folder, maar aan één duidelijk antwoord: welke klasse heb ik nodig en
 * waarom. Per norm staat daarom bovenaan de beslisregel — de enige vraag die
 * je moet beantwoorden — en daarna pas de tabel met de details.
 *
 * De teksten blijven bewust weg bij wetsartikelen. Wat er in de Arbowet staat
 * verandert; wat een klasse 3-jas op een donkere weg doet niet.
 */

export type NormCategorie = 'zichtbaarheid' | 'hitte-en-vlam' | 'weer' | 'schoenen' | 'overig';

export type NormKlasse = {
  /** Klasse, letter of markering zoals die op het label staat. */
  naam: string;
  /** Wat er precies getest of geëist wordt. */
  eis: string;
  /** In welke werksituatie je hiervoor kiest. */
  wanneer: string;
};

export type Norm = {
  slug: string;
  code: string;
  titel: string;
  korteTitel: string;
  categorie: NormCategorie;
  /** Eén regel voor het overzicht. */
  eenRegel: string;
  metaDescription: string;
  /** Twee à drie zinnen die de norm aan echt werk koppelen. */
  intro: string;
  /** De enige vraag die de koper hoeft te beantwoorden. */
  beslisregel: string;
  klassen: NormKlasse[];
  tabelKoppen?: [string, string, string];
  /** De praktische waarschuwing die mensen bespaart dat ze twee keer kopen. */
  nuance: string;
  veelgesteld: { q: string; a: string }[];
  /** Categorieën uit de catalogus die bij deze norm horen. */
  productCategorieSlugs: string[];
  /**
   * Waar we in het normeringsveld van een artikel op zoeken. Alleen het
   * nummer: leveranciers schrijven "EN ISO 20471", "EN20471" en
   * "ISO 20471:2013" door elkaar heen.
   */
  zoekCodes: string[];
};

export const normen: Norm[] = [
  {
    slug: 'en-iso-20471',
    code: 'EN ISO 20471',
    titel: 'EN ISO 20471: zichtbare werkkleding in klasse 1, 2 en 3',
    korteTitel: 'Zichtbaarheid (hi-vis)',
    categorie: 'zichtbaarheid',
    eenRegel: 'Bepaalt hoeveel fluorescerend en reflecterend materiaal een kledingstuk heeft, en dus hoe vroeg een chauffeur je ziet.',
    metaDescription: 'EN ISO 20471 klasse 1, 2 en 3 uitgelegd: hoeveel fluorescerend en reflecterend oppervlak, wat Rijkswaterstaat eist en welke klasse bij jouw werk past.',
    intro:
      'Een chauffeur op een donkere provinciale weg ziet je pas als je oplicht in zijn koplampen. EN ISO 20471 legt vast hoeveel fluorescerend en hoeveel reflecterend materiaal een kledingstuk moet hebben en vertaalt dat naar klasse 1, 2 of 3. Hoe hoger de klasse, hoe meer oppervlak er oplicht, en hoe eerder iemand van zijn gas gaat.',
    beslisregel:
      'Hoe hard rijdt het verkeer waar jij staat: nauwelijks en op een afgesloten terrein (klasse 1), op een bouwplaats of een weg binnen de bebouwde kom (klasse 2), of langs een auto(snel)weg en in het donker (klasse 3)?',
    tabelKoppen: ['Klasse', 'Minimaal oppervlak', 'Wanneer je die kiest'],
    klassen: [
      {
        naam: 'Klasse 1',
        eis: '0,14 m² fluorescerend materiaal en 0,10 m² reflecterend materiaal.',
        wanneer: 'Alleen bij laag risico: afgesloten terrein, langzaam intern verkeer, bij daglicht. Denk aan een hesje over de kleding bij een bezoek aan de werkplaats.',
      },
      {
        naam: 'Klasse 2',
        eis: '0,50 m² fluorescerend materiaal en 0,13 m² reflecterend materiaal.',
        wanneer: 'Werk op en langs wegen binnen de bebouwde kom, op bouwplaatsen en op bedrijfsterreinen met rijdend materieel. De meest gedragen klasse in Nederland.',
      },
      {
        naam: 'Klasse 3',
        eis: '0,80 m² fluorescerend materiaal en 0,20 m² reflecterend materiaal.',
        wanneer: 'Langs auto(snel)wegen, bij duisternis, mist en regen. Rijkswaterstaat houdt klasse 3 aan voor werk op en langs rijkswegen. Alleen te halen met mouwen: een mouwloos hesje wordt nooit klasse 3.',
      },
    ],
    nuance:
      'Klassen zijn optelbaar, maar niet zomaar. Een klasse 1-broek met een klasse 2-jas kan samen klasse 3 opleveren, mits de fabrikant die combinatie als set heeft laten testen; dan staat het op het label van beide stukken. Trek je de jas uit, dan val je terug op de klasse van de broek alleen — dus wie in de zomer zijn jas uitdoet moet daaronder al zichtbaar genoeg zijn. Let daarnaast op wassen: fluorescerend geel verbleekt, en verbleekt materiaal telt niet meer mee, ook al is de jas verder heel.',
    veelgesteld: [
      {
        q: 'Wat eist Rijkswaterstaat precies?',
        a: 'Voor werk op en langs rijkswegen houdt Rijkswaterstaat klasse 3 aan, overdag en in het donker. Bij gemeenten en provincies wisselt het per opdrachtgever: klasse 2 is daar vaak de ondergrens en klasse 3 zodra het donker wordt of het verkeer hard rijdt. Kijk in het bestek of in de veiligheidseisen van de opdrachtgever voordat je bestelt, dat scheelt een tweede ronde.',
      },
      {
        q: 'Is een fluorescerend hesje over gewone kleding genoeg?',
        a: 'Voor kort werk op een rustig terrein wel, en het is de goedkoopste manier om aan klasse 2 te komen. Maar een hesje schuift, raakt vies en verdwijnt onder een jas zodra het gaat regenen. Werk je elke dag langs verkeer, dan is een jas of broek in de juiste klasse comfortabeler en langer betrouwbaar.',
      },
      {
        q: 'Hoe lang blijft hi-vis kleding goedgekeurd?',
        a: 'Zolang de fluorescerende kleur helder is en de reflecterende banden heel zijn. Het label vermeldt het maximale aantal wasbeurten waarbij de eigenschappen zijn getest. Verbleekt, vlekkerig of gescheurd materiaal voldoet niet meer, hoe goed de rest van het kledingstuk er ook uitziet. Een jas die olie of teer over de banden heeft, is klaar.',
      },
    ],
    productCategorieSlugs: ['jassen', 'broeken', 't-shirts-en-polos', 'bodywarmers', 'truien-en-vesten'],
    zoekCodes: ['20471'],
  },

  {
    slug: 'en-iso-11612',
    code: 'EN ISO 11612',
    titel: 'EN ISO 11612: bescherming tegen hitte en vlammen',
    korteTitel: 'Hitte en vlammen',
    categorie: 'hitte-en-vlam',
    eenRegel: 'Kleding die zichzelf dooft en die je een aantal seconden beschermt tegen vlam, straling of spatten vloeibaar metaal.',
    metaDescription: 'EN ISO 11612 uitgelegd: wat de letters A tot F betekenen, welke code bij jouw hitte hoort en waar je op let bij het kiezen van vlamvertragende werkkleding.',
    intro:
      'In een gieterij, bij een oven of in de petrochemie gaat het om de seconden waarin je wegkomt. Kleding volgens EN ISO 11612 dooft zichzelf, smelt niet aan je huid vast en houdt de warmte lang genoeg tegen om afstand te maken. Welke soort hitte op je afkomt bepaalt welke letters er op het label moeten staan.',
    beslisregel:
      'Welke vorm van hitte komt op jou af: vlam, uitstralende warmte, hete lucht, contact met een heet oppervlak, of spatten vloeibaar aluminium of ijzer?',
    tabelKoppen: ['Code', 'Waar de test op ziet', 'Wanneer je die nodig hebt'],
    klassen: [
      {
        naam: 'A1 / A2',
        eis: 'Beperkte vlamverspreiding: A1 bij ontsteking aan het oppervlak, A2 bij ontsteking aan de rand van de stof.',
        wanneer: 'Het basisniveau. Elk kledingstuk volgens deze norm heeft A1, A2 of allebei. Zonder A geen 11612.',
      },
      {
        naam: 'B1 tot B3',
        eis: 'Convectieve warmte: hete lucht en vlam die de stof raken. Een hoger cijfer betekent meer seconden voordat je een brandwond oploopt.',
        wanneer: 'Werk bij open vuur, branders en ovens waar de vlam je kan raken.',
      },
      {
        naam: 'C1 tot C4',
        eis: 'Stralingswarmte: de hitte die je op afstand al voelt.',
        wanneer: 'Voor de oven, het smeltbad of een grote brand die je van een meter of meer moet kunnen benaderen.',
      },
      {
        naam: 'D1 tot D3',
        eis: 'Spatten vloeibaar aluminium.',
        wanneer: 'Aluminiumgieterijen en -smelterijen.',
      },
      {
        naam: 'E1 tot E3',
        eis: 'Spatten vloeibaar ijzer.',
        wanneer: 'IJzer- en staalgieterijen. Aluminium en ijzer zijn aparte tests: de een dekt de ander niet.',
      },
      {
        naam: 'F1 tot F3',
        eis: 'Contactwarmte: aanraking met een heet oppervlak.',
        wanneer: 'Als je met je onderarm of bovenbeen langs hete leidingen, ovendeuren of werkstukken strijkt.',
      },
    ],
    nuance:
      'Let op de logica achter de letters: elk kledingstuk moet A1 of A2 halen én minstens één van B tot en met F. Een hoog cijfer op één letter zegt niets over de rest — een jas met C4 kan bij spatten vloeibaar ijzer alsnog tekortschieten. Minstens zo belangrijk is wat je eronder draagt: een polyester T-shirt onder een vlamvertragende jas smelt en maakt de wond juist erger. En de kleding werkt alleen dicht: mouwen omlaag, rits tot boven, geen opgestroopte pijp.',
    veelgesteld: [
      {
        q: 'Is EN ISO 11612 hetzelfde als vlamvertragend?',
        a: 'Vlamvertragend is een eigenschap, EN ISO 11612 is de test die laat zien hoeveel die eigenschap waard is. Een stof kan vlamvertragend heten en toch zakken voor de norm. Kijk daarom naar de letters en cijfers op het label en niet naar het woord in de folder.',
      },
      {
        q: 'Mag ik deze kleding thuis wassen?',
        a: 'Liever niet. Wasverzachter en een te hoge temperatuur tasten de vlamvertragende werking aan, en ook bij inherent vlamvertragende stoffen hoort er een vast wasregime bij. Voor teams die er dagelijks mee werken regelen we het wassen liever centraal, dan weet je zeker dat het goed gaat.',
      },
      {
        q: 'Hoeveel sets heeft iemand nodig?',
        a: 'Reken op minimaal drie: één aan, één in de was, één in reserve. Kleding die doordrenkt is met olie of vet is niet meer vlamvertragend — het vet vat wel degelijk vlam. Je wilt dus nooit dat iemand een vieze jas nog een dag aanhoudt omdat er geen schone hangt.',
      },
    ],
    productCategorieSlugs: ['overalls', 'broeken', 'jassen', 'truien-en-vesten'],
    zoekCodes: ['11612'],
  },

  {
    slug: 'en-iso-11611',
    code: 'EN ISO 11611',
    titel: 'EN ISO 11611: kleding voor lassen en verwante processen',
    korteTitel: 'Lassen',
    categorie: 'hitte-en-vlam',
    eenRegel: 'Lasserskleding in klasse 1 of 2, afhankelijk van hoeveel spatten en straling jouw lasproces geeft.',
    metaDescription: 'EN ISO 11611 klasse 1 of 2 kiezen: welk lasproces vraagt welke klasse, wat A1 en A2 betekenen en waar lasserskleding in de praktijk op stukloopt.',
    intro:
      'Een lasser krijgt zelden een vlam over zich heen, maar wel een regen van gloeiende spatten en de uv-straling van de boog. EN ISO 11611 test kleding precies daarop: hoeveel druppels gesmolten metaal de stof verdraagt voordat de warmte erdoorheen komt, en of het materiaal de straling tegenhoudt. Er zijn maar twee klassen, en welke je nodig hebt volgt rechtstreeks uit je lasproces.',
    beslisregel:
      'Las je licht en met weinig spatten (TIG, gasbooglassen, puntlassen: klasse 1) of zwaar met veel spatten (MMA, MAG, plasmasnijden, gutsen: klasse 2)?',
    tabelKoppen: ['Klasse', 'Wat er getest is', 'Bij welk werk'],
    klassen: [
      {
        naam: 'Klasse 1',
        eis: 'Getest met 15 druppels gesmolten metaal, en op bescherming tegen kortstondig contact met onder spanning staande delen van het lascircuit.',
        wanneer: 'Lichtere processen en omstandigheden: TIG, gasbooglassen, puntlassen, machinaal lassen met weinig spatten.',
      },
      {
        naam: 'Klasse 2',
        eis: 'Getest met 25 druppels gesmolten metaal en zwaardere eisen aan de doorlating van straling.',
        wanneer: 'Processen met veel spatten en meer straling: MMA met beklede elektrode, MAG, plasmasnijden, gutsen, autogeen snijden en thermisch spuiten. Ook bij lassen boven het hoofd of in een besloten ruimte.',
      },
      {
        naam: 'A1 / A2',
        eis: 'Beperkte vlamverspreiding, gemeten bij ontsteking aan het oppervlak (A1) of aan de rand van de stof (A2).',
        wanneer: 'Staat naast de klasse op het label. A1 en A2 samen dekt beide situaties en is voor lassen de prettigste keuze.',
      },
    ],
    nuance:
      'Twijfel je tussen klasse 1 en 2, kies dan 2: het prijsverschil is klein, het verschil bij lassen boven je hoofd niet. Verder telt de afwerking net zo hard als de stof. Zakken zonder klep vangen spatten, een opgerolde mouw en een openstaande boord zijn precies de plekken waar het misgaat, en een lasser met een gewone spijkerbroek eronder is nog steeds onbeschermd. Let ook op olie en vet in het textiel: dat vat vlam, hoe goed de kleding verder ook getest is.',
    veelgesteld: [
      {
        q: 'Is EN ISO 11611 genoeg, of heb ik ook 11612 nodig?',
        a: 'Voor het lassen zelf is 11611 de juiste norm; die is speciaal getest op spatten en boogstraling. Werk je daarnaast bij ovens of met vloeibaar metaal, dan wil je ook EN ISO 11612 op het label zien. Veel lasserskleding is op beide normen gecertificeerd, dat scheelt twee garderobes.',
      },
      {
        q: 'Beschermt lasserskleding tegen elektrische schok?',
        a: 'Alleen beperkt, en alleen tegen kortstondig contact met onder spanning staande delen van het lascircuit bij droge omstandigheden. Tegen netspanning of tegen een vlamboog uit een schakelkast doet deze norm niets. Daarvoor kijk je naar IEC 61482.',
      },
      {
        q: 'Waarom is katoen hier vaak beter dan polyester?',
        a: 'Onbehandeld polyester smelt bij een spat en plakt aan de huid. Lasserskleding is daarom van vlamvertragend behandeld katoen of van een vezel die inherent vlamvertragend is. Dat draagt prettig, ademt en houdt de spatten tegen zonder te smelten.',
      },
    ],
    productCategorieSlugs: ['overalls', 'jassen', 'broeken'],
    zoekCodes: ['11611'],
  },

  {
    slug: 'en-1149-5',
    code: 'EN 1149-5',
    titel: 'EN 1149-5: antistatische werkkleding',
    korteTitel: 'Antistatisch',
    categorie: 'overig',
    eenRegel: 'Kleding die statische lading afvoert in plaats van opbouwt, voor plekken waar één vonk te veel is.',
    metaDescription: 'EN 1149-5 uitgelegd: wanneer je antistatische werkkleding nodig hebt, waarom die alleen werkt in combinatie met de juiste schoenen, en wat de norm niet dekt.',
    intro:
      'Een trui die knettert als je hem uittrekt is thuis onschuldig. Bij een tankwagen, in een spuitcabine of in een ruimte met meel- of houtstof in de lucht is diezelfde vonk een ontstekingsbron. EN 1149-5 stelt eisen aan kleding die de lading laat weglopen voordat die zich kan ontladen.',
    beslisregel:
      'Kan er op jouw werkplek brandbaar gas, damp of stof in de lucht zitten — staat er met andere woorden een zone-indeling op de plattegrond?',
    tabelKoppen: ['Onderdeel van de norm', 'Wat er gemeten of geëist wordt', 'Wat dat voor jou betekent'],
    klassen: [
      {
        naam: 'EN 1149-1',
        eis: 'De oppervlakteweerstand van het materiaal.',
        wanneer: 'De klassieke meetmethode. Staat op het label als de stof daarop getest is.',
      },
      {
        naam: 'EN 1149-3',
        eis: 'Ladingsafvoer: hoe snel een aangebrachte lading weer wegvloeit.',
        wanneer: 'Gebruikelijk bij stoffen met een fijn raster van koolstofdraadjes. Werkt ook bij lage luchtvochtigheid, waar de oppervlaktemeting het laat afweten.',
      },
      {
        naam: 'Ontwerpeis',
        eis: 'Alle geleidende delen zijn permanent bedekt en de kleding wordt volledig gesloten gedragen.',
        wanneer: 'Geldt altijd, welke meetmethode er ook gebruikt is. Een openhangende jas voldoet niet, ook al is de stof goedgekeurd.',
      },
    ],
    nuance:
      'Deze norm kent geen klassen: je voldoet eraan of niet. Belangrijker is wat er níet in staat. Antistatische kleding werkt alleen als de lading ergens naartoe kan, dus samen met antistatische schoenen en een geleidende vloer — anders blijft de lading gewoon op je lijf staan. De norm geldt niet in een zuurstofrijke omgeving en beschermt niet tegen netspanning. En je moet het hele pakket meenemen: een antistatische overall met een polyester fleecevest eroverheen maakt de vonk alsnog.',
    veelgesteld: [
      {
        q: 'Is antistatisch hetzelfde als ESD?',
        a: 'In de praktijk gebruiken mensen het door elkaar, maar het doel verschilt. EN 1149-5 gaat over het voorkomen van een ontsteking in een explosiegevaarlijke omgeving. ESD-kleding gaat over het beschermen van elektronica tegen een ontlading. Veel kleding voldoet aan allebei, maar controleer welke van de twee je opdrachtgever vraagt.',
      },
      {
        q: 'Mag ik antistatische kleding gewoon wassen?',
        a: 'Ja, maar zonder wasverzachter: die legt een laagje op de vezel dat de geleiding tegenwerkt. Op het label staat het aantal wasbeurten waarbij de eigenschappen zijn getest. Bij intensief gebruik is industrieel wassen de veiligste route, dan blijft het meetbaar.',
      },
      {
        q: 'Werkt het ook als ik er een gewone bodywarmer over trek?',
        a: 'Nee. Zodra je een niet-antistatische laag aan de buitenkant draagt, kan die laag zich opladen en ben je terug bij af. Alle buitenlagen — jas, bodywarmer, muts — moeten aan dezelfde eis voldoen.',
      },
    ],
    productCategorieSlugs: ['overalls', 'broeken', 'jassen', 't-shirts-en-polos'],
    zoekCodes: ['1149'],
  },

  {
    slug: 'en-13034',
    code: 'EN 13034',
    titel: 'EN 13034: beperkte bescherming tegen vloeibare chemicaliën (type 6)',
    korteTitel: 'Chemicaliën, type 6',
    categorie: 'overig',
    eenRegel: 'Het lichtste niveau chemiebescherming: tegen nevel en kleine spatten, niet tegen een straal of een plas.',
    metaDescription: 'EN 13034 en type 6 uitgelegd: waartegen deze kleding wel en niet beschermt, het verschil met type PB en waar je op let bij naden en hergebruik.',
    intro:
      'Wie gewasbeschermingsmiddelen aanmaakt, met agressieve reinigers werkt of naast een pomp staat die kan spuiten, krijgt geen bad over zich heen maar wel een fijne nevel of een spat. EN 13034 is voor precies dat risico: type 6, het lichtste niveau chemiebescherming. De stof stoot de vloeistof af zodat je de tijd hebt om weg te lopen en je kleding uit te trekken.',
    beslisregel:
      'Kan er alleen nevel of een kleine spat op je terechtkomen (dan is type 6 genoeg), of sta je in een straal, een sproeinevel of aanhoudend contact (dan heb je een zwaarder type nodig)?',
    tabelKoppen: ['Uitvoering of test', 'Wat het inhoudt', 'Wanneer je die kiest'],
    klassen: [
      {
        naam: 'Type 6',
        eis: 'Volledige bescherming van het lichaam: een overall of een tweedelig pak dat als geheel getest is.',
        wanneer: 'Als er van alle kanten nevel op je kan komen: middelen aanmaken, spuiten, reinigen met agressieve producten.',
      },
      {
        naam: 'Type PB [6]',
        eis: 'Partial Body: gedeeltelijke bescherming, bijvoorbeeld een schort, een jas of mouwbeschermers.',
        wanneer: 'Als het risico beperkt blijft tot je voorkant of je armen, bijvoorbeeld bij afvullen of doseren aan een tafel.',
      },
      {
        naam: 'Afstotingstest',
        eis: 'De vloeistof moet van de stof afrollen in plaats van erin te trekken.',
        wanneer: 'Basiseis. Getest met een vaste set standaardchemicaliën, niet met jouw product.',
      },
      {
        naam: 'Penetratietest',
        eis: 'Hoeveel vloeistof er ondanks alles door de stof heen komt.',
        wanneer: 'Basiseis. Samen met de afstotingstest bepaalt dit of een stof slaagt voor type 6.',
      },
    ],
    nuance:
      'Type 6 is het lichtste van zes typen en juist daar gaat het vaak mis. De test gebruikt een vaste set standaardchemicaliën — onder meer zwavelzuur, natronloog, xyleen en butanol — en zegt niets over de specifieke stof waar jij mee werkt. Kijk dus altijd eerst in het veiligheidsinformatieblad van het middel. Naden zijn daarnaast de zwakke plek: een gewoon gestikte naad laat vloeistof door waar de stof dat niet doet. En het is bescherming voor even, geen dagjas: is een pak nat geworden, dan gaat het uit.',
    veelgesteld: [
      {
        q: 'Wat betekenen die typen 1 tot en met 6?',
        a: 'Ze lopen van zwaar naar licht. Type 1 en 2 zijn gasdichte pakken, type 3 is bestand tegen een vloeistofstraal onder druk, type 4 tegen sproeinevel, type 5 tegen vaste deeltjes en type 6 tegen lichte nevel en kleine spatten. Weet je niet zeker in welke situatie je zit, dan kijken we samen naar het middel en naar de handeling.',
      },
      {
        q: 'Kan ik een type 6-overall vaker gebruiken?',
        a: 'Er zijn wegwerpuitvoeringen en herbruikbare. Herbruikbaar kan prima, mits je wast volgens het label: de afstotende afwerking gaat er anders af en dat zie je niet aan de stof. Bij middelen met een hoog risico is wegwerp vaak verstandiger, juist omdat je dan zeker weet dat er niets in het textiel is achtergebleven.',
      },
      {
        q: 'Moet er dan ook nog iets om mijn handen en ogen?',
        a: 'Ja. Deze norm gaat alleen over kleding. Handschoenen, spatbril en schoeisel kies je apart bij het middel; het veiligheidsinformatieblad noemt meestal het handschoenmateriaal en hoe lang dat meegaat bij contact.',
      },
    ],
    productCategorieSlugs: ['overalls', 'jassen', 'broeken'],
    zoekCodes: ['13034'],
  },

  {
    slug: 'en-343',
    code: 'EN 343',
    titel: 'EN 343: bescherming tegen regen',
    korteTitel: 'Regen',
    categorie: 'weer',
    eenRegel: 'Waterdichtheid en ademend vermogen in twee cijfers, van klasse 1 tot en met 4.',
    metaDescription: 'EN 343 uitgelegd: wat de twee cijfers op het label van een regenjas betekenen, welke klasse bij jouw werk hoort en waarom ademend vermogen net zo hard telt.',
    intro:
      'Een regenjas die geen water doorlaat maar ook geen zweet doorlaat maakt je alsnog nat, alleen dan van binnenuit. EN 343 test daarom twee dingen tegelijk: hoeveel waterdruk de stof tegenhoudt en hoe goed waterdamp naar buiten kan. Op het label staan twee cijfers, en die vertellen samen of een jas past bij hoe hard jij werkt.',
    beslisregel:
      'Sta je in de regen te wachten (dan telt vooral het bovenste cijfer, de waterdichtheid) of werk je door in de regen (dan telt het onderste cijfer, het ademend vermogen, net zo hard)?',
    tabelKoppen: ['Klasse', 'Eis aan waterdichtheid', 'Wanneer je die kiest'],
    klassen: [
      {
        naam: 'Klasse 1',
        eis: 'Het laagste niveau: de stof houdt lichte regen tegen, maar wordt niet nabehandeld getest.',
        wanneer: 'Even naar buiten, een bui uitzitten. Niet voor een hele dag in de regen.',
      },
      {
        naam: 'Klasse 2',
        eis: 'Waterkolom van minimaal 8.000 Pa, ook nadat de stof is gewassen en geschuurd.',
        wanneer: 'De gangbare klasse voor buitenwerk in Nederlands weer: bezorging, groenvoorziening, montage buiten.',
      },
      {
        naam: 'Klasse 3',
        eis: 'Zwaardere eis aan de waterkolom dan klasse 2, eveneens na voorbehandeling.',
        wanneer: 'Aanhoudende regen en wind, en werk waarbij je knielt of tegen natte oppervlakken leunt.',
      },
      {
        naam: 'Klasse 4',
        eis: 'De hoogste eis aan waterdichtheid in deze norm.',
        wanneer: 'Lange dagen buiten bij slecht weer, of werk waarbij nat worden simpelweg geen optie is.',
      },
    ],
    nuance:
      'Onder het pictogram staan twee cijfers: het bovenste voor waterdichtheid, het onderste voor ademend vermogen (Ret). Bij Ret geldt precies andersom dat een lagere gemeten waarde beter is; klasse 1 ademt het minst, klasse 4 het best. Een jas van 4/1 houdt alles buiten maar kookt je gaar zodra je gaat sjouwen — voor actief werk is een evenwichtige 3/3 prettiger dan de maximale waterkolom. Sinds de herziening van 2019 kan er ook een R op het label staan: dan is de complete jas onder een regendouche getest, inclusief naden en ritsen. En daar lekt het meestal.',
    veelgesteld: [
      {
        q: 'Waterdicht of waterafstotend, wat is het verschil?',
        a: 'Waterafstotend betekent dat de buitenkant water afstoot zolang de coating heel is; dat is geen normering en niemand heeft het gemeten. Waterdicht volgens EN 343 is wel gemeten, inclusief de naden. Een jas zonder EN 343-label kan best een bui doorstaan, maar je weet niet hoelang.',
      },
      {
        q: 'Waarom lekt mijn jas na een jaar toch?',
        a: 'Meestal is niet het membraan stuk maar de afstotende laag aan de buitenkant. De buitenstof zuigt zich dan vol, het ademend vermogen stort in en de jas voelt vanbinnen klam. Wassen volgens het label en af en toe opnieuw impregneren helpt echt, en is een stuk goedkoper dan een nieuwe jas.',
      },
      {
        q: 'Kan een regenjas ook zichtbaar of gevoerd zijn?',
        a: 'Ja, en dat is voor buitenwerk de gangbare keuze. Een jas kan tegelijk op EN 343 en EN ISO 20471 gecertificeerd zijn, en met een uitritsbare voering dek je er drie seizoenen mee af. Voor echte vrieskou kijk je naar EN 342.',
      },
    ],
    productCategorieSlugs: ['jassen', 'broeken', 'bodywarmers'],
    zoekCodes: ['343'],
  },

  {
    slug: 'en-342',
    code: 'EN 342',
    titel: 'EN 342: bescherming tegen kou',
    korteTitel: 'Kou',
    categorie: 'weer',
    eenRegel: 'Voor werk in de vrieskou: isolatiewaarde, winddichtheid en waterdichtheid van een compleet pak.',
    metaDescription: 'EN 342 uitgelegd: wat de isolatiewaarde op het label zegt, waarom de norm een compleet pak beoordeelt en hoe je kiest tussen stilstaan en doorwerken in de kou.',
    intro:
      'In een vrieshuis of op een winterse bouwplaats gaat het niet om één jas maar om alles wat je aanhebt. EN 342 test daarom een compleet pak — jas met broek, of een overall — op isolatie bij temperaturen onder min 5 graden. Wat er op het label staat vertelt hoe lang je bij welke temperatuur kunt werken.',
    beslisregel:
      'Hoe koud is het waar jij staat, en beweeg je daar of sta je stil — want stilstaan in de vrieskou vraagt veel meer isolatie dan doorwerken.',
    tabelKoppen: ['Aanduiding op het label', 'Wat het zegt', 'Waar je op let'],
    klassen: [
      {
        naam: 'Isolatiewaarde',
        eis: 'De gemeten warmte-isolatie van het complete pak, uitgedrukt in vierkante meter kelvin per watt.',
        wanneer: 'Het belangrijkste getal. De fabrikant levert er een tabel bij: bij welke temperatuur je hoeveel uur kunt werken, apart voor stilstaan en voor licht werk.',
      },
      {
        naam: 'Luchtdoorlatendheid, klasse 1 tot 3',
        eis: 'Hoeveel wind er door de stof heen komt. Klasse 3 is de strengste en dus nagenoeg winddicht.',
        wanneer: 'Buitenwerk met wind: kies klasse 3. In een vrieshuis zonder tocht volstaat klasse 1 of 2 en draagt het pak lichter.',
      },
      {
        naam: 'Waterdichtheid, klasse 1 of 2',
        eis: 'Optionele eis; klasse 2 is de strengste.',
        wanneer: 'Zodra sneeuw op je kleding smelt of je met nat product werkt. Natte isolatie is geen isolatie meer.',
      },
    ],
    nuance:
      'EN 342 beoordeelt een pak en niet een los kledingstuk. Combineer je een gecertificeerde jas met een gewone werkbroek, dan geldt de opgegeven waarde niet meer. Twee dingen bepalen in de praktijk of iemand het volhoudt. Ten eerste de laag tegen je huid: zweet dat blijft hangen koelt je sneller uit dan de kou zelf, dus geen katoen eronder. Ten tweede vallen handen, hoofd en voeten buiten deze norm, terwijl je het daar het eerst voelt. Werk je tussen 0 en min 5 graden, dan is EN 14058 de norm die daarbij hoort; EN 342 begint pas onder min 5.',
    veelgesteld: [
      {
        q: 'Wat moet ik met dat getal bij de isolatiewaarde?',
        a: 'Zelf hoef je er niets mee te rekenen. Bij de kleding hoort een tabel waarin staat bij welke temperatuur je hoeveel uur kunt werken, apart voor stilstaan en voor licht werk. Die tabel is in de praktijk bruikbaarder dan het getal zelf.',
      },
      {
        q: 'Kan ik niet gewoon meer lagen aantrekken?',
        a: 'Tot op zekere hoogte. Meer lagen isoleren beter, maar zodra kleding strak komt te zitten pers je de lucht eruit en verlies je juist isolatie. Dat gebeurt vaak bij schoenen met een extra dikke sok erin. Een goed opgebouwd pakket met ruimte is warmer dan drie truien over elkaar.',
      },
      {
        q: 'Wat draag ik eronder in een vrieshuis?',
        a: 'Thermisch ondergoed dat vocht afvoert, dus geen katoen. Katoen houdt zweet vast en koelt daarna hard af. Daarboven een isolerende tussenlaag en pas dan de gecertificeerde buitenlaag.',
      },
    ],
    productCategorieSlugs: ['jassen', 'bodywarmers', 'broeken'],
    zoekCodes: ['342'],
  },

  {
    slug: 'iec-61482',
    code: 'IEC 61482',
    titel: 'IEC 61482: bescherming tegen vlambogen',
    korteTitel: 'Vlamboog',
    categorie: 'hitte-en-vlam',
    eenRegel: 'Voor werk aan of nabij installaties onder spanning: kleding die de hitteflits van een kortsluitboog opvangt.',
    metaDescription: 'IEC 61482 uitgelegd: het verschil tussen de box-test (APC 1 en 2) en de open-arc-test (ATPV en ELIM), en hoe je bepaalt welk niveau bij jouw installatie hoort.',
    intro:
      'Een vlamboog in een schakelkast duurt een fractie van een seconde en geeft in die tijd een hittestoot die gewone kleding laat ontbranden. IEC 61482 test kleding daar specifiek op. Wat je nodig hebt volgt niet uit een onderbuikgevoel, maar uit de berekening van de installatie waar je aan werkt.',
    beslisregel:
      'Hoeveel energie kan de vlamboog op jouw werkplek vrijmaken — dat getal komt uit de risicoanalyse van de installatie en staat er in cal/cm² of in kiloampère.',
    tabelKoppen: ['Testmethode en aanduiding', 'Wat er gemeten is', 'Wanneer je die aanhoudt'],
    klassen: [
      {
        naam: 'Box-test, APC 1',
        eis: 'Beproefd in een testopstelling met een boogstroom van 4 kA (IEC 61482-1-2).',
        wanneer: 'Het lagere niveau, voor installaties waar de berekening daaronder uitkomt. Vroeger stond dit als klasse 1 op het label.',
      },
      {
        naam: 'Box-test, APC 2',
        eis: 'Beproefd met een boogstroom van 7 kA (IEC 61482-1-2).',
        wanneer: 'Het zwaardere niveau. Gebruikelijk bij middenspanning en bij grotere verdeelinrichtingen.',
      },
      {
        naam: 'Open-arc, ATPV',
        eis: 'Waarde in cal/cm²: de energie waarbij de kans op een tweedegraads brandwond vijftig procent is (IEC 61482-1-1).',
        wanneer: 'Voor werk waar de risicoanalyse in cal/cm² rekent. Een hogere waarde betekent meer bescherming.',
      },
      {
        naam: 'Open-arc, EBT',
        eis: 'Waarde in cal/cm² waarbij de stof openbreekt in plaats van door te warmen.',
        wanneer: 'Wordt vermeld in plaats van ATPV als de stof eerder openscheurt dan doorwarmt. Je leest het op dezelfde manier.',
      },
    ],
    nuance:
      'Twee dingen worden vaak door elkaar gehaald. Ten eerste: de box-test en de open-arc-test zijn niet in elkaar om te rekenen. De box-test geeft een klasse (APC 1 of 2), de open-arc-test een waarde in cal/cm² — vraag je opdrachtgever in welke eenheid de risicoanalyse rekent. Ten tweede staat er sinds de herziening van 2019 naast ATPV vaak ook ELIM op het label: de behoudender waarde waarbij nog geen enkel testmonster de grens overschreed. Verder geldt hetzelfde als bij hitte: alles wat je eronder draagt telt mee, en één vlamboogbestendige jas over een polyester shirt is geen bescherming.',
    veelgesteld: [
      {
        q: 'Is vlamvertragende kleding automatisch ook vlamboogbestendig?',
        a: 'Nee. Bescherming tegen een vlamboog vraagt om een test met een echte boog. Een stof kan prima scoren op EN ISO 11612 en toch niet gecertificeerd zijn op IEC 61482. Kleding die aan allebei voldoet bestaat volop, maar het moet er letterlijk op staan.',
      },
      {
        q: 'Hoeveel lagen heb ik nodig?',
        a: 'Lagen tellen op, maar alleen als de combinatie zo getest is. Fabrikanten geven daarom laagcombinaties op met een gezamenlijke waarde. Zelf twee jassen over elkaar trekken en de waarden bij elkaar optellen mag niet en klopt ook niet.',
      },
      {
        q: 'En mijn helm, gezichtsscherm en handschoenen?',
        a: 'Die vallen buiten deze norm. Gezicht en handen zijn bij een vlamboog het kwetsbaarst, dus daar hoort een gezichtsscherm met een eigen vlamboogclassificatie bij en handschoenen die daarop getest zijn.',
      },
    ],
    productCategorieSlugs: ['jassen', 'broeken', 'overalls', 'truien-en-vesten'],
    zoekCodes: ['61482'],
  },

  {
    slug: 'en-iso-20345',
    code: 'EN ISO 20345',
    titel: 'EN ISO 20345: veiligheidsschoenen en hun S-klassen',
    korteTitel: 'Veiligheidsschoenen',
    categorie: 'schoenen',
    eenRegel: 'De code op je veiligheidsschoen: van S1 tot S3S, plus letters voor antislip, kou en hitte.',
    metaDescription: 'EN ISO 20345 uitgelegd: het verschil tussen S1, S1P, S2, S3 en S3S, wat SR, CI en HRO betekenen, en welke klasse bij jouw werk hoort.',
    intro:
      'Elke veiligheidsschoen begint hetzelfde: een neus die een klap van 200 joule opvangt. Wat daarna verschilt is de rest van de schoen — een bovenwerk dat water tegenhoudt, een inlage tegen spijkers, een geprofileerde zool. EN ISO 20345 vat die verschillen samen in een korte code, en die code kiezen is eigenlijk het enige wat je hoeft te doen.',
    beslisregel:
      'Waar loop je de hele dag: binnen en droog (S1), binnen met spijkers of scherp materiaal op de vloer (S1P), buiten en soms nat (S2), of buiten in modder en tussen bouwafval (S3 of S3S)?',
    tabelKoppen: ['Code', 'Wat de schoen extra heeft', 'Waar je hem voor kiest'],
    klassen: [
      {
        naam: 'S1',
        eis: 'Gesloten hielgedeelte, antistatisch, schokdemping in de hiel en een zool die bestand is tegen olie.',
        wanneer: 'Droge binnenruimtes: montage, magazijn, werkplaats zonder nat werk.',
      },
      {
        naam: 'S1P',
        eis: 'Alles van S1, plus doorstapbescherming in de zool.',
        wanneer: 'Dezelfde omgeving, maar met spijkers, schroeven of scherp materiaal op de vloer. Denk aan sloop- en afbouwwerk binnen.',
      },
      {
        naam: 'S2',
        eis: 'Alles van S1, plus een bovenwerk dat water tegenhoudt.',
        wanneer: 'Buitenwerk en natte binnenruimtes zonder doorstaprisico: groenvoorziening, foodverwerking, schoonmaak.',
      },
      {
        naam: 'S3',
        eis: 'Alles van S2, plus doorstapbescherming én een geprofileerde zool.',
        wanneer: 'De standaard voor bouw, installatie en industrie. Twijfel je, dan is dit meestal het antwoord.',
      },
      {
        naam: 'S3S',
        eis: 'S3 waarbij de doorstapbescherming is getest met een dunne spijker van 3,0 mm. Nieuw sinds de herziening van de norm.',
        wanneer: 'Zelfde werk als S3, maar de inlage is doorgaans van textiel: lichter, buigt mee en dekt de hele zool in plaats van alleen het middenstuk.',
      },
      {
        naam: 'SR',
        eis: 'Extra beproefde slipweerstand op een gladde, natte ondergrond.',
        wanneer: 'Keuken, foodverwerking en schoonmaak: overal waar de vloer glimt.',
      },
      {
        naam: 'CI',
        eis: 'Isolatie van de zool tegen kou.',
        wanneer: 'Vrieshuis, buitenwerk in de winter, of lang stilstaan op een betonvloer.',
      },
      {
        naam: 'HRO',
        eis: 'Zool die bestand is tegen contact met een heet oppervlak van 300 graden.',
        wanneer: 'Dakdekkers, asfaltploegen, gieterij en lassers.',
      },
    ],
    nuance:
      'De norm is herzien; sindsdien zie je naast S3 ook S3S en S3L, waarbij de L staat voor de test met een dikkere spijker van 4,5 mm en meestal een metalen inlage. Ook S6 en S7 zijn erbij gekomen, voor volledig waterdichte schoenen. Oude en nieuwe codes lopen nog een tijd door elkaar; kijk daarom naar wat de schoen kan en niet naar het jaartal. Het belangrijkste staat trouwens niet in de norm: pasvorm. Een halve maat te krap voel je pas na acht uur, en een schoen die niet lekker zit gaat uit — dan beschermt hij niemand meer.',
    veelgesteld: [
      {
        q: 'Wat is het verschil tussen S3 en S3S?',
        a: 'Alleen de manier waarop de doorstapbescherming is beproefd. Bij S3 gebeurt dat met een spijker van 4,5 mm en zit er vaak een stalen plaat in. Bij S3S is getest met een dunnere spijker van 3,0 mm en is de inlage meestal van textiel. Die textielinlage is lichter, buigt mee en beschermt de hele zool, ook onder de bal van je voet.',
      },
      {
        q: 'Moet er staal in de neus zitten?',
        a: 'Nee. Een composietneus haalt dezelfde 200 joule, weegt minder en geleidt geen kou. Voor buitenwerk in de winter of voor mensen die de hele dag lopen is composiet vaak prettiger. Werk je met heel zwaar materiaal, dan blijft staal een goede keuze.',
      },
      {
        q: 'Hoe vaak moeten werkschoenen vervangen worden?',
        a: 'Kijk naar het profiel en de neus, niet naar de kalender. Is het profiel glad, is de tussenzool ingezakt of heeft de neus een keer echt een klap gehad, dan is de schoen op — ook als het bovenwerk er nog netjes uitziet. Bij dagelijks bouwwerk is een jaar gebruikelijk. Kom gerust langs in Hengelo Gld om samen te kijken, of we komen bij jullie op locatie passen.',
      },
    ],
    productCategorieSlugs: ['werkschoenen'],
    zoekCodes: ['20345'],
  },

  {
    slug: 'en-14404',
    code: 'EN 14404',
    titel: 'EN 14404: kniebescherming voor werk op de knieën',
    korteTitel: 'Kniebescherming',
    categorie: 'overig',
    eenRegel: 'Vier typen kniebescherming en drie niveaus: welk type past bij de manier waarop jij knielt.',
    metaDescription: 'EN 14404 uitgelegd: het verschil tussen type 1 tot 4 kniebescherming, wat de niveaus 0, 1 en 2 betekenen en waarom losse kniezakken niet automatisch goedgekeurd zijn.',
    intro:
      'Tegelzetters, installateurs en monteurs staan een groot deel van hun werkdag op hun knieën. Slijtage aan de knie is een van de klachten waar mensen uiteindelijk mee stoppen met werken. EN 14404 test kniebeschermers op drukverdeling en op weerstand tegen scherp materiaal, en deelt ze in naar de manier waarop je ze draagt.',
    beslisregel:
      'Zit de bescherming aan je lijf, aan je broek of los op de grond, en kniel je op een vlakke vloer of op grind en puin?',
    tabelKoppen: ['Type of niveau', 'Wat het is', 'Wanneer je die kiest'],
    klassen: [
      {
        naam: 'Type 1',
        eis: 'Losse kniebeschermer met banden, onafhankelijk van de broek.',
        wanneer: 'Als je maar af en toe knielt of steeds een andere broek aanhebt.',
      },
      {
        naam: 'Type 2',
        eis: 'Inzetstuk in de kniezakken van een werkbroek.',
        wanneer: 'De gangbare keuze voor wie dagelijks knielt: hij zit altijd op de goede plek en zit niet in de weg bij lopen.',
      },
      {
        naam: 'Type 3',
        eis: 'Een mat of kussen waarop je knielt, niet aan het lichaam bevestigd.',
        wanneer: 'Voor werk op één plek: in een meterkast, aan een machine, bij een ketel.',
      },
      {
        naam: 'Type 4',
        eis: 'Kniebescherming als onderdeel van een groter hulpmiddel, bijvoorbeeld met een steunframe.',
        wanneer: 'Zeldzaam, maar bestaat voor specialistisch werk waarbij je lang in dezelfde houding zit.',
      },
      {
        naam: 'Niveau 0',
        eis: 'Bedoeld voor knielen op een vlakke ondergrond, zonder eis aan doorboring.',
        wanneer: 'Binnenwerk op een schone, vlakke vloer.',
      },
      {
        naam: 'Niveau 1',
        eis: 'Vlakke ondergrond, plus weerstand tegen doorboring.',
        wanneer: 'De meest gekozen uitvoering. Dekt afbouw, installatie en tegelwerk ruim af.',
      },
      {
        naam: 'Niveau 2',
        eis: 'Ook geschikt voor oneffen ondergrond zoals grind en puin, plus weerstand tegen doorboring.',
        wanneer: 'Buitenwerk, sloop, bestrating en ruwe bouwplaatsen.',
      },
    ],
    nuance:
      'De grootste valkuil zit bij type 2: een werkbroek met kniezakken is alleen gecertificeerd in combinatie met de kniebeschermer waarmee hij getest is. Stop je er een willekeurig schuimblokje in, dan vervalt de certificering en zit de bescherming bovendien vaak op de verkeerde hoogte — hij hoort je knieschijf te dekken als je knielt, niet als je staat. Let daarom ook op de lengtemaat van de broek: bij een te lange broek zakt de kniezak. En kniebescherming vervangt geen pauze: schuim zakt in en verliest zijn demping, vaak eerder dan mensen denken.',
    veelgesteld: [
      {
        q: 'Zijn kniezakken in een broek automatisch goedgekeurd?',
        a: 'Nee. De broek en de beschermer worden als combinatie getest, en die combinatie staat op het label. Een broek met lege kniezakken is gewoon een broek; er hoort een specifieke beschermer bij die erin past.',
      },
      {
        q: 'Welk type kiezen mensen meestal?',
        a: 'Type 2, het inzetstuk in de broek. Het zit altijd op de goede plek, je vergeet het niet en je struikelt er niet over als je even loopt. Losse beschermers met banden werken goed als je af en toe knielt, maar ze schuiven en knellen als je ze de hele dag draagt.',
      },
      {
        q: 'Hoe weet ik wanneer ze vervangen moeten worden?',
        a: 'Druk het schuim in met je duim. Veert het niet meer terug of voel je de vloer erdoorheen, dan is de demping op. Bij dagelijks knielwerk is dat sneller dan je verwacht, vaak binnen een jaar. Het is een kleine vervanging die veel scheelt.',
      },
    ],
    productCategorieSlugs: ['broeken', 'accessoires'],
    zoekCodes: ['14404'],
  },
];

export const normenBySlug: Record<string, Norm> = Object.fromEntries(
  normen.map((n) => [n.slug, n]),
);

export const normCategorieen: { key: NormCategorie; titel: string; intro: string }[] = [
  {
    key: 'zichtbaarheid',
    titel: 'Gezien worden',
    intro: 'Zodat een chauffeur of machinist je op tijd ziet staan.',
  },
  {
    key: 'hitte-en-vlam',
    titel: 'Hitte, vlammen en vlambogen',
    intro: 'Voor werk bij vuur, gesmolten metaal of installaties onder spanning.',
  },
  {
    key: 'weer',
    titel: 'Regen, wind en kou',
    intro: 'De normen die bepalen of je een werkdag buiten droog en warm doorkomt.',
  },
  {
    key: 'schoenen',
    titel: 'Voeten',
    intro: 'De code op je veiligheidsschoen, van voor naar achter uitgelegd.',
  },
  {
    key: 'overig',
    titel: 'Statische lading, chemie en knielen',
    intro: 'Risico dat je pas ziet als je erover nadenkt, en dat zich niet laat wegpoetsen.',
  },
];

export const normenPerCategorie = normCategorieen.map((c) => ({
  ...c,
  items: normen.filter((n) => n.categorie === c.key),
}));

/** Normalisatie van een normeringsveld, zodat "EN ISO 20471:2013" en "EN20471" hetzelfde worden. */
export const normaliseerNormering = (v: string | null | undefined): string =>
  (v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Vermeldt een artikel deze norm in zijn normeringsveld? */
export function voldoetAanNorm(normeringen: string | null | undefined, n: Norm): boolean {
  const plat = normaliseerNormering(normeringen);
  if (!plat) return false;
  return n.zoekCodes.some((c) => plat.includes(c));
}
