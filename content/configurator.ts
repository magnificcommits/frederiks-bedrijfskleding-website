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
