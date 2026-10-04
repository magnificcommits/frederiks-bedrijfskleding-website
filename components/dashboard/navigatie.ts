/**
 * Eén bron voor de menu-indeling van het KMS. De zijbalk, het kruimelpad en de
 * sneltoetsen lezen hieruit, zodat een scherm overal dezelfde naam heeft.
 *
 * Indeling volgt hoe Jessi werkt: eerst wat er vandaag ligt, dan de verkoop
 * van aanvraag tot factuur, dan de klanten zelf. Groepnamen zijn gewone taal,
 * geen vakjargon ("Cijfers" i.p.v. "Inzicht", "Bedrukken en borduren" i.p.v. "Productie").
 */

export type NavItem = { href: string; label: string };
export type NavGroep = { titel: string; items: NavItem[] };

/** Alleen zichtbaar voor de eigenaar en bij wachtwoordlogin. */
export const BEHEER_HREF = '/dashboard/admins';

export const NAV_GROEPEN: NavGroep[] = [
  { titel: 'Vandaag', items: [
    { href: '/dashboard', label: 'Overzicht' },
    { href: '/dashboard/taken', label: 'Taken en afspraken' },
    { href: '/dashboard/afspraken', label: 'Online afspraken' },
    { href: '/dashboard/meldingen', label: 'Meldingen' },
  ] },
  { titel: 'Verkoop', items: [
    { href: '/dashboard/leads', label: 'Leads' },
    { href: '/dashboard/offertes', label: 'Offertes' },
    { href: '/dashboard/orders', label: 'Orders' },
    { href: '/dashboard/facturen', label: 'Facturen' },
  ] },
  { titel: 'Klanten', items: [
    { href: '/dashboard/klanten', label: 'Klanten' },
    { href: '/dashboard/passessie', label: 'Passen en maten' },
    { href: '/dashboard/medewerker-verzoeken', label: 'Medewerker-verzoeken' },
    { href: '/dashboard/reviews', label: 'Reviews en NPS' },
    { href: '/dashboard/sparen', label: 'Sparen' },
  ] },
  { titel: 'Nieuwe klanten werven', items: [
    { href: '/dashboard/prospects', label: 'Prospects' },
    { href: '/dashboard/prospects/brieven', label: 'Brieven met QR' },
    { href: '/dashboard/campagnes', label: 'Mailcampagnes' },
    { href: '/dashboard/nieuwsbrief', label: 'Nieuwsbrief' },
  ] },
  { titel: 'Artikelen en inkoop', items: [
    { href: '/dashboard/producten', label: 'Producten' },
    { href: '/dashboard/pakketten', label: 'Pakketten' },
    { href: '/dashboard/voorraad', label: 'Voorraad' },
    { href: '/dashboard/inkoop', label: 'Inkoop' },
    { href: '/dashboard/leveranciers', label: 'Leveranciers' },
  ] },
  { titel: 'Bedrukken en borduren', items: [
    { href: '/dashboard/logos', label: 'Werkbonnen en logo’s' },
    { href: '/dashboard/drukproeven', label: 'Drukproeven' },
  ] },
  { titel: 'Retouren en klachten', items: [
    { href: '/dashboard/retouren', label: 'Retouren' },
    { href: '/dashboard/klachten', label: 'Klachten en vragen' },
  ] },
  { titel: 'Cijfers', items: [
    { href: '/dashboard/analyse', label: 'Analyse' },
    { href: '/dashboard/rapportages', label: 'Rapportages' },
    { href: '/dashboard/ai-assistent', label: 'AI-assistent' },
  ] },
  { titel: 'Instellingen', items: [
    { href: '/dashboard/instellingen', label: 'Instellingen' },
    { href: BEHEER_HREF, label: 'Beheerders' },
    { href: '/dashboard/beveiliging', label: 'Beveiliging (2FA)' },
    { href: '/dashboard/import', label: 'Gegevens inlezen' },
    { href: '/dashboard/export', label: 'Gegevens exporteren' },
    { href: '/dashboard/audit', label: 'Logboek' },
  ] },
];

/** Favorieten voor wie nog niets gekozen heeft: wat je elke dag nodig hebt. */
export const STANDAARD_FAVORIETEN: string[] = [
  '/dashboard',
  '/dashboard/orders',
  '/dashboard/offertes',
  '/dashboard/klanten',
  '/dashboard/passessie',
  '/dashboard/producten',
];

// Onderdelen die alleen de eigenaar ziet (instellingen, beheer, financien, groei, systeem).
// Medewerkers en lezers krijgen deze niet in de nav (ook niet in favorieten) en worden
// server-side geweerd.
export const EIGENAAR_ONLY = new Set<string>([
  '/dashboard/prospects',
  '/dashboard/prospects/brieven',
  '/dashboard/campagnes',
  '/dashboard/facturen',
  '/dashboard/sparen',
  '/dashboard/analyse',
  '/dashboard/rapportages',
  '/dashboard/import',
  '/dashboard/export',
  '/dashboard/audit',
  '/dashboard/instellingen',
]);

/** Namen van tussenpagina's die niet in het menu staan. */
const EXTRA_LABELS: Record<string, string> = {
  '/dashboard/producten/fotocontrole': 'Fotocontrole',
  '/dashboard/voorraad/telling': 'Voorraadtelling',
  '/dashboard/instellingen/varianten': 'Maten en kleuren',
  '/dashboard/instellingen/service': 'Service',
  '/dashboard/instellingen/boekhouding': 'Boekhouding',
  '/dashboard/instellingen/api': 'API en HR-koppeling',
  '/dashboard/taken/instellingen': 'Instellingen',
  '/dashboard/afspraken/instellingen': 'Beschikbaarheid',
  '/dashboard/campagnes/instellingen': 'Instellingen',
  '/dashboard/sparen/instellingen': 'Instellingen',
  '/dashboard/sparen/klanten': 'Spaarders',
  '/dashboard/rapportages/klant': 'Per klant',
  '/dashboard/functies': 'Functies',
  '/dashboard/app': 'KMS als app',
};

/** Hoe één record heet in het kruimelpad, per lijst. */
const ENKELVOUD: Record<string, string> = {
  orders: 'Order',
  offertes: 'Offerte',
  facturen: 'Factuur',
  klanten: 'Klant',
  producten: 'Product',
  leads: 'Lead',
  prospects: 'Prospect',
  leveranciers: 'Leverancier',
  inkoop: 'Inkooporder',
  logos: 'Logo',
  drukproeven: 'Drukproef',
  campagnes: 'Campagne',
  nieuwsbrief: 'Nieuwsbrief',
  pakketten: 'Pakket',
  passessie: 'Passessie',
  functies: 'Functie',
  brieven: 'Verzending',
  klant: 'Klant',
};

const SEGMENT_LABELS: Record<string, string> = {
  nieuw: 'Nieuw',
  instellingen: 'Instellingen',
  bewerken: 'Bewerken',
  editor: 'Editor',
  werkbon: 'Werkbon',
  pakbon: 'Pakbon',
  picklijst: 'Picklijst',
  sticker: 'Sticker',
  structuur: 'Structuur',
  ontvanger: 'Ontvanger',
  scans: 'Scans',
  snel: 'Snel',
  btw: 'Btw-overzicht',
  debiteuren: 'Openstaande facturen',
};

const ALLE_LABELS: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const g of NAV_GROEPEN) for (const it of g.items) m.set(it.href, it.label);
  for (const [href, label] of Object.entries(EXTRA_LABELS)) m.set(href, label);
  return m;
})();

/** De naam van een menu-onderdeel, of null als het pad geen menu-onderdeel is. */
export function labelVoor(href: string): string | null {
  return ALLE_LABELS.get(href) ?? null;
}

function lijktId(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment) || /^\d+$/.test(segment) || segment.length > 24;
}

/**
 * De bovenliggende pagina's van een pad, voor het kruimelpad. De huidige pagina
 * zelf hoort er niet bij (dat is de paginatitel). Het overzicht staat alleen
 * vooraan als er verder niets boven de pagina ligt.
 */
export function kruimelsVoor(pathname: string): NavItem[] {
  const delen = pathname.split('?')[0].split('/').filter(Boolean);
  if (delen[0] !== 'dashboard' || delen.length < 2) return [];
  const uit: NavItem[] = [];
  for (let i = 2; i < delen.length; i++) {
    const href = '/' + delen.slice(0, i).join('/');
    const segment = delen[i - 1];
    const vorige = delen[i - 2];
    const label =
      labelVoor(href) ??
      (lijktId(segment) ? ENKELVOUD[vorige] ?? 'Details' : SEGMENT_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '));
    uit.push({ href, label });
  }
  return uit.length ? uit : [{ href: '/dashboard', label: 'Overzicht' }];
}
