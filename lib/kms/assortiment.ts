import type { SupabaseClient } from '@supabase/supabase-js';
import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor het assortiment per klant: welke producten een organisatie mag bestellen
 * en met welk verstrekkingstype (budget, periodiek gratis, altijd gratis of punten).
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export const VERSTREKKING_TYPES = ['budget', 'periodiek_gratis', 'altijd_gratis', 'punten'] as const;
export type VerstrekkingType = (typeof VERSTREKKING_TYPES)[number];

export const PERIODE_TYPES = ['maand', 'kwartaal', 'jaar'] as const;
export type Periode = (typeof PERIODE_TYPES)[number];

/** Een regel uit de assortiment-tabel met de verstrekkingsinstellingen. */
export type AssortimentRegel = {
  id: string;
  organisatie_id: string;
  product_id: string;
  afdeling_id: string | null;
  medewerker_id: string | null;
  toegestaan: boolean;
  verstrekking_type: VerstrekkingType;
  gratis_per_periode: number | null;
  periode: Periode;
};

/** Een product met of het in het assortiment van de organisatie zit en de verstrekkingsinstellingen. */
export type AssortimentProduct = {
  product_id: string;
  naam: string;
  merk: string | null;
  in_assortiment: boolean;
  assortiment_id: string | null;
  toegestaan: boolean;
  verstrekking_type: VerstrekkingType;
  gratis_per_periode: number | null;
  periode: Periode;
};

function normaliseerType(v: string | null): VerstrekkingType {
  return (VERSTREKKING_TYPES as readonly string[]).includes(v ?? '')
    ? (v as VerstrekkingType)
    : 'budget';
}

function normaliseerPeriode(v: string | null): Periode {
  return (PERIODE_TYPES as readonly string[]).includes(v ?? '') ? (v as Periode) : 'jaar';
}

/** Alle producten met of ze in het assortiment van deze organisatie zitten en hun verstrekkingsinstellingen. */
export async function listAssortiment(orgId: string): Promise<AssortimentProduct[]> {
  const sb = kmsAdmin();
  if (!sb) return [];

  const [{ data: producten }, { data: regels }] = await Promise.all([
    sb.from('producten').select('id, naam, merk').eq('actief', true).order('naam'),
    sb
      .from('assortiment')
      .select('id, product_id, toegestaan, verstrekking_type, gratis_per_periode, periode')
      .eq('organisatie_id', orgId),
  ]);

  const prodLijst = (producten as { id: string; naam: string; merk: string | null }[]) ?? [];
  const regelLijst =
    (regels as {
      id: string;
      product_id: string;
      toegestaan: boolean;
      verstrekking_type: string | null;
      gratis_per_periode: number | null;
      periode: string | null;
    }[]) ?? [];

  const perProduct = new Map<string, (typeof regelLijst)[number]>();
  for (const r of regelLijst) if (!perProduct.has(r.product_id)) perProduct.set(r.product_id, r);

  return prodLijst.map((p) => {
    const r = perProduct.get(p.id);
    return {
      product_id: p.id,
      naam: p.naam,
      merk: p.merk,
      in_assortiment: Boolean(r),
      assortiment_id: r?.id ?? null,
      toegestaan: r ? Boolean(r.toegestaan) : true,
      verstrekking_type: normaliseerType(r?.verstrekking_type ?? null),
      gratis_per_periode: r?.gratis_per_periode ?? null,
      periode: normaliseerPeriode(r?.periode ?? null),
    };
  });
}

/** Alle actieve producten voor de keuze (id, naam, merk). */
export async function listProducten(): Promise<{ id: string; naam: string; merk: string | null }[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb.from('producten').select('id, naam, merk').eq('actief', true).order('naam');
  return (data as { id: string; naam: string; merk: string | null }[]) ?? [];
}

/**
 * Zet een product in of uit het assortiment van een organisatie.
 * Aan: maakt een assortimentregel aan als die nog niet bestaat (standaard verstrekking 'budget').
 * Uit: verwijdert alle regels van dit product voor deze organisatie.
 */
export async function zetInAssortiment(orgId: string, productId: string, aan: boolean): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;

  if (!aan) {
    const { error } = await sb
      .from('assortiment')
      .delete()
      .eq('organisatie_id', orgId)
      .eq('product_id', productId);
    return !error;
  }

  // Bestaat er al een regel, dan niets te doen.
  const { data: bestaand } = await sb
    .from('assortiment')
    .select('id')
    .eq('organisatie_id', orgId)
    .eq('product_id', productId)
    .limit(1)
    .maybeSingle();
  if (bestaand) return true;

  const { error } = await sb.from('assortiment').insert({
    organisatie_id: orgId,
    product_id: productId,
    toegestaan: true,
    verstrekking_type: 'budget',
    periode: 'jaar',
  });
  return !error;
}

/** Velden die je voor een verstrekking kunt zetten. */
export type VerstrekkingVelden = {
  verstrekking_type: VerstrekkingType;
  gratis_per_periode: number | null;
  periode: Periode;
};

/** Verstrekkingsvelden opschonen voor de database. */
function schoneVerstrekking(velden: VerstrekkingVelden): VerstrekkingVelden {
  return {
    verstrekking_type: normaliseerType(velden.verstrekking_type),
    // Een aantal heeft alleen betekenis bij periodiek gratis.
    gratis_per_periode:
      velden.verstrekking_type === 'periodiek_gratis'
        ? velden.gratis_per_periode != null && velden.gratis_per_periode >= 0
          ? Math.floor(velden.gratis_per_periode)
          : 0
        : null,
    periode: normaliseerPeriode(velden.periode),
  };
}

/**
 * Werkt de verstrekkingsinstellingen van een product in het assortiment bij.
 * Kan op assortiment-id of op de combinatie organisatie + product.
 * Bestaat er nog geen regel (bij org+product), dan wordt er een aangemaakt.
 */
export async function zetVerstrekking(
  ref: { assortimentId: string } | { orgId: string; productId: string },
  velden: VerstrekkingVelden,
): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;

  const schoon = schoneVerstrekking(velden);

  if ('assortimentId' in ref) {
    const { error } = await sb.from('assortiment').update(schoon).eq('id', ref.assortimentId);
    return !error;
  }

  const { data: bestaand } = await sb
    .from('assortiment')
    .select('id')
    .eq('organisatie_id', ref.orgId)
    .eq('product_id', ref.productId)
    .limit(1)
    .maybeSingle();

  if (bestaand) {
    const { error } = await sb
      .from('assortiment')
      .update(schoon)
      .eq('id', (bestaand as { id: string }).id);
    return !error;
  }

  const { error } = await sb.from('assortiment').insert({
    organisatie_id: ref.orgId,
    product_id: ref.productId,
    toegestaan: true,
    ...schoon,
  });
  return !error;
}

/* ------------------------------------------------------------------------- */
/* Hulp: alle rijen ophalen, ook boven de 1000.                               */
/* ------------------------------------------------------------------------- */

/**
 * Supabase geeft per verzoek hoogstens 1000 rijen terug (instelling max-rows),
 * ook als je in de query een hogere limit zet. Daardoor kwamen bij artikelen
 * met veel maten de kleuren maar half of helemaal niet mee. Deze hulp haalt in
 * blokken van 1000 op tot alles binnen is.
 *
 * `pagina` krijgt het begin en eind van het blok en moet een query met
 * `.range(van, tot)` en een vaste volgorde (`.order('id')`) teruggeven.
 */
export async function haalAlles<T>(
  pagina: (van: number, tot: number) => PromiseLike<{ data: unknown; error: unknown }>,
  stap = 1000,
): Promise<T[]> {
  const uit: T[] = [];
  for (let i = 0; i < 200; i++) {
    const van = i * stap;
    const { data, error } = await pagina(van, van + stap - 1);
    if (error) break;
    const rijen = (data as T[]) ?? [];
    uit.push(...rijen);
    if (rijen.length < stap) break;
  }
  return uit;
}

/** Een id-lijst in stukken, zodat de query-URL niet te lang wordt. */
export function inStukken<T>(lijst: T[], grootte = 150): T[][] {
  const uit: T[][] = [];
  for (let i = 0; i < lijst.length; i += grootte) uit.push(lijst.slice(i, i + grootte));
  return uit;
}

/** Kleuren vergelijken zonder last van hoofdletters of spaties. */
export function zelfdeKleur(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}

/* ------------------------------------------------------------------------- */
/* Kleuren van een artikel, met foto per kleur.                               */
/* ------------------------------------------------------------------------- */

export type KleurKeuze = { kleur: string; afbeelding: string | null };

type VariantKleurRij = { product_id: string; kleur: string | null; actief: boolean | null };
type KleurFotoRij = { product_id: string; kleur: string | null; afbeelding_url: string | null };

/** Varianten (product, kleur, actief) van een reeks artikelen, alles opgehaald. */
async function haalVariantKleuren(sb: SupabaseClient, productIds: string[]): Promise<VariantKleurRij[]> {
  const uit: VariantKleurRij[] = [];
  for (const stuk of inStukken(productIds)) {
    const rijen = await haalAlles<VariantKleurRij>((van, tot) =>
      sb
        .from('product_varianten')
        .select('product_id, kleur, actief')
        .in('product_id', stuk)
        .order('id')
        .range(van, tot),
    );
    uit.push(...rijen);
  }
  return uit;
}

/** Kleurfoto's van een reeks artikelen, alles opgehaald. */
async function haalKleurFotos(sb: SupabaseClient, productIds: string[]): Promise<KleurFotoRij[]> {
  const uit: KleurFotoRij[] = [];
  for (const stuk of inStukken(productIds)) {
    const rijen = await haalAlles<KleurFotoRij>((van, tot) =>
      sb
        .from('product_kleur_afbeeldingen')
        .select('product_id, kleur, afbeelding_url')
        .in('product_id', stuk)
        .order('id')
        .range(van, tot),
    );
    uit.push(...rijen);
  }
  return uit;
}

/**
 * Per artikel de kleuren met foto. De kleuren komen uit de actieve varianten
 * (alleen een expliciete false telt als niet actief). Heeft een artikel geen
 * kleur op de varianten maar wel kleurfoto's, dan gelden die kleuren.
 * De foto is de kleurfoto, anders de eerste foto van het artikel.
 */
export async function kleurenPerArtikel(
  sb: SupabaseClient,
  productIds: string[],
  hoofdfoto: Map<string, string | null> = new Map(),
): Promise<Map<string, KleurKeuze[]>> {
  const uit = new Map<string, KleurKeuze[]>();
  if (productIds.length === 0) return uit;
  const [varianten, fotos] = await Promise.all([
    haalVariantKleuren(sb, productIds),
    haalKleurFotos(sb, productIds),
  ]);

  const fotoVan = new Map<string, string>();
  const fotoKleuren = new Map<string, string[]>();
  for (const f of fotos) {
    const kleur = (f.kleur ?? '').trim();
    if (!kleur || !f.afbeelding_url) continue;
    const sleutel = `${f.product_id}|${kleur.toLowerCase()}`;
    if (!fotoVan.has(sleutel)) fotoVan.set(sleutel, f.afbeelding_url);
    const lijst = fotoKleuren.get(f.product_id) ?? [];
    if (!lijst.some((k) => zelfdeKleur(k, kleur))) lijst.push(kleur);
    fotoKleuren.set(f.product_id, lijst);
  }

  const variantKleuren = new Map<string, string[]>();
  for (const v of varianten) {
    if (v.actief === false) continue;
    const kleur = (v.kleur ?? '').trim();
    if (!kleur) continue;
    const lijst = variantKleuren.get(v.product_id) ?? [];
    if (!lijst.some((k) => zelfdeKleur(k, kleur))) lijst.push(kleur);
    variantKleuren.set(v.product_id, lijst);
  }

  for (const id of productIds) {
    const kleuren = variantKleuren.get(id) ?? fotoKleuren.get(id) ?? [];
    uit.set(
      id,
      [...kleuren]
        .sort((a, b) => a.localeCompare(b, 'nl'))
        .map((kleur) => ({
          kleur,
          afbeelding: fotoVan.get(`${id}|${kleur.toLowerCase()}`) ?? hoofdfoto.get(id) ?? null,
        })),
    );
  }
  return uit;
}

/** De kleuren van één artikel, met foto per kleur. Voor de artikelkiezer. */
export async function kleurKeuzesVoorArtikel(productId: string): Promise<KleurKeuze[]> {
  const sb = kmsAdmin();
  if (!sb || !productId) return [];
  const { data } = await sb.from('producten').select('id, afbeeldingen').eq('id', productId).maybeSingle();
  const rij = data as { id: string; afbeeldingen: string[] | null } | null;
  const hoofdfoto = new Map<string, string | null>([[productId, (rij?.afbeeldingen ?? [])[0] ?? null]]);
  const kaart = await kleurenPerArtikel(sb, [productId], hoofdfoto);
  return kaart.get(productId) ?? [];
}

/* ------------------------------------------------------------------------- */
/* Assortiment van één klant: overzicht, toevoegen, bijwerken, verwijderen.   */
/* ------------------------------------------------------------------------- */

/** De kolommen van een assortimentregel, zonder de later toegevoegde kleur. */
const REGELVELDEN =
  'id, product_id, afdeling_id, medewerker_id, toegestaan, verstrekking_type, gratis_per_periode, periode';

type RegelRij = {
  id: string;
  product_id: string | null;
  afdeling_id: string | null;
  medewerker_id: string | null;
  toegestaan: boolean | null;
  verstrekking_type: string | null;
  gratis_per_periode: number | null;
  periode: string | null;
  kleur: string | null;
};

/**
 * De assortimentregels van één organisatie.
 *
 * `kleur` is later aan de tabel toegevoegd. Draait een omgeving die migratie nog
 * niet, dan zou een select met die kolom de hele query laten mislukken en bleef
 * het scherm leeg. Daarom valt hij één keer terug op de kolommen die er zeker zijn.
 */
async function haalRegels(sb: SupabaseClient, orgId: string): Promise<RegelRij[]> {
  const metKleur = await sb
    .from('assortiment')
    .select(`${REGELVELDEN}, kleur`)
    .eq('organisatie_id', orgId)
    .order('id')
    .limit(1000);
  if (!metKleur.error) {
    const eerste = (metKleur.data as RegelRij[]) ?? [];
    if (eerste.length < 1000) return eerste;
    return haalAlles<RegelRij>((van, tot) =>
      sb
        .from('assortiment')
        .select(`${REGELVELDEN}, kleur`)
        .eq('organisatie_id', orgId)
        .order('id')
        .range(van, tot),
    );
  }

  const zonderKleur = await sb
    .from('assortiment')
    .select(REGELVELDEN)
    .eq('organisatie_id', orgId)
    .limit(1000);
  return ((zonderKleur.data as Omit<RegelRij, 'kleur'>[]) ?? []).map((r) => ({ ...r, kleur: null }));
}

/** De assortimentregels van een klant zoals andere modules ze nodig hebben. */
export type KaleRegel = {
  id: string;
  product_id: string;
  afdeling_id: string | null;
  medewerker_id: string | null;
  kleur: string | null;
  toegestaan: boolean;
};

export async function listKaleRegels(orgId: string): Promise<KaleRegel[]> {
  const sb = kmsAdmin();
  if (!sb || !orgId) return [];
  return (await haalRegels(sb, orgId))
    .filter((r): r is RegelRij & { product_id: string } => Boolean(r.product_id))
    .map((r) => ({
      id: r.id,
      product_id: r.product_id,
      afdeling_id: r.afdeling_id,
      medewerker_id: r.medewerker_id,
      kleur: r.kleur?.trim() || null,
      toegestaan: r.toegestaan !== false,
    }));
}

/**
 * Geldt deze assortimentregel voor deze werknemer? Een regel zonder afdeling en
 * zonder werknemer geldt voor de hele klant; anders moet de afdeling of de
 * werknemer zelf kloppen.
 */
export function regelGeldtVoor(
  regel: { afdeling_id: string | null; medewerker_id: string | null },
  werknemer: { id: string; afdeling_id: string | null },
): boolean {
  if (regel.medewerker_id) return regel.medewerker_id === werknemer.id;
  if (regel.afdeling_id) return regel.afdeling_id === werknemer.afdeling_id;
  return true;
}

/** Eén regel uit het assortiment van een klant, met de artikelgegevens erbij. */
export type AssortimentRij = {
  id: string;
  product_id: string;
  naam: string;
  merk: string | null;
  categorie: string | null;
  sku: string | null;
  /** Foto in de gekozen kleur, anders de hoofdfoto van het artikel. */
  afbeelding: string | null;
  /** Blijft null zolang de kleur-migratie nog niet gedraaid is. */
  kleur: string | null;
  /** De kleuren die dit artikel in de catalogus heeft. */
  kleuren: string[];
  toegestaan: boolean;
  verstrekking_type: VerstrekkingType;
  gratis_per_periode: number | null;
  periode: Periode;
  /** Staat het artikel zelf nog actief in de catalogus? */
  artikel_actief: boolean;
  /** Afdeling of medewerker waarvoor deze regel geldt; null = de hele klant. */
  bereik: string | null;
  afdeling_id: string | null;
  medewerker_id: string | null;
};

/**
 * Het assortiment van één klant: alleen wat er daadwerkelijk in staat, met foto
 * in de gekozen kleur en verstrekking. Dit is de lijst die Jessi op de
 * klantpagina ziet.
 *
 * Een artikel dat op inactief staat blijft in de lijst staan met een melding;
 * stil verdwijnen zou betekenen dat een klant iets bestelt wat zij niet ziet.
 */
export async function listKlantAssortiment(orgId: string): Promise<AssortimentRij[]> {
  const sb = kmsAdmin();
  if (!sb || !orgId) return [];

  const regels = await haalRegels(sb, orgId);
  const productIds = [
    ...new Set(regels.map((r) => r.product_id).filter((v): v is string => Boolean(v))),
  ];
  if (productIds.length === 0) return [];

  type ArtikelRij = {
    id: string;
    naam: string | null;
    merk: string | null;
    categorie: string | null;
    sku: string | null;
    afbeeldingen: string[] | null;
    actief: boolean | null;
  };
  const artikelen: ArtikelRij[] = [];
  for (const stuk of inStukken(productIds)) {
    const { data } = await sb
      .from('producten')
      .select('id, naam, merk, categorie, sku, afbeeldingen, actief')
      .in('id', stuk);
    artikelen.push(...((data as ArtikelRij[]) ?? []));
  }
  const artikelVan = new Map<string, ArtikelRij>();
  const hoofdfoto = new Map<string, string | null>();
  for (const a of artikelen) {
    artikelVan.set(a.id, a);
    hoofdfoto.set(a.id, (a.afbeeldingen ?? [])[0] ?? null);
  }

  const kleurenVan = await kleurenPerArtikel(sb, productIds, hoofdfoto);

  // Namen van afdelingen en medewerkers alleen ophalen als er ook regels zijn
  // die daarop staan; bij de meeste klanten geldt alles voor iedereen.
  const bereikVan = new Map<string, string>();
  const afdelingIds = [
    ...new Set(regels.map((r) => r.afdeling_id).filter((v): v is string => Boolean(v))),
  ];
  if (afdelingIds.length > 0) {
    const { data } = await sb.from('afdelingen').select('id, naam').in('id', afdelingIds);
    for (const a of (data as { id: string; naam: string | null }[]) ?? []) {
      if (a.naam) bereikVan.set(`afdeling:${a.id}`, `afdeling ${a.naam}`);
    }
  }
  const medewerkerIds = [
    ...new Set(regels.map((r) => r.medewerker_id).filter((v): v is string => Boolean(v))),
  ];
  if (medewerkerIds.length > 0) {
    const { data } = await sb.from('medewerkers').select('id, naam').in('id', medewerkerIds);
    for (const m of (data as { id: string; naam: string | null }[]) ?? []) {
      if (m.naam) bereikVan.set(`medewerker:${m.id}`, m.naam);
    }
  }

  const rijen: AssortimentRij[] = [];
  for (const r of regels) {
    const artikel = r.product_id ? artikelVan.get(r.product_id) : undefined;
    // Een regel zonder artikel is een verweesde rij (product verwijderd); die
    // heeft niets te tonen en zou alleen maar een lege regel opleveren.
    if (!r.product_id || !artikel) continue;
    const kleur = r.kleur?.trim() || null;
    const kleuren = kleurenVan.get(r.product_id) ?? [];
    const kleurFoto = kleur ? kleuren.find((k) => zelfdeKleur(k.kleur, kleur))?.afbeelding : null;
    rijen.push({
      id: r.id,
      product_id: r.product_id,
      naam: artikel.naam?.trim() || 'Naamloos',
      merk: artikel.merk,
      categorie: artikel.categorie,
      sku: artikel.sku,
      afbeelding: kleurFoto ?? hoofdfoto.get(r.product_id) ?? null,
      kleur,
      kleuren: kleuren.map((k) => k.kleur),
      toegestaan: r.toegestaan !== false,
      verstrekking_type: normaliseerType(r.verstrekking_type),
      gratis_per_periode: r.gratis_per_periode,
      periode: normaliseerPeriode(r.periode),
      artikel_actief: artikel.actief !== false,
      bereik:
        (r.afdeling_id ? bereikVan.get(`afdeling:${r.afdeling_id}`) ?? 'een verwijderde afdeling' : null) ??
        (r.medewerker_id ? bereikVan.get(`medewerker:${r.medewerker_id}`) ?? 'één werknemer' : null) ??
        null,
      afdeling_id: r.afdeling_id,
      medewerker_id: r.medewerker_id,
    });
  }

  return rijen.sort(
    (a, b) =>
      (a.merk ?? '').localeCompare(b.merk ?? '', 'nl') ||
      a.naam.localeCompare(b.naam, 'nl') ||
      (a.kleur ?? '').localeCompare(b.kleur ?? '', 'nl') ||
      (a.bereik ?? '').localeCompare(b.bereik ?? '', 'nl'),
  );
}

/** Wat er nodig is om een artikel aan het assortiment van een klant toe te voegen. */
export type NieuweAssortimentRegel = VerstrekkingVelden & {
  productId: string;
  kleur: string | null;
  /** Leeg = de hele klant; anders één regel per afdeling. */
  afdelingIds?: string[];
};

export type ToevoegResultaat =
  | 'toegevoegd'
  | 'toegevoegd_zonder_kleur'
  | 'bestaat_al'
  | 'kleur_verplicht'
  | 'mislukt';

/**
 * Zin die Jessi te zien krijgt zolang de kolom `assortiment.kleur` nog niet
 * bestaat. Zonder deze melding zou ze de kleur invullen, daarna 'Alle kleuren'
 * in de lijst zien staan en denken dat het systeem haar keuze kwijtraakt.
 */
export const KLEUR_NOG_NIET_BESCHIKBAAR =
  'De kleur is nog niet bewaard: de database heeft daar nog geen veld voor. De rest is wel opgeslagen. Laat dat veld toevoegen, dan blijft de kleur voortaan staan.';

/**
 * Artikel toevoegen aan het assortiment van een klant, inclusief kleur,
 * verstrekking en voor wie het geldt (hele klant of één of meer afdelingen).
 *
 * Heeft het artikel kleuren, dan is een kleur verplicht: de kleur ligt daarna
 * vast. Dezelfde jas in twee kleuren mag; dezelfde jas twee keer in dezelfde
 * kleur voor dezelfde groep is altijd een vergissing.
 */
export async function voegAssortimentRegelToe(
  orgId: string,
  invoer: NieuweAssortimentRegel,
): Promise<{ uitkomst: ToevoegResultaat; toegevoegd: number; overgeslagen: number }> {
  const sb = kmsAdmin();
  if (!sb || !orgId || !invoer.productId) return { uitkomst: 'mislukt', toegevoegd: 0, overgeslagen: 0 };

  const kleur = invoer.kleur?.trim() || null;
  if (!kleur) {
    const kleuren = await kleurKeuzesVoorArtikel(invoer.productId);
    if (kleuren.length > 0) return { uitkomst: 'kleur_verplicht', toegevoegd: 0, overgeslagen: 0 };
  }

  const groepen: (string | null)[] =
    invoer.afdelingIds && invoer.afdelingIds.length > 0 ? [...new Set(invoer.afdelingIds)] : [null];

  const bestaande = await haalRegels(sb, orgId);
  const nieuw = groepen.filter(
    (afdelingId) =>
      !bestaande.some(
        (r) =>
          r.product_id === invoer.productId &&
          (r.kleur?.trim() || null) === kleur &&
          (r.afdeling_id ?? null) === afdelingId &&
          !r.medewerker_id,
      ),
  );
  const overgeslagen = groepen.length - nieuw.length;
  if (nieuw.length === 0) return { uitkomst: 'bestaat_al', toegevoegd: 0, overgeslagen };

  type Rij = {
    organisatie_id: string;
    product_id: string;
    toegestaan: boolean;
    verstrekking_type: VerstrekkingType;
    gratis_per_periode: number | null;
    periode: Periode;
    afdeling_id?: string;
    kleur?: string;
  };
  const rijen: Rij[] = nieuw.map((afdelingId) => {
    const rij: Rij = {
      organisatie_id: orgId,
      product_id: invoer.productId,
      toegestaan: true,
      ...schoneVerstrekking(invoer),
    };
    if (afdelingId) rij.afdeling_id = afdelingId;
    // Kleur alleen meesturen als er een kleur gekozen is. Zo werkt toevoegen ook
    // op een database waar de kleur-migratie nog niet gedraaid heeft.
    if (kleur) rij.kleur = kleur;
    return rij;
  });

  const { error } = await sb.from('assortiment').insert(rijen);
  if (!error) return { uitkomst: 'toegevoegd', toegevoegd: rijen.length, overgeslagen };
  if (!kleur) return { uitkomst: 'mislukt', toegevoegd: 0, overgeslagen };

  const zonderKleur = rijen.map((r) => {
    const kopie = { ...r };
    delete kopie.kleur;
    return kopie;
  });
  const tweedePoging = await sb.from('assortiment').insert(zonderKleur);
  return tweedePoging.error
    ? { uitkomst: 'mislukt', toegevoegd: 0, overgeslagen }
    : { uitkomst: 'toegevoegd_zonder_kleur', toegevoegd: rijen.length, overgeslagen };
}

/**
 * Uitkomst van het bijwerken van een assortimentregel.
 * `dubbel` betekent: dit artikel staat in die kleur al voor dezelfde groep.
 */
export type BijwerkResultaat = 'opgeslagen' | 'opgeslagen_zonder_kleur' | 'dubbel' | 'mislukt';

/**
 * Verstrekking en/of de groep (hele klant of afdeling) van een bestaande
 * assortimentregel bijwerken. `afdeling_id` weglaten laat de groep staan;
 * null zet hem op de hele klant.
 *
 * De kleur ligt na het toevoegen vast; wie een andere kleur wil, haalt de regel
 * weg en voegt hem opnieuw toe. `kleur` wordt hier daarom alleen nog doorgegeven
 * door oudere aanroepen en standaard ongemoeid gelaten.
 */
export async function werkAssortimentRegelBij(
  regelId: string,
  velden: VerstrekkingVelden & { kleur?: string | null; afdeling_id?: string | null },
): Promise<{ uitkomst: BijwerkResultaat; voor: Record<string, unknown>; na: Record<string, unknown> }> {
  const sb = kmsAdmin();
  if (!sb || !regelId) return { uitkomst: 'mislukt', voor: {}, na: {} };

  const nieuweKleur: string | null | undefined =
    velden.kleur === undefined ? undefined : velden.kleur?.trim() || null;
  const nieuweAfdeling: string | null | undefined =
    velden.afdeling_id === undefined ? undefined : velden.afdeling_id || null;

  const { data: huidigData } = await sb
    .from('assortiment')
    .select('*')
    .eq('id', regelId)
    .maybeSingle();
  const huidig = (huidigData as Record<string, unknown> | null) ?? null;
  if (!huidig) return { uitkomst: 'mislukt', voor: {}, na: {} };

  const patch: Record<string, unknown> = { ...schoneVerstrekking(velden) };
  if (nieuweKleur !== undefined) patch.kleur = nieuweKleur;
  if (nieuweAfdeling !== undefined) {
    patch.afdeling_id = nieuweAfdeling;
    // Een regel voor een afdeling of de hele klant is niet meer voor één werknemer.
    if (huidig.medewerker_id) patch.medewerker_id = null;
  }

  // Alleen wat echt verandert gaat naar de database en het logboek.
  const voor: Record<string, unknown> = {};
  const na: Record<string, unknown> = {};
  for (const [sleutel, waarde] of Object.entries(patch)) {
    if ((huidig[sleutel] ?? null) !== (waarde ?? null)) {
      voor[sleutel] = huidig[sleutel] ?? null;
      na[sleutel] = waarde;
    }
  }
  if (Object.keys(na).length === 0) return { uitkomst: 'opgeslagen', voor, na };

  if ('kleur' in na || 'afdeling_id' in na) {
    const orgId = String(huidig.organisatie_id ?? '');
    const productId = String(huidig.product_id ?? '');
    const kleur = 'kleur' in na ? (na.kleur as string | null) : ((huidig.kleur as string | null)?.trim() || null);
    const afdelingId =
      'afdeling_id' in na ? (na.afdeling_id as string | null) : ((huidig.afdeling_id as string | null) ?? null);
    const medewerkerId =
      'medewerker_id' in na ? null : ((huidig.medewerker_id as string | null) ?? null);
    const bestaande = await haalRegels(sb, orgId);
    const dubbel = bestaande.some(
      (r) =>
        r.id !== regelId &&
        r.product_id === productId &&
        (r.kleur?.trim() || null) === kleur &&
        (r.afdeling_id ?? null) === afdelingId &&
        (r.medewerker_id ?? null) === medewerkerId,
    );
    if (dubbel) return { uitkomst: 'dubbel', voor, na };
  }

  const { error } = await sb.from('assortiment').update(na).eq('id', regelId);
  if (!error) return { uitkomst: 'opgeslagen', voor, na };
  if (!('kleur' in na)) return { uitkomst: 'mislukt', voor, na };

  const zonderKleur = { ...na };
  delete zonderKleur.kleur;
  const tweedePoging = await sb.from('assortiment').update(zonderKleur).eq('id', regelId);
  return { uitkomst: tweedePoging.error ? 'mislukt' : 'opgeslagen_zonder_kleur', voor, na };
}

/**
 * Antwoord van de assortiment-serveracties op de klantpagina.
 * Staat hier en niet in actions.ts, omdat een bestand met 'use server' alleen
 * async functies mag exporteren.
 *
 * `waarschuwing` is voor het geval dat de handeling wel gelukt is maar niet
 * helemaal, zoals een kleur die nog niet bewaard kan worden. Die zin moet Jessi
 * zien, anders trekt ze zelf de conclusie dat het systeem iets kwijtraakt.
 */
export type AssortimentAntwoord = { ok: boolean; melding: string; waarschuwing?: string };

/** Eén regel uit het assortiment halen. Raakt het artikel zelf niet aan. */
export async function verwijderAssortimentRegel(regelId: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !regelId) return false;
  const { error } = await sb.from('assortiment').delete().eq('id', regelId);
  return !error;
}
