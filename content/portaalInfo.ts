/**
 * Vaste informatie in het klantportaal, letterlijk zoals Jessi het aanleverde
 * (werkdocument portaal 21 okt 2026, punten 3 en 4).
 */

export const zoWerktHet = {
  titel: 'Zo werkt het bestellen van jouw bedrijfskleding',
  intro:
    'Bij Frederiks Bedrijfskleding maken we het bestellen van jouw werkkleding zo eenvoudig mogelijk. Jouw kledingmaten zijn vooraf vastgesteld tijdens een passessie. Je hoeft dus alleen nog maar je kleding te kiezen!',
  stappen: [
    {
      titel: 'Kies jouw kleding',
      tekst: 'Bekijk het assortiment en selecteer de artikelen die je wilt bestellen. Jouw maat is al voor je ingesteld op basis van de eerdere passessie.',
    },
    {
      titel: 'Controleer jouw bestelling',
      tekst:
        'Controleer de gekozen artikelen, aantallen en geregistreerde maten. Is jouw maat veranderd? Dien dan eerst een maatwijzigingsverzoek in via het portaal. Wij zorgen ervoor dat jouw maatgegevens na beoordeling worden aangepast.',
    },
    {
      titel: 'Plaats jouw bestelling',
      tekst:
        'Alles gecontroleerd? Plaats dan eenvoudig je bestelling via het portaal. Afhankelijk van de afspraken met jouw werkgever wordt je bestelling direct verwerkt of eerst ter goedkeuring aangeboden.',
    },
    {
      titel: 'Wij gaan voor je aan de slag!',
      tekst: 'Na ontvangst en eventuele goedkeuring gaan wij aan de slag met jouw bestelling. Waar nodig wordt de kleding voorzien van het bedrijfslogo of andere personalisatie.',
    },
    {
      titel: 'Ontvang jouw bedrijfskleding',
      tekst: 'Zodra jouw bestelling gereed is, wordt deze geleverd volgens de afspraken met jouw werkgever.',
    },
  ],
  slot: 'Veel plezier met jouw nieuwe bedrijfskleding!',
} as const;

export const wasvoorschriften = {
  titel: 'Wasvoorschriften bedrijfskleding',
  intro:
    'Om de kwaliteit, pasvorm en uitstraling van je bedrijfskleding zo lang mogelijk te behouden, adviseren wij de volgende wasvoorschriften.',
  blokken: [
    {
      titel: 'Wassen',
      regels: [
        'Representatieve kleding: wassen op maximaal 30°C.',
        'Werkkleding: wassen op maximaal 40°C, tenzij anders aangegeven op het waslabel.',
        'Was kleding altijd binnenstebuiten, ook om bedrukking en borduring te beschermen.',
        'Gebruik een mild wasmiddel, geschikt voor de kleding.',
        'Gebruik geen wasverzachter.',
        'Was donkere en lichte kleuren gescheiden.',
        'Sluit ritsen en klittenbandsluitingen voor het wassen.',
      ],
    },
    {
      titel: 'Drogen',
      regels: [
        'Niet in de droogtrommel drogen. Dit geldt in het bijzonder voor stretchbroeken. De warmte kan de elastische vezels beschadigen, waardoor de broek zijn pasvorm en elasticiteit verliest.',
        'Laat kleding bij voorkeur aan de lucht drogen.',
        'Vermijd langdurig drogen in direct zonlicht om verkleuring te beperken.',
      ],
    },
    {
      titel: 'Strijken',
      regels: [
        'Strijk alleen wanneer het waslabel dit toestaat.',
        "Strijk bedrukking en logo's nooit rechtstreeks.",
        'Strijk kleding bij voorkeur binnenstebuiten en op een lage temperatuur.',
      ],
    },
    {
      titel: 'Belangrijk',
      regels: [
        'Het waslabel in het kledingstuk is altijd leidend. Wanneer het waslabel een afwijkende behandeling voorschrijft, volg dan deze instructies.',
        'Voor genormeerde veiligheidskleding kunnen aanvullende wasvoorschriften gelden. Volg hiervoor altijd de instructies van de fabrikant.',
      ],
    },
  ],
  slot: 'Met de juiste verzorging blijft je bedrijfskleding langer mooi en behoudt deze beter zijn pasvorm en uitstraling.',
} as const;
