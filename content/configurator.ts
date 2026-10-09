/** Data voor de pakketsamensteller. Pas vrij aan: kleuren, kledingtypes en items. */
export const kleuren: { name: string; hex: string; licht?: boolean }[] = [
  { name: 'Zwart', hex: '#1c1c1c' },
  { name: 'Marineblauw', hex: '#22314f' },
  { name: 'Antraciet', hex: '#3a3f44' },
  { name: 'Grijs', hex: '#9aa0a6' },
  { name: 'Wit', hex: '#f1f1f1', licht: true },
  { name: 'Groen', hex: '#3d5a3a' },
  { name: 'Hi-vis geel', hex: '#d9e000' },
  { name: 'Hi-vis oranje', hex: '#ff6a13' },
];

export const kledingtypes = [
  { id: 'tshirt', label: 'T-shirt' },
  { id: 'polo', label: 'Polo' },
  { id: 'sweater', label: 'Sweater / trui' },
  { id: 'softshell', label: 'Softshell jas' },
  { id: 'winterjas', label: 'Winterjas' },
  { id: 'bodywarmer', label: 'Bodywarmer' },
  { id: 'werkbroek', label: 'Werkbroek' },
] as const;

export const pakketitems = [
  { id: 'werkbroek', label: 'Werkbroeken' },
  { id: 'jas', label: 'Jassen / softshells' },
  { id: 'shirt', label: "Shirts / polo's" },
  { id: 'hivis', label: 'Hi-vis kleding' },
  { id: 'schoenen', label: 'Veiligheidsschoenen' },
  { id: 'bodywarmer', label: 'Bodywarmers' },
] as const;

export const logoposities = [
  { id: 'borst-links', label: 'Borst links' },
  { id: 'borst-rechts', label: 'Borst rechts' },
  { id: 'rug', label: 'Rug (groot)' },
] as const;

/** Voor een broek is een ruglogo niet logisch; daar plaats je op de pijp. */
export const broekposities = [
  { id: 'dijbeen-links', label: 'Pijp links' },
  { id: 'dijbeen-rechts', label: 'Pijp rechts' },
] as const;

export function positiesVoor(type: string): readonly { id: string; label: string }[] {
  return type === 'werkbroek' ? broekposities : logoposities;
}

/**
 * Basispakket per medewerker, per branche. Sleutel = de navLabel van de branche.
 * kleur = index in `kleuren`, positie = id uit logoposities of broekposities,
 * per = aantal stuks per medewerker. De configurator vermenigvuldigt met de teamgrootte.
 * Bedoeld als startpunt: de bezoeker past het daarna aan.
 */
export const starterpakketten: Record<string, { type: string; kleur: number; positie: string; per: number }[]> = {
  'Bouw & infra': [
    { type: 'werkbroek', kleur: 1, positie: 'dijbeen-rechts', per: 2 },
    { type: 'tshirt', kleur: 6, positie: 'borst-links', per: 3 },
    { type: 'sweater', kleur: 0, positie: 'borst-links', per: 1 },
    { type: 'softshell', kleur: 1, positie: 'rug', per: 1 },
  ],
  'Installatie & techniek': [
    { type: 'werkbroek', kleur: 2, positie: 'dijbeen-rechts', per: 2 },
    { type: 'polo', kleur: 1, positie: 'borst-links', per: 3 },
    { type: 'sweater', kleur: 1, positie: 'borst-links', per: 1 },
    { type: 'softshell', kleur: 0, positie: 'rug', per: 1 },
  ],
  'Industrie & logistiek': [
    { type: 'werkbroek', kleur: 0, positie: 'dijbeen-rechts', per: 2 },
    { type: 'polo', kleur: 1, positie: 'borst-links', per: 3 },
    { type: 'softshell', kleur: 2, positie: 'rug', per: 1 },
    { type: 'bodywarmer', kleur: 7, positie: 'borst-links', per: 1 },
  ],
  'Horeca & food': [
    { type: 'polo', kleur: 0, positie: 'borst-links', per: 3 },
    { type: 'tshirt', kleur: 4, positie: 'borst-links', per: 2 },
    { type: 'sweater', kleur: 2, positie: 'borst-links', per: 1 },
  ],
  'Zorg & salon': [
    { type: 'polo', kleur: 4, positie: 'borst-links', per: 3 },
    { type: 'tshirt', kleur: 3, positie: 'borst-links', per: 2 },
    { type: 'softshell', kleur: 2, positie: 'borst-links', per: 1 },
  ],
  'Agrarisch & groen': [
    { type: 'werkbroek', kleur: 2, positie: 'dijbeen-links', per: 2 },
    { type: 'tshirt', kleur: 5, positie: 'borst-links', per: 3 },
    { type: 'bodywarmer', kleur: 5, positie: 'borst-links', per: 1 },
    { type: 'winterjas', kleur: 5, positie: 'rug', per: 1 },
  ],
  'Kantoor & retail': [
    { type: 'polo', kleur: 1, positie: 'borst-links', per: 3 },
    { type: 'softshell', kleur: 0, positie: 'borst-links', per: 1 },
    { type: 'bodywarmer', kleur: 1, positie: 'borst-links', per: 1 },
  ],
  'Clubs & verenigingen': [
    { type: 'tshirt', kleur: 1, positie: 'borst-links', per: 2 },
    { type: 'polo', kleur: 1, positie: 'borst-links', per: 1 },
    { type: 'sweater', kleur: 0, positie: 'rug', per: 1 },
  ],
};

/** Teamgrootte als vaste keuzes: makkelijker invullen, beter uit te lezen, kwalificeert de lead. */
export const teamgroottes = [
  'tot 5 medewerkers',
  '5-10 medewerkers',
  '10-25 medewerkers',
  '25-50 medewerkers',
  'meer dan 50 medewerkers',
] as const;

/** Rekenwaarde per teamgrootte voor het basispakket. Zonder keuze rekenen we met 10. */
const TEAM_AANTAL: Record<string, number> = {
  'tot 5 medewerkers': 4,
  '5-10 medewerkers': 8,
  '10-25 medewerkers': 15,
  '25-50 medewerkers': 35,
  'meer dan 50 medewerkers': 60,
};
export function teamAantal(team: string): number {
  return TEAM_AANTAL[team] ?? 10;
}

/** Dichtstbijzijnde kleur uit `kleuren` bij een kleurnaam uit de catalogus (voor de overstap vanaf een productpagina). */
export function kleurIndexVoor(naam: string | null | undefined): number {
  const n = (naam ?? '').toLowerCase().split(/[\/,]/)[0];
  const regels: [RegExp, number][] = [
    [/navy|marine|donkerblauw|dark blue|blauw/, 1],
    [/antraciet|anthracite|charcoal|graphite/, 2],
    [/grijs|grey|gray/, 3],
    [/wit|white/, 4],
    [/groen|green|olive|khaki/, 5],
    [/geel|yellow/, 6],
    [/oranje|orange/, 7],
    [/zwart|black/, 0],
  ];
  return regels.find(([re]) => re.test(n))?.[1] ?? 0;
}
