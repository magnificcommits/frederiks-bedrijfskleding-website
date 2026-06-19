/**
 * Centrale bedrijfsgegevens (NAP). Single source of truth voor header, footer,
 * contact, structured data (JSON-LD) en e-mails. Gegevens van frederiksbedrijfskleding.nl.
 */
export const site = {
  name: 'Frederiks Bedrijfskleding',
  legalName: 'Frederiks Bedrijfskleding',
  owner: 'Jessi Frederiks',
  tagline: 'Bedrijfskleding met persoonlijke aandacht',
  description:
    'Frederiks Bedrijfskleding in Hengelo (Gld) levert werkkleding, veiligheidsschoenen en maatwerk voor bedrijven in de Achterhoek. Persoonlijk advies, passen op locatie en eigen bedrukken en borduren.',
  foundedYear: 2020,
  url: 'https://www.frederiksbedrijfskleding.nl',
  email: 'info@frederiksbedrijfskleding.nl',
  phone: '06 15 21 50 29',
  phoneIntl: '+31615215029',
  whatsapp: '+31615215029',
  rating: { value: 5.0, count: 8 },
  address: {
    street: 'Kruisbergseweg 9',
    postalCode: '7255 AG',
    city: 'Hengelo',
    region: 'Gelderland',
    country: 'NL',
    locationNote: 'Gevestigd in de Brouwersmolen, met eigen showroom en bedrukkerij.',
    geo: { lat: 52.0007, lng: 6.3061 },
  },
  social: {
    facebook: '',
    linkedin: 'https://www.linkedin.com/in/jessi-frederiks-9a583958/',
  },
  openingHours: [
    { day: 'Maandag', dayCode: 'Mo', open: '09:00', close: '17:00' },
    { day: 'Dinsdag', dayCode: 'Tu', open: '09:00', close: '17:00' },
    { day: 'Woensdag', dayCode: 'We', open: '09:00', close: '17:00' },
    { day: 'Donderdag', dayCode: 'Th', open: '09:00', close: '17:00' },
    { day: 'Vrijdag', dayCode: 'Fr', open: '09:00', close: '17:00' },
  ],
  openingNote: 'Showroombezoek op afspraak. Wij komen ook graag bij je langs om te passen.',
  usps: [
    { title: 'Eén vast aanspreekpunt', text: 'Persoonlijk contact met iemand die jouw bedrijf kent. Niet elke keer een ander.' },
    { title: 'Passen op locatie', text: 'Wij komen bij je langs voor maatadvies. Zo raak je geen werktijd kwijt aan een showroom.' },
    { title: 'Eigen bedrukken en borduren', text: 'Jouw logo strak en slijtvast aangebracht, in eigen huis. Dus snel en met grip op de kwaliteit.' },
    { title: 'Alles onder één dak', text: 'Van advies en maatvoering tot bedrukken en nalevering. Je regelt het op één plek.' },
  ],
  brands: [
    'Tricorp', 'Snickers Workwear', 'Mascot', 'FHB', 'Chaud Devant',
    'U-Power', 'De Berkel', 'Ned-B',
  ],
} as const;

export type Site = typeof site;
