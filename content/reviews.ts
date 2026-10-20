/**
 * Klantreviews, woordelijk overgenomen van frederiksbedrijfskleding.nl/referenties
 * (aangeleverd 20 okt 2026). Niet herschrijven: Jessi wil de echte teksten.
 * Alleen een duidelijke tikfout is verbeterd ("bedrijfskledinag").
 */
export type Review = { author: string; text: string; rating: number; naam?: string };

export const reviews: Review[] = [
  {
    author: 'DRS Dakgoot Renovatie Specialist',
    rating: 5,
    text: 'Goed advies over wat past bij ons en onze werkzaamheden, hiervoor wordt de tijd zeker genomen! Kleding is van goede kwaliteit net als de bedrukking. Hier zullen wij zeker onze bedrijfskleding blijven afnemen.',
  },
  {
    author: 'BZV Zonwering',
    rating: 5,
    text: 'Goed overleg met Jessi. Kleding mooi en netjes bedrukt, snelle levering en goede kwaliteit. Leuk en fijn geholpen ook, echt een topper!',
  },
  {
    author: 'Bouwbedrijf Goossens Melgers',
    rating: 5,
    text: 'Sinds enige tijd maken wij als bedrijf ook gebruik van de werkkleding van Frederiks Bedrijfskleding. Onze ervaring hiermee is heel goed en aan te bevelen voor anderen! Topservice en kwaliteit!',
  },
  {
    author: 'Getra Transport',
    rating: 5,
    text: 'Wij zijn altijd super tevreden met de service! Jessi is niet alleen snel en vakkundig in het uitzoeken en leveren van onze bedrijfskleding, maar ook ontzettend spontaan en prettig in contact. Echt een aanrader!',
  },
  {
    author: 'Elektrotechniek Achterhoek',
    rating: 5,
    text: 'Wij zijn altijd super tevreden met de service! Jessi is niet alleen snel en vakkundig in het uitzoeken en leveren van onze bedrijfskleding, maar ook ontzettend spontaan en prettig in contact. Echt een aanrader!',
  },
  {
    author: 'All Waves',
    rating: 5,
    text: 'Na heel heel wat jaren twijfelen toch maar besloten om eigen bedrijfskleding te bestellen, alleen was er zo veel dat ik door de bomen het bos haast niet meer zag. Tot ik bij Jessie kwam, meteen vanaf het eerste moment merkte ik dat er geluisterd werd naar wat ik nodig had en daar werd meteen iets op uit gezocht. Binnen een paar dagen een duidelijke offerte binnen en een week later kreeg ik een belletje dat alles al klaar lag. Ook buiten de openingstijden (vakantie zelfs) nog een extra jas kunnen passen en direct besteld. Jessie denkt goed mee en is altijd enthousiast, echt super service! Dankjewel!',
  },
  {
    author: 'Eugelink Zonwering',
    naam: 'Marcel & Carmen Eugelink',
    rating: 5,
    text: 'We kopen al jaren onze bedrijfskleding bij Jessi. Ze heeft een ruime collectie en als het er niet is besteld ze een pasmaat voor je. Jessi denkt mee, geeft tips en kijkt naar de mogelijkheden. We zijn zeer tevreden...super fijn bedrijf!',
  },
  {
    author: 'Café-zaal De Jongens',
    rating: 5,
    text: 'Wij hebben nu diverse keren bedrukte bedrijfskleding besteld en zijn zeer tevreden over de kwaliteit van de kleding en de bedrukking. We zijn zeer professioneel geholpen met paskleding en de snelle levering. Top gedaan!!',
  },
  {
    author: 'Van Bentum Schoonmaak',
    rating: 5,
    text: 'Wij hebben werkjassen besteld en zijn hier heel tevreden over ze zijn warm goede kwaliteit goede service en mooie logo’s. Echt een aanrader!',
  },
  {
    author: 'Massen Knippers',
    rating: 5,
    text: 'Wij zijn zeer tevreden over de geleverde bedrijfskleding voor ons bedrijf. De werkbroeken zijn van uitstekende kwaliteit en praktisch in gebruik. Doordat het bedrukken ook door Frederiks Bedrijfskleding wordt geregeld bieden zij een fijne en goede totaalservice!',
  },
  {
    author: 'Overbeek Bouw',
    rating: 5,
    text: 'Jessi heeft ons zeer goed geholpen met de aanschaf van onze werk kleding! Ze zorgde ervoor dat ze ook keuze had in grote maten! De bedrukking van de logo’s is slijtvast en kleding van prima kwaliteit. Jessi kwam zelfs een na levering thuis bezorgen.',
  },
];
