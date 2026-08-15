import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Het publieke assortiment: de brug tussen de KMS-productdatabase en de website.
 *
 * Twee regels die overal gelden:
 *  1. **Geen prijzen.** Die zijn alleen zichtbaar voor ingelogde klanten, via
 *     `/api/assortiment/prijs`. Hier komt nooit een bedrag uit.
 *  2. **Alleen publiceerbare artikelen.** Een artikel moet een foto én een
 *     omschrijving van betekenis hebben. Honderden dunne, bijna-dubbele
 *     pagina's trekken het hele domein omlaag; dat risico is groter dan de
 *     winst van extra zoektermen.
 *
 * Zodra een leverancier beeld of tekst aanlevert, schuift een artikel er
 * vanzelf bij — er is geen aparte publicatiestap.
 */

/**
 * Niet alles in `afbeeldingen` is een bruikbare afbeelding.
 *
 * Twee dingen zijn misgegaan bij de import, en beide breken next/image:
 *  1. Er staan losse teksten in het veld ("Nog niet beschikbaar, handmatig upoaden").
 *  2. Bij tien artikelen zijn MEERDERE URL's in een enkel array-element geplakt,
 *     gescheiden door ", " of "|". De src wordt dan een onzinnige string en het
 *     beeld blijft leeg. In de database is dat rechtgezet; `fotosVan()` vangt het
 *     hier alsnog af, zodat een volgende import de site niet opnieuw sloopt.
 */
export const isFotoUrl = (v: string | null | undefined): v is string =>
  !!v && (v.startsWith('/') || v.startsWith('http')) && !v.includes('|') && !/,\s*https?:\/\//.test(v);

/**
 * Maakt van het ruwe `afbeeldingen`-veld een schone lijst URL's: samengeplakte
 * waarden worden gesplitst, een ontbrekend https:// wordt aangevuld, en alles wat
 * daarna nog geen pad of URL is valt af.
 */
export function fotosVan(ruw: string[] | null | undefined): string[] {
  const uit: string[] = [];
  for (const waarde of ruw ?? []) {
    if (!waarde) continue;
    for (const deel of waarde.split(/\s*(?:,(?=\s*https?:\/\/)|\|)\s*/)) {
      const t = deel.trim();
      if (!t) continue;
      const heel = /^(?:\/|https?:\/\/)/.test(t) ? t : `https://${t}`;
      if (isFotoUrl(heel) && !uit.includes(heel)) uit.push(heel);
    }
  }
  return uit;
}

/** Minimale lengte waarop we een omschrijving als echte content beschouwen. */
const MIN_OMSCHRIJVING = 60;

export type CategorieDef = { slug: string; naam: string; titel: string; intro: string };

/**
 * Vaste, mooie URL's per categorie. Bewust een handmatige lijst en geen
 * geslugificeerde databasewaarde: de categorienaam in de database mag wijzigen
 * zonder dat er linkjuice verdampt.
 */
export const CATEGORIEEN: CategorieDef[] = [
  { slug: 't-shirts-en-polos', naam: "T-shirts & polo's", titel: "Werk-T-shirts en polo's",
    intro: 'Shirts die een werkdag meegaan en een wasbeurt of veertig aankunnen. Met jouw logo geborduurd of bedrukt.' },
  { slug: 'truien-en-vesten', naam: 'Truien & vesten', titel: 'Werktruien, hoodies en vesten',
    intro: 'Warme lagen voor buiten en in de werkplaats: fleecevesten, hoodies en sweaters met rits.' },
  { slug: 'jassen', naam: 'Jassen', titel: 'Werkjassen, softshells en winterjassen',
    intro: 'Van ademende softshell tot gevoerde winterjas. Wind- en waterdicht waar dat moet.' },
  { slug: 'broeken', naam: 'Broeken', titel: 'Werkbroeken',
    intro: 'Werkbroeken met kniezakken, holsterzakken en stretch. Ook in extra lengtes.' },
  { slug: 'korte-broeken', naam: 'Korte broeken', titel: 'Korte werkbroeken',
    intro: 'Voor de zomer, met dezelfde zakken en stevigheid als de lange uitvoering.' },
  { slug: 'blouses-en-overhemden', naam: 'Blouses, overhemden & blazers', titel: 'Blouses, overhemden en blazers',
    intro: 'Representatieve kleding voor kantoor, showroom en receptie.' },
  { slug: 'werkschoenen', naam: 'Werkschoenen', titel: 'Veiligheidsschoenen en werkschoenen',
    intro: 'S1 tot S3, laag of hoog. Kom passen: schoenen koop je niet op maat uit een tabel.' },
  { slug: 'bodywarmers', naam: 'Bodywarmers', titel: 'Bodywarmers',
    intro: 'Warmte op het lijf, bewegingsvrijheid in de armen. Populair als tussenlaag.' },
  { slug: 'accessoires', naam: 'Accessoires', titel: 'Werkaccessoires',
    intro: 'Mutsen, riemen, kniebeschermers en handschoenen die het geheel afmaken.' },
  { slug: 'overalls', naam: 'Overalls', titel: 'Overalls en amerikanen',
    intro: 'Eén stuk, volledige bescherming. Voor onderhoud, industrie en agrarisch werk.' },
  { slug: 'rokken-en-jurken', naam: 'Rokken & jurken', titel: 'Rokken en jurken',
    intro: 'Voor teams die representatief voor de dag komen.' },
];

export const categorieVanSlug = (slug: string) => CATEGORIEEN.find((c) => c.slug === slug) ?? null;

/** Slug uit een naam: accenten weg, alles wat geen letter of cijfer is wordt een streepje. */
export function slugify(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' en ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Producturl-slug. Het artikelnummer zit er bewust achter: er staan vier
 * varianten van "Augusta V-neck Cardigan Lady" in de catalogus die alleen in
 * SKU verschillen. Zonder dat achtervoegsel zouden dat vier pagina's op
 * dezelfde URL zijn.
 */
export const productSlug = (p: { naam: string; sku: string | null }) =>
  [slugify(p.naam), slugify(p.sku ?? '')].filter(Boolean).join('-');

export type PubliekProduct = {
  id: string;
  slug: string;
  naam: string;
  merk: string | null;
  merkSlug: string | null;
  categorie: string | null;
  categorieSlug: string | null;
  subcategorie: string | null;
  geslacht: string | null;
  omschrijving: string | null;
  materiaal: string | null;
  normeringen: string | null;
  foto: string | null;
  fotos: string[];
  maten: string[];
  kleuren: string[];
};

type Rij = {
  id: string; naam: string; sku: string | null; merk: string | null; categorie: string | null;
  subcategorie: string | null; geslacht: string | null; omschrijving: string | null;
  materiaal: string | null; normeringen: string | null; afbeeldingen: string[] | null;
  product_varianten?: { maat: string | null; kleur: string | null }[] | null;
};

/** Maten in een logische volgorde in plaats van alfabetisch (XS, S, M, L, XL…). */
const MAATVOLGORDE = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', 'xxxl', '4xl', '5xl'];
function sorteerMaten(maten: string[]): string[] {
  return [...maten].sort((a, b) => {
    const ia = MAATVOLGORDE.indexOf(a.toLowerCase());
    const ib = MAATVOLGORDE.indexOf(b.toLowerCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b, 'nl');
  });
}

/**
 * Kleurnamen opschonen. De leveranciersdata bevat codes als "9504 - navy\black"
 * en "marine/zwart 1620"; die willen bezoekers niet zien.
 */
function schoneKleur(v: string): string {
  const zonderCode = v.replace(/^\s*\d+\s*-\s*/, '').replace(/\s+\d{3,}\s*$/, '');
  return zonderCode.replace(/\\/g, ' / ').trim();
}

function naarProduct(r: Rij): PubliekProduct {
  const varianten = r.product_varianten ?? [];
  const fotos = fotosVan(r.afbeeldingen);
  const cat = CATEGORIEEN.find((c) => c.naam === r.categorie) ?? null;
  return {
    id: r.id,
    slug: productSlug(r),
    naam: r.naam,
    merk: r.merk,
    merkSlug: r.merk ? slugify(r.merk) : null,
    categorie: r.categorie,
    categorieSlug: cat?.slug ?? null,
    subcategorie: r.subcategorie,
    geslacht: r.geslacht,
    omschrijving: r.omschrijving,
    materiaal: r.materiaal,
    normeringen: r.normeringen,
    foto: fotos[0] ?? null,
    fotos,
    maten: sorteerMaten([...new Set(varianten.map((v) => v.maat).filter((m): m is string => !!m))]),
    kleuren: [...new Set(varianten.map((v) => (v.kleur ? schoneKleur(v.kleur) : null)).filter((k): k is string => !!k))].sort((a, b) => a.localeCompare(b, 'nl')),
  };
}

const VELDEN = 'id, naam, sku, merk, categorie, subcategorie, geslacht, omschrijving, materiaal, normeringen, afbeeldingen';

/** De publiceerbaarheidsregel, op één plek. */
function alleenPubliceerbaar<T>(q: T): T {
  // @ts-expect-error - de Supabase-querybuilder is generiek, de filters bestaan wel.
  return q.eq('actief', true).not('afbeeldingen', 'is', null).not('omschrijving', 'is', null);
}

function isPubliceerbaar(r: Rij): boolean {
  return fotosVan(r.afbeeldingen).length > 0 && (r.omschrijving?.trim().length ?? 0) > MIN_OMSCHRIJVING;
}

export async function listPubliekeProducten(opts: { categorieSlug?: string; merkSlug?: string } = {}): Promise<PubliekProduct[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  let q = alleenPubliceerbaar(sb.from('producten').select(`${VELDEN}, product_varianten(maat, kleur)`)).order('naam');
  const cat = opts.categorieSlug ? categorieVanSlug(opts.categorieSlug) : null;
  if (opts.categorieSlug && !cat) return [];
  if (cat) q = q.eq('categorie', cat.naam);
  const { data } = await q;
  let rijen = ((data as Rij[]) ?? []).filter(isPubliceerbaar);
  if (opts.merkSlug) rijen = rijen.filter((r) => r.merk && slugify(r.merk) === opts.merkSlug);
  return rijen.map(naarProduct);
}

export async function getPubliekProduct(categorieSlug: string, slug: string): Promise<PubliekProduct | null> {
  const producten = await listPubliekeProducten({ categorieSlug });
  return producten.find((p) => p.slug === slug) ?? null;
}

export type CategorieTelling = CategorieDef & { aantal: number };
export type MerkTelling = { naam: string; slug: string; aantal: number };

export async function catalogusOverzicht(): Promise<{ categorieen: CategorieTelling[]; merken: MerkTelling[]; totaal: number }> {
  const producten = await listPubliekeProducten();
  const perCat = new Map<string, number>();
  const perMerk = new Map<string, number>();
  producten.forEach((p) => {
    if (p.categorieSlug) perCat.set(p.categorieSlug, (perCat.get(p.categorieSlug) ?? 0) + 1);
    if (p.merk) perMerk.set(p.merk, (perMerk.get(p.merk) ?? 0) + 1);
  });
  return {
    categorieen: CATEGORIEEN.map((c) => ({ ...c, aantal: perCat.get(c.slug) ?? 0 })).filter((c) => c.aantal > 0),
    merken: [...perMerk.entries()]
      .map(([naam, aantal]) => ({ naam, slug: slugify(naam), aantal }))
      .sort((a, b) => b.aantal - a.aantal),
    totaal: producten.length,
  };
}

/** Alle URL's voor de sitemap en voor statische generatie. */
export type MerkVermelding = { naam: string; slug: string; aantal: number; opDeSite: boolean };

/**
 * Alle merken die in het systeem staan, inclusief de merken waarvan nog geen
 * artikel de publicatiedrempel haalt (foto én omschrijving). Die verkoopt Jessi
 * wel degelijk - FHB en Tricorp bijvoorbeeld - en dan hoort de merkenrij op de
 * homepage ze te noemen. `opDeSite` zegt of er een merkpagina achter zit.
 */
export async function alleMerken(): Promise<MerkVermelding[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb.from('producten').select('merk').not('merk', 'is', null);
  const totaal = new Map<string, number>();
  for (const r of ((data as { merk: string }[]) ?? [])) {
    const m = r.merk?.trim();
    if (m) totaal.set(m, (totaal.get(m) ?? 0) + 1);
  }
  const { merken: gepubliceerd } = await catalogusOverzicht();
  const perSlug = new Map(gepubliceerd.map((m) => [m.slug, m.aantal]));
  return [...totaal.entries()]
    .map(([naam, aantal]) => {
      const slug = slugify(naam);
      return { naam, slug, aantal, opDeSite: perSlug.has(slug) };
    })
    .sort((a, b) => b.aantal - a.aantal);
}

export async function alleProductPaden(): Promise<{ categorie: string; slug: string }[]> {
  const producten = await listPubliekeProducten();
  return producten
    .filter((p) => p.categorieSlug)
    .map((p) => ({ categorie: p.categorieSlug as string, slug: p.slug }));
}
