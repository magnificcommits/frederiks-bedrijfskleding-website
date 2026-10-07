/**
 * Offertemandje: puur rekenwerk, zonder React of opslag, zodat het te testen is.
 *
 * Een regel is één artikel in één kleur, met een aantal per maat. Hetzelfde
 * artikel in twee kleuren zijn twee regels; hetzelfde artikel en dezelfde kleur
 * nog eens toevoegen telt de aantallen op.
 */

export const LOGO_KEUZES = ['Geen logo', 'Borst links', 'Rug', 'Borst en rug', 'Weet ik nog niet'] as const;
export type LogoKeuze = (typeof LOGO_KEUZES)[number];

export type MandRegel = {
  /** productId + kleur, uniek in het mandje. */
  sleutel: string;
  productId: string;
  naam: string;
  merk: string | null;
  categorieSlug: string | null;
  slug: string;
  foto: string | null;
  /** Keuzemogelijkheden, zodat je ook op de offertepagina nog kunt wijzigen. */
  kleuren: string[];
  maten: string[];
  kleur: string | null;
  /** Aantal per maat; alleen maten met een aantal > 0. */
  aantallen: Record<string, number>;
  /** Totaal zonder maatverdeling (als het artikel geen maten heeft of je het nog niet weet). */
  aantalZonderMaat: number;
  logo: LogoKeuze | null;
};

export type LeadRegel = {
  product_id: string;
  omschrijving: string;
  kleur: string | null;
  maat: string | null;
  aantal: number | null;
  opmerking: string | null;
};

export const MAX_PER_MAAT = 9999;

export const mandSleutel = (productId: string, kleur: string | null) => `${productId}|${(kleur ?? '').toLowerCase()}`;

/** "Hydrowear FR AST Polo Jordan" in plaats van "Hydrowear Hydrowear FR AST Polo Jordan". */
export function volledigeNaam(merk: string | null | undefined, naam: string): string {
  const m = (merk ?? '').trim();
  if (!m) return naam;
  return naam.toLowerCase().startsWith(m.toLowerCase()) ? naam : `${m} ${naam}`;
}

export function schoonAantal(v: unknown): number {
  const n = Math.floor(Number(String(v ?? '').replace(/\D/g, '')));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_PER_MAAT) : 0;
}

export function schoneAantallen(a: Record<string, unknown>): Record<string, number> {
  const uit: Record<string, number> = {};
  for (const [maat, v] of Object.entries(a ?? {})) {
    const n = schoonAantal(v);
    if (n > 0 && maat.trim()) uit[maat] = n;
  }
  return uit;
}

export function stuks(r: Pick<MandRegel, 'aantallen' | 'aantalZonderMaat'>): number {
  return Object.values(r.aantallen).reduce((s, n) => s + n, 0) + (r.aantalZonderMaat || 0);
}

export const totaalStuks = (regels: MandRegel[]) => regels.reduce((s, r) => s + stuks(r), 0);

/** Toevoegen; bestaat dezelfde sleutel al, dan tellen de aantallen op en wint het nieuwste logo. */
export function voegToe(mand: MandRegel[], nieuw: MandRegel): MandRegel[] {
  const sleutel = mandSleutel(nieuw.productId, nieuw.kleur);
  const n = { ...nieuw, sleutel, aantallen: schoneAantallen(nieuw.aantallen), aantalZonderMaat: schoonAantal(nieuw.aantalZonderMaat) };
  const i = mand.findIndex((r) => r.sleutel === sleutel);
  if (i < 0) return [...mand, n];
  const oud = mand[i];
  const aantallen = { ...oud.aantallen };
  for (const [m, v] of Object.entries(n.aantallen)) aantallen[m] = Math.min(MAX_PER_MAAT, (aantallen[m] ?? 0) + v);
  const samen: MandRegel = {
    ...oud,
    aantallen,
    aantalZonderMaat: Math.min(MAX_PER_MAAT, oud.aantalZonderMaat + n.aantalZonderMaat),
    logo: n.logo ?? oud.logo,
  };
  return mand.map((r, j) => (j === i ? samen : r));
}

/** Een regel wijzigen. Verandert de kleur naar een kleur die al in het mandje staat, dan worden ze samengevoegd. */
export function werkBij(mand: MandRegel[], sleutel: string, patch: Partial<Pick<MandRegel, 'kleur' | 'aantallen' | 'aantalZonderMaat' | 'logo'>>): MandRegel[] {
  const oud = mand.find((r) => r.sleutel === sleutel);
  if (!oud) return mand;
  const nieuw: MandRegel = {
    ...oud,
    ...patch,
    aantallen: patch.aantallen ? schoneAantallen(patch.aantallen) : oud.aantallen,
    aantalZonderMaat: patch.aantalZonderMaat !== undefined ? schoonAantal(patch.aantalZonderMaat) : oud.aantalZonderMaat,
  };
  nieuw.sleutel = mandSleutel(nieuw.productId, nieuw.kleur);
  const zonder = mand.filter((r) => r.sleutel !== sleutel);
  if (nieuw.sleutel !== sleutel && zonder.some((r) => r.sleutel === nieuw.sleutel)) return voegToe(zonder, nieuw);
  return mand.map((r) => (r.sleutel === sleutel ? nieuw : r));
}

/**
 * Naar de regels die /api/lead verwacht: één regel per maat, zodat de
 * concept-offerte in het KMS meteen per maat klopt. Zonder aantallen gaat het
 * artikel mee zonder aantal (Jessi vraagt het na).
 */
export function naarLeadRegels(mand: MandRegel[]): LeadRegel[] {
  const uit: LeadRegel[] = [];
  for (const r of mand) {
    const omschrijving = volledigeNaam(r.merk, r.naam).slice(0, 300);
    const opmerking = r.logo && r.logo !== 'Geen logo' ? `Logo: ${r.logo.toLowerCase()}` : r.logo === 'Geen logo' ? 'Zonder logo' : null;
    const basis = { product_id: r.productId, omschrijving, kleur: r.kleur, opmerking };
    const volgorde = r.maten.length ? [...r.maten, ...Object.keys(r.aantallen).filter((m) => !r.maten.includes(m))] : Object.keys(r.aantallen);
    let iets = false;
    for (const maat of volgorde) {
      const n = r.aantallen[maat];
      if (!n) continue;
      uit.push({ ...basis, maat, aantal: n });
      iets = true;
    }
    if (r.aantalZonderMaat > 0) {
      uit.push({ ...basis, maat: null, aantal: r.aantalZonderMaat });
      iets = true;
    }
    if (!iets) uit.push({ ...basis, maat: null, aantal: null });
  }
  return uit;
}

/** Leesbare samenvatting voor het berichtveld en de mail. */
export function samenvatting(mand: MandRegel[]): string {
  return mand
    .map((r) => {
      const maten = Object.entries(r.aantallen).map(([m, n]) => `${m}: ${n}`);
      if (r.aantalZonderMaat) maten.push(`zonder maat: ${r.aantalZonderMaat}`);
      const delen = [r.kleur, maten.length ? maten.join(', ') : 'aantal nog niet bekend', r.logo].filter(Boolean);
      return `- ${volledigeNaam(r.merk, r.naam)} (${delen.join(' · ')})`;
    })
    .join('\n');
}

/** Wat uit opslag komt kan oud of kapot zijn; alleen geldige regels terug. Oude selectie-items worden omgezet. */
export function leesMand(ruw: unknown): MandRegel[] {
  if (!Array.isArray(ruw)) return [];
  let uit: MandRegel[] = [];
  for (const x of ruw as Record<string, unknown>[]) {
    if (!x || typeof x !== 'object') continue;
    const productId = String(x.productId ?? x.id ?? '');
    const naam = String(x.naam ?? '');
    const slug = String(x.slug ?? '');
    if (!productId || !naam) continue;
    const kleur = typeof x.kleur === 'string' && x.kleur.trim() ? x.kleur : null;
    const lijst = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
    const logo = LOGO_KEUZES.includes(x.logo as LogoKeuze) ? (x.logo as LogoKeuze) : null;
    uit = voegToe(uit, {
      sleutel: mandSleutel(productId, kleur),
      productId,
      naam,
      merk: typeof x.merk === 'string' ? x.merk : null,
      categorieSlug: typeof x.categorieSlug === 'string' ? x.categorieSlug : null,
      slug,
      foto: typeof x.foto === 'string' ? x.foto : null,
      kleuren: lijst(x.kleuren),
      maten: lijst(x.maten),
      kleur,
      aantallen: schoneAantallen((x.aantallen as Record<string, unknown>) ?? {}),
      aantalZonderMaat: schoonAantal(x.aantalZonderMaat),
      logo,
    });
  }
  return uit;
}
