import { kmsAdmin } from '@/lib/kms/adminClient';
import { normaliseerKleur, sorteerMaten as sorteerVolgensLijst } from '@/lib/kms/variantenStandaard';

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
  /** Welke maten er per kleur leverbaar zijn (opgeschoonde kleurnaam als sleutel). */
  matenPerKleur: Record<string, string[]>;
};

type Rij = {
  id: string; naam: string; sku: string | null; merk: string | null; categorie: string | null;
  subcategorie: string | null; geslacht: string | null; omschrijving: string | null;
  materiaal: string | null; normeringen: string | null; afbeeldingen: string[] | null;
  product_varianten?: { maat: string | null; kleur: string | null }[] | null;
};

/**
 * Maten in een logische volgorde in plaats van alfabetisch (XS, S, M, L, XL…),
 * volgens de vaste maatreeksen uit lib/kms/variantenStandaard.ts.
 */
function sorteerMaten(maten: string[]): string[] {
  return sorteerVolgensLijst(maten);
}

/**
 * Kleurnamen opschonen. De leveranciersdata bevat codes als "9504 - navy\black"
 * en "marine/zwart 1620"; die willen bezoekers niet zien.
 */
export function schoneKleur(v: string): string {
  // Eerst de vaste lijst: "0404 - Black\Black" wordt "Zwart", "9504 - Navy\Black" wordt "Marine/zwart".
  const u = normaliseerKleur(v);
  if (u.naam && (u.zeker || u.nieuw)) return u.naam;
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
    matenPerKleur: (() => {
      const m = new Map<string, Set<string>>();
      for (const v of varianten) {
        if (!v.kleur || !v.maat) continue;
        const k = schoneKleur(v.kleur);
        if (!m.has(k)) m.set(k, new Set());
        m.get(k)!.add(v.maat);
      }
      return Object.fromEntries([...m].map(([k, set]) => [k, sorteerMaten([...set])]));
    })(),
  };
}

/** Foto per kleur voor de publieke productpagina, met dezelfde opgeschoonde kleurnamen als `kleuren`. */
export async function kleurFotosPubliek(productId: string): Promise<Record<string, string>> {
  const sb = kmsAdmin();
  if (!sb) return {};
  const { data } = await sb.from('product_kleur_afbeeldingen').select('kleur, afbeelding_url').eq('product_id', productId);
  const uit: Record<string, string> = {};
  for (const r of (data as { kleur: string | null; afbeelding_url: string | null }[]) ?? []) {
    const url = (r.afbeelding_url ?? '').trim();
    if (!r.kleur || !isFotoUrl(url)) continue;
    const k = schoneKleur(r.kleur);
    if (!uit[k]) uit[k] = url;
  }
  return uit;
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

/**
 * Url van de publieke productpagina, of null als het artikel daar niet staat
 * (inactief, geen foto, te dunne omschrijving of een categorie zonder pagina).
 * Zelfde regels als listPubliekeProducten, zodat een link nooit op een 404 uitkomt.
 */
export function publiekeProductUrl(r: {
  naam: string; sku: string | null; categorie: string | null; omschrijving: string | null;
  afbeeldingen: string[] | null; actief?: boolean | null;
}): string | null {
  if (r.actief === false) return null;
  const cat = CATEGORIEEN.find((c) => c.naam === r.categorie);
  if (!cat) return null;
  if (fotosVan(r.afbeeldingen).length === 0 || (r.omschrijving?.trim().length ?? 0) <= MIN_OMSCHRIJVING) return null;
  return `/assortiment/${cat.slug}/${productSlug(r)}`;
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
/** Wat een productkaart en de filters nodig hebben, en verder niets. */
export type KaartProduct = Pick<
  PubliekProduct,
  'id' | 'slug' | 'naam' | 'merk' | 'categorieSlug' | 'geslacht' | 'foto' | 'maten' | 'kleuren'
>;

/**
 * De lijst en de kaart draaien in de browser. Alles wat je aan een client
 * component meegeeft gaat als JSON mee in de pagina - inclusief omschrijvingen
 * van vijfhonderd tekens en alle fotolinks. Bij 155 artikelen tikt dat hard aan,
 * dus hier een uitgeklede vorm.
 */
export const naarKaart = (p: PubliekProduct): KaartProduct => ({
  id: p.id, slug: p.slug, naam: p.naam, merk: p.merk, categorieSlug: p.categorieSlug,
  geslacht: p.geslacht, foto: p.foto, maten: p.maten, kleuren: p.kleuren,
});

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

/**
 * Kleuren, maten en kleurfoto's voor de artikelen in een offertemandje. Alleen
 * publieke catalogusvelden; geen prijzen of voorraad.
 */
export async function mandGegevens(ids: string[]): Promise<Record<string, { kleuren: string[]; maten: string[]; kleurFotos: Record<string, string> }>> {
  const sb = kmsAdmin();
  if (!sb || !ids.length) return {};
  const { data } = await sb
    .from('producten')
    .select(`${VELDEN}, product_varianten(maat, kleur), product_kleur_afbeeldingen(kleur, afbeelding_url)`)
    .eq('actief', true)
    .in('id', ids);
  type MetFotos = Rij & { product_kleur_afbeeldingen?: { kleur: string | null; afbeelding_url: string | null }[] | null };
  const uit: Record<string, { kleuren: string[]; maten: string[]; kleurFotos: Record<string, string> }> = {};
  for (const r of (data as MetFotos[]) ?? []) {
    const p = naarProduct(r);
    const kleurFotos: Record<string, string> = {};
    for (const k of r.product_kleur_afbeeldingen ?? []) {
      const url = (k.afbeelding_url ?? '').trim();
      if (!k.kleur || !isFotoUrl(url)) continue;
      const naam = schoneKleur(k.kleur);
      if (!kleurFotos[naam]) kleurFotos[naam] = url;
    }
    uit[r.id] = { kleuren: p.kleuren, maten: p.maten, kleurFotos };
  }
  return uit;
}
