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
 * Voorbeeldpakketten per branche. Sleutel = de navLabel van de branche.
 * kleur = index in `kleuren`, positie = id uit logoposities of broekposities.
 * Bedoeld als startpunt: de bezoeker kan daarna aanpassen, toevoegen of weghalen.
 */
export const starterpakketten: Record<string, { type: string; kleur: number; positie: string; aantal: string }[]> = {
  'Bouw & infra': [
    { type: 'softshell', kleur: 1, positie: 'rug', aantal: '5' },
    { type: 'sweater', kleur: 0, positie: 'borst-links', aantal: '10' },
    { type: 'werkbroek', kleur: 1, positie: 'dijbeen-rechts', aantal: '10' },
    { type: 'tshirt', kleur: 6, positie: 'borst-links', aantal: '15' },
  ],
  'Industrie & transport': [
    { type: 'softshell', kleur: 2, positie: 'rug', aantal: '8' },
    { type: 'polo', kleur: 1, positie: 'borst-links', aantal: '15' },
    { type: 'werkbroek', kleur: 0, positie: 'dijbeen-rechts', aantal: '12' },
    { type: 'bodywarmer', kleur: 7, positie: 'borst-rechts', aantal: '8' },
  ],
  'Horeca & hospitality': [
    { type: 'polo', kleur: 0, positie: 'borst-links', aantal: '12' },
    { type: 'sweater', kleur: 2, positie: 'borst-links', aantal: '6' },
    { type: 'tshirt', kleur: 4, positie: 'borst-links', aantal: '10' },
  ],
  'Zorg & beauty': [
    { type: 'polo', kleur: 4, positie: 'borst-links', aantal: '10' },
    { type: 'tshirt', kleur: 3, positie: 'borst-links', aantal: '10' },
    { type: 'softshell', kleur: 2, positie: 'borst-rechts', aantal: '4' },
  ],
  'Agri & milieu': [
    { type: 'winterjas', kleur: 5, positie: 'rug', aantal: '4' },
    { type: 'bodywarmer', kleur: 5, positie: 'borst-rechts', aantal: '6' },
    { type: 'werkbroek', kleur: 2, positie: 'dijbeen-links', aantal: '8' },
    { type: 'tshirt', kleur: 5, positie: 'borst-links', aantal: '12' },
  ],
  'Representatief': [
    { type: 'polo', kleur: 1, positie: 'borst-links', aantal: '10' },
    { type: 'softshell', kleur: 0, positie: 'borst-links', aantal: '10' },
    { type: 'bodywarmer', kleur: 1, positie: 'borst-rechts', aantal: '6' },
  ],
  'Sport & promotie': [
    { type: 'tshirt', kleur: 6, positie: 'borst-links', aantal: '20' },
    { type: 'sweater', kleur: 0, positie: 'rug', aantal: '15' },
    { type: 'polo', kleur: 1, positie: 'borst-links', aantal: '12' },
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
