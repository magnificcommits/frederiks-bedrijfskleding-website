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
 * `kleur` is later aan de tabel toegevoegd (zie de migratie bij deze wijziging).
 * Draait een omgeving die migratie nog niet, dan zou een select met die kolom de
 * hele query laten mislukken en bleef het scherm leeg. Daarom valt hij één keer
 * terug op de kolommen die er zeker zijn.
 */
async function haalRegels(sb: SupabaseClient, orgId: string): Promise<RegelRij[]> {
  const metKleur = await sb
    .from('assortiment')
    .select(`${REGELVELDEN}, kleur`)
    .eq('organisatie_id', orgId)
    .limit(5000);
  if (!metKleur.error) return (metKleur.data as RegelRij[]) ?? [];

  const zonderKleur = await sb
    .from('assortiment')
    .select(REGELVELDEN)
    .eq('organisatie_id', orgId)
    .limit(5000);
  return ((zonderKleur.data as Omit<RegelRij, 'kleur'>[]) ?? []).map((r) => ({ ...r, kleur: null }));
}

/** Eén regel uit het assortiment van een klant, met de artikelgegevens erbij. */
export type AssortimentRij = {
  id: string;
  product_id: string;
  naam: string;
  merk: string | null;
  categorie: string | null;
  sku: string | null;
  afbeelding: string | null;
  /** Blijft null zolang de kleur-migratie nog niet gedraaid is. */
  kleur: string | null;
  /** De kleuren die dit artikel in de catalogus heeft, om uit te kiezen. */
  kleuren: string[];
  toegestaan: boolean;
  verstrekking_type: VerstrekkingType;
  gratis_per_periode: number | null;
  periode: Periode;
  /** Staat het artikel zelf nog actief in de catalogus? */
  artikel_actief: boolean;
  /** Afdeling of medewerker waarvoor deze regel geldt; null = de hele klant. */
  bereik: string | null;
};

/**
 * Het assortiment van één klant: alleen wat er daadwerkelijk in staat, met foto,
 * kleur en verstrekking. Dit is de lijst die Jessi op de klantpagina ziet.
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

  const [{ data: artikelData }, { data: variantData }] = await Promise.all([
    sb
      .from('producten')
      .select('id, naam, merk, categorie, sku, afbeeldingen, actief')
      .in('id', productIds)
      .limit(5000),
    sb
      .from('product_varianten')
      .select('product_id, kleur, actief')
      .in('product_id', productIds)
      .limit(20000),
  ]);

  type ArtikelRij = {
    id: string;
    naam: string | null;
    merk: string | null;
    categorie: string | null;
    sku: string | null;
    afbeeldingen: string[] | null;
    actief: boolean | null;
  };
  const artikelVan = new Map<string, ArtikelRij>();
  for (const a of (artikelData as ArtikelRij[]) ?? []) artikelVan.set(a.id, a);

  // De kleuren die het artikel echt heeft, zodat Jessi een kleur kan kiezen in
  // plaats van hem over te typen. Alleen een expliciete false verbergt een
  // variant; bij oudere rijen staat hier null en die horen er gewoon bij.
  type VariantRij = { product_id: string; kleur: string | null; actief: boolean | null };
  const kleurenVan = new Map<string, string[]>();
  for (const v of (variantData as VariantRij[]) ?? []) {
    if (v.actief === false) continue;
    const kleur = (v.kleur ?? '').trim();
    if (!kleur) continue;
    const lijst = kleurenVan.get(v.product_id);
    if (!lijst) kleurenVan.set(v.product_id, [kleur]);
    else if (!lijst.includes(kleur)) lijst.push(kleur);
  }
  for (const lijst of kleurenVan.values()) lijst.sort((a, b) => a.localeCompare(b, 'nl'));

  // Namen van afdelingen en medewerkers alleen ophalen als er ook regels zijn
  // die daarop staan; bij de meeste klanten geldt alles voor iedereen.
  const bereikVan = new Map<string, string>();
  const afdelingIds = [
    ...new Set(regels.map((r) => r.afdeling_id).filter((v): v is string => Boolean(v))),
  ];
  if (afdelingIds.length > 0) {
    const { data } = await sb.from('afdelingen').select('id, naam').in('id', afdelingIds);
    for (const a of (data as { id: string; naam: string | null }[]) ?? []) {
      if (a.naam) bereikVan.set(`afdeling:${a.id}`, `Afdeling ${a.naam}`);
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
    rijen.push({
      id: r.id,
      product_id: r.product_id,
      naam: artikel.naam?.trim() || 'Naamloos',
      merk: artikel.merk,
      categorie: artikel.categorie,
      sku: artikel.sku,
      afbeelding: (artikel.afbeeldingen ?? [])[0] ?? null,
      kleur: r.kleur?.trim() || null,
      kleuren: kleurenVan.get(r.product_id) ?? [],
      toegestaan: r.toegestaan !== false,
      verstrekking_type: normaliseerType(r.verstrekking_type),
      gratis_per_periode: r.gratis_per_periode,
      periode: normaliseerPeriode(r.periode),
      artikel_actief: artikel.actief !== false,
      bereik:
        (r.afdeling_id ? bereikVan.get(`afdeling:${r.afdeling_id}`) : null) ??
        (r.medewerker_id ? bereikVan.get(`medewerker:${r.medewerker_id}`) : null) ??
        null,
    });
  }

  return rijen.sort(
    (a, b) =>
      (a.merk ?? '').localeCompare(b.merk ?? '', 'nl') ||
      a.naam.localeCompare(b.naam, 'nl') ||
      (a.kleur ?? '').localeCompare(b.kleur ?? '', 'nl'),
  );
}

/** Wat er nodig is om een artikel aan het assortiment van een klant toe te voegen. */
export type NieuweAssortimentRegel = VerstrekkingVelden & {
  productId: string;
  kleur: string | null;
};

export type ToevoegResultaat = 'toegevoegd' | 'toegevoegd_zonder_kleur' | 'bestaat_al' | 'mislukt';

/**
 * Zin die Jessi te zien krijgt zolang de kolom `assortiment.kleur` nog niet
 * bestaat. Zonder deze melding zou ze de kleur invullen, daarna 'Alle kleuren'
 * in de lijst zien staan en denken dat het systeem haar keuze kwijtraakt.
 */
export const KLEUR_NOG_NIET_BESCHIKBAAR =
  'De kleur is nog niet bewaard: de database heeft daar nog geen veld voor. De rest is wel opgeslagen. Laat dat veld toevoegen, dan blijft de kleur voortaan staan.';

/**
 * Artikel toevoegen aan het assortiment van een klant, inclusief kleur en
 * verstrekking in dezelfde handeling.
 *
 * Dezelfde jas in twee kleuren mag; dezelfde jas twee keer in dezelfde kleur is
 * altijd een vergissing en levert alleen dubbele regels op in het portaal.
 */
export async function voegAssortimentRegelToe(
  orgId: string,
  invoer: NieuweAssortimentRegel,
): Promise<ToevoegResultaat> {
  const sb = kmsAdmin();
  if (!sb || !orgId || !invoer.productId) return 'mislukt';

  const kleur = invoer.kleur?.trim() || null;
  const bestaande = await haalRegels(sb, orgId);
  const dubbel = bestaande.some(
    (r) =>
      r.product_id === invoer.productId &&
      (r.kleur?.trim() || null) === kleur &&
      !r.afdeling_id &&
      !r.medewerker_id,
  );
  if (dubbel) return 'bestaat_al';

  const rij: {
    organisatie_id: string;
    product_id: string;
    toegestaan: boolean;
    verstrekking_type: VerstrekkingType;
    gratis_per_periode: number | null;
    periode: Periode;
    kleur?: string;
  } = {
    organisatie_id: orgId,
    product_id: invoer.productId,
    toegestaan: true,
    ...schoneVerstrekking(invoer),
  };
  // Kleur alleen meesturen als er een kleur gekozen is. Zo werkt toevoegen ook
  // op een database waar de kleur-migratie nog niet gedraaid heeft.
  if (kleur) rij.kleur = kleur;

  const { error } = await sb.from('assortiment').insert(rij);
  if (!error) return 'toegevoegd';
  if (!kleur) return 'mislukt';

  const zonderKleur = { ...rij };
  delete zonderKleur.kleur;
  const tweedePoging = await sb.from('assortiment').insert(zonderKleur);
  return tweedePoging.error ? 'mislukt' : 'toegevoegd_zonder_kleur';
}

/**
 * Uitkomst van het bijwerken van een assortimentregel.
 * `dubbel` betekent: dit artikel staat in die kleur al voor dezelfde groep.
 */
export type BijwerkResultaat = 'opgeslagen' | 'opgeslagen_zonder_kleur' | 'dubbel' | 'mislukt';

/**
 * Verstrekking (en eventueel de kleur) van een bestaande assortimentregel bijwerken.
 * `kleur` weglaten laat de bestaande kleur staan; expliciet null wist hem.
 *
 * Wordt de kleur meegegeven, dan kijken we eerst of dezelfde jas in die kleur al
 * voor dezelfde groep klaarstaat. Twee identieke regels leveren in het portaal
 * twee keer hetzelfde artikel op en dat is altijd een vergissing.
 */
export async function werkAssortimentRegelBij(
  regelId: string,
  velden: VerstrekkingVelden & { kleur?: string | null },
): Promise<BijwerkResultaat> {
  const sb = kmsAdmin();
  if (!sb || !regelId) return 'mislukt';

  // undefined = de kleur blijft ongemoeid; null = de kleur wordt gewist.
  const nieuweKleur: string | null | undefined =
    velden.kleur === undefined ? undefined : velden.kleur?.trim() || null;

  const patch: VerstrekkingVelden & { kleur?: string | null } = schoneVerstrekking(velden);
  if (nieuweKleur !== undefined) patch.kleur = nieuweKleur;

  if (nieuweKleur !== undefined) {
    const { data: huidig } = await sb
      .from('assortiment')
      .select('organisatie_id, product_id, afdeling_id, medewerker_id')
      .eq('id', regelId)
      .maybeSingle();
    const rij = huidig as {
      organisatie_id: string | null;
      product_id: string | null;
      afdeling_id: string | null;
      medewerker_id: string | null;
    } | null;
    if (rij && rij.organisatie_id && rij.product_id) {
      const productId = rij.product_id;
      const afdelingId = rij.afdeling_id;
      const medewerkerId = rij.medewerker_id;
      const bestaande = await haalRegels(sb, rij.organisatie_id);
      const dubbel = bestaande.some(
        (r) =>
          r.id !== regelId &&
          r.product_id === productId &&
          (r.kleur?.trim() || null) === nieuweKleur &&
          r.afdeling_id === afdelingId &&
          r.medewerker_id === medewerkerId,
      );
      if (dubbel) return 'dubbel';
    }
  }

  const { error } = await sb.from('assortiment').update(patch).eq('id', regelId);
  if (!error) return 'opgeslagen';
  if (nieuweKleur === undefined) return 'mislukt';

  // Zelfde terugval als bij toevoegen: zonder de kleur-migratie slaan we in elk
  // geval de verstrekking op, in plaats van de hele wijziging te laten vallen.
  const zonderKleur = { ...patch };
  delete zonderKleur.kleur;
  const tweedePoging = await sb.from('assortiment').update(zonderKleur).eq('id', regelId);
  return tweedePoging.error ? 'mislukt' : 'opgeslagen_zonder_kleur';
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
