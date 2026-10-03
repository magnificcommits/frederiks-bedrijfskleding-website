/**
 * Veelvoorkomende afdelingen per branche, als snelle keuze in de wizard. Alleen
 * een hulpmiddel: Jessi kan alles zelf typen. Gezocht op een stukje van de
 * branchenaam, zodat 'Bouw en infra' ook onder bouw valt.
 */
const PER_BRANCHE: { sleutels: string[]; afdelingen: string[] }[] = [
  { sleutels: ['install', 'elektro', 'e-techniek', 'w-techniek', 'loodgiet'], afdelingen: ['Montage', 'Service', 'Werkvoorbereiding', 'Magazijn', 'Kantoor'] },
  { sleutels: ['bouw', 'aannem', 'infra', 'grond', 'sloop'], afdelingen: ['Uitvoering', 'Werkvoorbereiding', 'Magazijn', 'Kantoor'] },
  { sleutels: ['horeca', 'restaurant', 'hotel', 'catering', 'café', 'cafe'], afdelingen: ['Keuken', 'Bediening', 'Bar', 'Huishouding', 'Kantoor'] },
  { sleutels: ['metaal', 'staal', 'las', 'machine', 'productie', 'industrie'], afdelingen: ['Lassers', 'Productie', 'Onderhoud', 'Logistiek', 'Kantoor'] },
  { sleutels: ['logistiek', 'transport', 'distributie', 'koerier'], afdelingen: ['Chauffeurs', 'Magazijn', 'Planning', 'Kantoor'] },
  { sleutels: ['zorg', 'verpleeg', 'thuiszorg', 'ziekenhuis'], afdelingen: ['Verpleging', 'Facilitair', 'Huishouding', 'Kantoor'] },
  { sleutels: ['schoonmaak', 'reiniging', 'facilitair'], afdelingen: ['Schoonmakers', 'Leidinggevenden', 'Kantoor'] },
  { sleutels: ['groen', 'hovenier', 'tuin', 'agrar', 'boer'], afdelingen: ['Buitendienst', 'Onderhoud', 'Kantoor'] },
  { sleutels: ['school', 'onderwijs', 'opleiding'], afdelingen: ['Docenten', 'Leerlingen', 'Conciërges', 'Kantoor'] },
  { sleutels: ['auto', 'garage', 'werkplaats'], afdelingen: ['Werkplaats', 'Showroom', 'Kantoor'] },
  { sleutels: ['winkel', 'retail', 'supermarkt'], afdelingen: ['Winkel', 'Magazijn', 'Kassa', 'Kantoor'] },
];

const ALGEMEEN = ['Productie', 'Buitendienst', 'Logistiek', 'Kantoor'];

export function afdelingSuggesties(branche: string | null | undefined): string[] {
  const b = (branche ?? '').toLowerCase();
  if (!b) return ALGEMEEN;
  const gevonden = PER_BRANCHE.find((p) => p.sleutels.some((s) => b.includes(s)));
  return gevonden ? gevonden.afdelingen : ALGEMEEN;
}
