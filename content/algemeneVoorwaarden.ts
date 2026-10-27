/**
 * Algemene voorwaarden van Frederiks Bedrijfskleding, letterlijk zoals Jessi ze
 * aanleverde (mail 27 okt 2026, "Algemene voorwaarden Frederiks bedrijfskleding.docx").
 * Eén bron voor de website, het klantportaal en de PDF die met elke offerte meegaat.
 * Pas je hier iets aan, maak dan ook de PDF opnieuw (scripts/voorwaarden-pdf.mjs)
 * en verhoog de versie.
 */
export type VoorwaardenLid = { kop?: string; tekst: string };
export type VoorwaardenArtikel = { nummer: number; titel: string; leden: VoorwaardenLid[] };

export const VOORWAARDEN_VERSIE = '2026-10-27';
export const VOORWAARDEN_PDF = '/downloads/algemene-voorwaarden-frederiks-bedrijfskleding.pdf';
export const VOORWAARDEN_INTRO = "Van toepassing op zakelijke offertes, bestellingen en leveringen.";

export const voorwaarden: VoorwaardenArtikel[] = [
  {
    "nummer": 1,
    "titel": "Toepasselijkheid",
    "leden": [
      {
        "tekst": "Deze algemene voorwaarden zijn van toepassing op alle offertes, overeenkomsten, bestellingen en leveringen van Frederiks Bedrijfskleding aan zakelijke klanten."
      },
      {
        "tekst": "Afwijkende afspraken zijn uitsluitend geldig wanneer deze schriftelijk of digitaal zijn bevestigd."
      },
      {
        "tekst": "Wanneer in een offerte uitdrukkelijk andere afspraken zijn opgenomen, gaan deze voor op de betreffende bepalingen in deze algemene voorwaarden."
      }
    ]
  },
  {
    "nummer": 2,
    "titel": "Offertes en opdrachtbevestiging",
    "leden": [
      {
        "tekst": "Alle offertes zijn vrijblijvend en geldig gedurende 30 dagen na de offertedatum, tenzij anders vermeld."
      },
      {
        "tekst": "Een opdracht wordt pas in behandeling genomen nadat de klant de offerte schriftelijk of digitaal heeft bevestigd."
      },
      {
        "tekst": "De klant is verantwoordelijk voor het controleren van de aangeboden artikelen, aantallen, kleuren, prijzen en overige specificaties."
      },
      {
        "tekst": "Wijzigingen na akkoord kunnen gevolgen hebben voor de prijs en levertijd."
      }
    ]
  },
  {
    "nummer": 3,
    "titel": "Aanbetaling",
    "leden": [
      {
        "tekst": "Bij bestellingen met een totale orderwaarde van € 5.000 exclusief btw of hoger geldt een aanbetaling van 50% van het orderbedrag inclusief btw, tenzij schriftelijk anders overeengekomen."
      },
      {
        "tekst": "De bestelling wordt pas in behandeling genomen nadat de aanbetaling is ontvangen en alle benodigde gegevens beschikbaar zijn."
      },
      {
        "tekst": "Het resterende bedrag wordt volgens de overeengekomen betalingsvoorwaarden gefactureerd."
      }
    ]
  },
  {
    "nummer": 4,
    "titel": "Maatvoering en passessies",
    "leden": [
      {
        "tekst": "Na akkoord op de offerte kan een passessie plaatsvinden bij de klant op locatie of in onze showroom."
      },
      {
        "tekst": "De klant is verantwoordelijk voor het controleren en bevestigen van de definitieve maten en aantallen."
      },
      {
        "tekst": "Wanneer de klant zelf maten aanlevert of artikelen zonder passessie bestelt, ligt de verantwoordelijkheid voor de juistheid van deze gegevens bij de klant."
      },
      {
        "tekst": "Eventuele wijzigingen na de definitieve maatbevestiging zijn afhankelijk van de mogelijkheden bij de leverancier en kunnen extra kosten veroorzaken."
      },
      {
        "tekst": "Dit artikel laat de wettelijke rechten van de klant bij onjuiste levering of gebrekkige producten onverlet."
      }
    ]
  },
  {
    "nummer": 5,
    "titel": "Bedrukking, borduring en proefdrukken",
    "leden": [
      {
        "tekst": "Voor gepersonaliseerde artikelen kan een digitale proefdruk ter goedkeuring worden aangeboden."
      },
      {
        "tekst": "De klant dient de proefdruk zorgvuldig te controleren op onder andere logo, spelling, kleuren, afmetingen en positie."
      },
      {
        "tekst": "Na schriftelijke of digitale goedkeuring van de proefdruk mag Frederiks Bedrijfskleding de personalisatie overeenkomstig die goedkeuring uitvoeren."
      },
      {
        "tekst": "Wijzigingen na goedkeuring kunnen extra kosten en een langere levertijd veroorzaken."
      },
      {
        "tekst": "Kleine kleurverschillen tussen digitale voorbeelden en het uiteindelijke druk- of borduurresultaat kunnen voorkomen door verschillen in beeldschermen, materialen en productietechnieken."
      },
      {
        "tekst": "De klant verklaart gerechtigd te zijn de aangeleverde logo's en ontwerpen te laten gebruiken en vrijwaart Frederiks Bedrijfskleding tegen aanspraken van derden wegens inbreuk op intellectuele eigendomsrechten, voor zover deze voortvloeien uit het door de klant aangeleverde materiaal."
      }
    ]
  },
  {
    "nummer": 6,
    "titel": "Levering en levertijden",
    "leden": [
      {
        "tekst": "De verwachte levertijd wordt afgestemd op de bestelling en de beschikbaarheid van de artikelen."
      },
      {
        "tekst": "De levertijd wordt berekend vanaf het moment dat alle noodzakelijke gegevens, definitieve maten, goedkeuringen en eventuele aanbetaling zijn ontvangen."
      },
      {
        "tekst": "Opgegeven levertijden zijn indicatief, tenzij uitdrukkelijk schriftelijk een bindende leverdatum is overeengekomen."
      },
      {
        "tekst": "Bij een verwachte vertraging informeren wij de klant zo spoedig mogelijk."
      },
      {
        "tekst": "Een vertraging geeft niet automatisch recht op schadevergoeding of annulering. De wettelijke rechten van de klant blijven onverlet."
      }
    ]
  },
  {
    "nummer": 7,
    "titel": "Betaling",
    "leden": [
      {
        "tekst": "Facturen dienen binnen 30 dagen na factuurdatum te worden voldaan, tenzij schriftelijk anders overeengekomen."
      },
      {
        "tekst": "Bij overschrijding van de betalingstermijn kan Frederiks Bedrijfskleding de wettelijke handelsrente in rekening brengen."
      },
      {
        "tekst": "Eventuele buitengerechtelijke incassokosten worden berekend overeenkomstig de toepasselijke wettelijke regels, tenzij rechtsgeldig anders overeengekomen."
      },
      {
        "tekst": "Bij betalingsachterstanden kan Frederiks Bedrijfskleding verdere leveringen of werkzaamheden opschorten, voor zover wettelijk toegestaan."
      },
      {
        "tekst": "De klant blijft verantwoordelijk voor betaling van rechtsgeldig verschuldigde bedragen."
      }
    ]
  },
  {
    "nummer": 8,
    "titel": "Eigendomsvoorbehoud",
    "leden": [
      {
        "tekst": "Alle geleverde goederen blijven eigendom van Frederiks Bedrijfskleding totdat de klant de daarvoor verschuldigde bedragen volledig heeft voldaan, binnen de grenzen van het wettelijk toegestane eigendomsvoorbehoud."
      },
      {
        "tekst": "Zolang de eigendom niet is overgegaan, dient de klant zorgvuldig met de geleverde goederen om te gaan."
      }
    ]
  },
  {
    "nummer": 9,
    "titel": "Annulering en retouren",
    "leden": [
      {
        "tekst": "Bestellingen van speciaal voor de klant ingekochte of gepersonaliseerde artikelen kunnen na definitieve opdrachtbevestiging niet zonder toestemming van Frederiks Bedrijfskleding worden geannuleerd."
      },
      {
        "tekst": "Wanneer annulering wordt toegestaan, kunnen reeds gemaakte en redelijkerwijs niet meer te voorkomen kosten in rekening worden gebracht."
      },
      {
        "tekst": "Gepersonaliseerde artikelen, waaronder bedrukte en geborduurde kleding, kunnen niet worden geretourneerd uitsluitend omdat de klant van de aankoop afziet."
      },
      {
        "tekst": "Voor niet-gepersonaliseerde artikelen geldt geen automatisch retourrecht bij zakelijke aankopen. Eventuele retourmogelijkheden worden vooraf afgestemd."
      },
      {
        "tekst": "Het voorgaande beperkt niet de wettelijke rechten van de klant bij een gebrekkig of verkeerd geleverd product."
      }
    ]
  },
  {
    "nummer": 10,
    "titel": "Klachten en garantie",
    "leden": [
      {
        "tekst": "De klant wordt verzocht de geleverde artikelen zo spoedig mogelijk na ontvangst te controleren."
      },
      {
        "tekst": "Zichtbare afwijkingen of onjuistheden dienen bij voorkeur binnen 7 dagen na levering schriftelijk te worden gemeld, onder vermelding van de bestelling en een omschrijving van de klacht."
      },
      {
        "tekst": "Klachten die redelijkerwijs pas later ontdekt kunnen worden, dienen binnen een redelijke termijn na ontdekking te worden gemeld."
      },
      {
        "tekst": "Bij een gegronde klacht zoeken wij naar een passende oplossing, zoals herstel, vervanging of een andere wettelijk passende afhandeling."
      },
      {
        "tekst": "Normale slijtage, verkeerd gebruik en schade door het niet opvolgen van toepasselijke onderhouds- en wasvoorschriften vallen niet onder de garantie, voor zover de schade daardoor is veroorzaakt."
      }
    ]
  },
  {
    "nummer": 11,
    "titel": "Aansprakelijkheid",
    "leden": [
      {
        "tekst": "Frederiks Bedrijfskleding is aansprakelijk voor schade voor zover deze volgens de wet aan haar kan worden toegerekend."
      },
      {
        "tekst": "Voor zover wettelijk toegestaan, is aansprakelijkheid voor indirecte schade, zoals gevolgschade en gederfde winst, uitgesloten."
      },
      {
        "tekst": "Voor zover wettelijk toegestaan, is de aansprakelijkheid voor directe schade beperkt tot het factuurbedrag van het gedeelte van de bestelling waarop de schade betrekking heeft."
      },
      {
        "tekst": "Deze beperkingen gelden niet bij opzet of bewuste roekeloosheid van Frederiks Bedrijfskleding of in andere gevallen waarin beperking van aansprakelijkheid wettelijk niet is toegestaan."
      }
    ]
  },
  {
    "nummer": 12,
    "titel": "Overmacht",
    "leden": [
      {
        "tekst": "Onder overmacht verstaan wij omstandigheden buiten de redelijke invloedssfeer van Frederiks Bedrijfskleding die de nakoming van verplichtingen verhinderen en die volgens de wet niet voor onze rekening komen."
      },
      {
        "tekst": "Hieronder kunnen, afhankelijk van de omstandigheden, ernstige verstoringen bij leveranciers, transportproblemen, stakingen en andere onvoorziene gebeurtenissen vallen."
      },
      {
        "tekst": "Bij overmacht informeren wij de klant zo spoedig mogelijk en zoeken wij waar mogelijk naar een passende oplossing."
      },
      {
        "tekst": "De wettelijke regels over overmacht en ontbinding blijven van toepassing."
      }
    ]
  },
  {
    "nummer": 13,
    "titel": "Toepasselijk recht en geschillen",
    "leden": [
      {
        "tekst": "Op overeenkomsten met Frederiks Bedrijfskleding is Nederlands recht van toepassing."
      },
      {
        "tekst": "Bij een geschil proberen partijen eerst in onderling overleg tot een oplossing te komen."
      },
      {
        "tekst": "Wanneer dit niet lukt, wordt het geschil voorgelegd aan de volgens de wet bevoegde rechter."
      }
    ]
  },
  {
    "nummer": 14,
    "titel": "Online kledingbeheer en klantportaal",
    "leden": [
      {
        "kop": "Beschikbaarheid van het kledingportaal",
        "tekst": "Frederiks Bedrijfskleding biedt zakelijke klanten de mogelijkheid gebruik te maken van een online kledingportaal voor het beheren en bestellen van bedrijfskleding. Het gebruik hiervan is optioneel en kosteloos, tenzij schriftelijk anders overeengekomen."
      },
      {
        "kop": "Gebruikers en toegangsrechten",
        "tekst": "De klant bepaalt welke werknemers en leidinggevenden toegang krijgen tot het kledingportaal. De klant is verantwoordelijk voor het tijdig doorgeven van wijzigingen in medewerkers, toegangsrechten en autorisaties."
      },
      {
        "kop": "Bestellingen via het portaal",
        "tekst": "Bestellingen die via het kledingportaal worden geplaatst door bevoegde gebruikers, worden beschouwd als bestellingen namens de zakelijke klant. Eventuele ingestelde goedkeuringsprocedures worden hierbij gevolgd."
      },
      {
        "kop": "Budgetten en bestellimieten",
        "tekst": "Binnen het kledingportaal kunnen budgetten, bestellimieten en goedkeuringsprocedures worden ingesteld. Deze instellingen dienen ter ondersteuning van het interne kledingbeheer. De klant blijft verantwoordelijk voor de juistheid van de afgesproken instellingen en de controle op de uitgaven."
      },
      {
        "kop": "Maten en medewerkersgegevens",
        "tekst": "De in het portaal geregistreerde kledingmaten worden gebruikt voor toekomstige bestellingen. De klant en de betreffende werknemers zijn verantwoordelijk voor het tijdig doorgeven van wijzigingen. Maatwijzigingen worden pas verwerkt nadat deze door Frederiks Bedrijfskleding zijn bevestigd."
      },
      {
        "kop": "Assortiment en prijzen",
        "tekst": "Het beschikbare assortiment wordt afgestemd op de afspraken met de klant. Prijzen en beschikbaarheid kunnen wijzigen volgens de gemaakte afspraken. Bij een wijziging van overeengekomen prijzen wordt de klant hierover geïnformeerd."
      },
      {
        "kop": "Beschikbaarheid en technische storingen",
        "tekst": "Frederiks Bedrijfskleding streeft naar een goed functionerend kledingportaal. Tijdelijke onderbrekingen door onderhoud, storingen of technische problemen kunnen voorkomen. Bij een storing zoeken wij waar mogelijk naar een alternatieve manier om bestellingen te verwerken."
      },
      {
        "kop": "Persoonsgegevens",
        "tekst": "Bij het gebruik van het kledingportaal worden persoonsgegevens verwerkt, waaronder namen, kledingmaten en bestelgegevens. Deze gegevens worden verwerkt overeenkomstig de toepasselijke privacywetgeving. Waar nodig worden aanvullende afspraken gemaakt over de verantwoordelijkheden voor de verwerking van persoonsgegevens."
      },
      {
        "kop": "Beëindiging van toegang",
        "tekst": "Wanneer de zakelijke samenwerking eindigt, kan de toegang tot het kledingportaal worden beëindigd. Openstaande bestellingen en betalingsverplichtingen blijven daarbij bestaan."
      },
      {
        "kop": "Geen verplicht gebruik",
        "tekst": "Het gebruik van het kledingportaal is geen verplicht onderdeel van de dienstverlening. Klanten kunnen bedrijfskleding ook rechtstreeks bij Frederiks Bedrijfskleding bestellen, volgens de gemaakte afspraken."
      }
    ]
  }
];

/** Tekst onderaan elke offerte (Jessi, 27 okt, punt 1.4). */
export const VOORWAARDEN_OFFERTE_TEKST =
  'Op deze offerte en de daaruit voortvloeiende overeenkomst zijn de algemene voorwaarden van Frederiks Bedrijfskleding van toepassing. Deze zijn als bijlage bijgevoegd. Door de offerte goed te keuren, verklaart de klant de algemene voorwaarden te hebben ontvangen en hiermee akkoord te gaan.';

