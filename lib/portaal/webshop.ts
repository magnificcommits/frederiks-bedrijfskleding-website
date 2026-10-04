import { getServerSupabase } from './supabaseServer';
import { metIdTerugval } from '@/lib/kms/kolomTerugval';
import { getVertaler } from '@/lib/i18n/portaal/server';
import { maakVertaler, type Vertaler } from '@/lib/i18n/portaal/kern';
import { nl } from '@/lib/i18n/portaal/nl';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { genereerInkoopregels, volgOrderNaInkoop } from '@/lib/kms/inkoop';
import { DUBBEL_VENSTER_SECONDEN, isDubbeleBestelling, type RegelKern } from '@/lib/portaal/dubbelBestelling';

export type WebshopVariant = {
  id: string;
  product_id: string;
  maat: string | null;
  kleur: string | null;
  verkoopprijs: number | null;
  meerprijs: number | null;
  voorraad: number | null;
  actief: boolean;
};

export type WebshopProduct = {
  id: string;
  naam: string;
  omschrijving: string | null;
  merk: string | null;
  categorie: string | null;
  btw: number | null;
  afbeeldingen: string[] | null;
  varianten: WebshopVariant[];
};

export type WebshopMedewerker = {
  id: string;
  naam: string | null;
  voornaam: string | null;
  achternaam: string | null;
  email: string | null;
  functie: string | null;
  budget: number | null;
  budget_type: 'euro' | 'punten';
  startbudget: number | null;
  productbudget: number | null;
  buiten_budget_toegestaan: boolean;
  vestiging_id: string | null;
  /** Afdeling van de werknemer; bepaalt mee welke artikelen hij in de webshop ziet. */
  afdeling_id?: string | null;
  actief: boolean;
};

export type WebshopOrg = {
  id: string;
  naam: string;
  budget_actief: boolean;
  goedkeuren_bestellingen: boolean;
  min_bestelbedrag: number | null;
  max_bestelbedrag: number | null;
  toon_voorraad: boolean;
  gebruik_referentienr: boolean;
  opmerking_bij_bestelling: boolean;
  verzendkosten: number | null;
  /** Kortingspercentage van de organisatie op de lijstprijs (bijv. 10 = 10% korting). Leeg of 0 is geen korting. */
  korting_pct: number | null;
};

/** Lijstprijs (catalogusprijs) van een variant: verkoopprijs plus meerprijs. */
export function lijstprijs(verkoopprijs: number | null, meerprijs: number | null): number {
  return (Number(verkoopprijs) || 0) + (Number(meerprijs) || 0);
}

/**
 * Nettoprijs na klantkorting, afgerond op centen.
 * korting_pct leeg of 0 (of buiten 0..100) geeft gewoon de lijstprijs terug (huidig gedrag).
 */
export function nettoPrijs(lijst: number, kortingPct: number | null | undefined): number {
  const pct = Number(kortingPct) || 0;
  if (pct <= 0) return lijst;
  const factor = 1 - Math.min(100, pct) / 100;
  return Math.round(lijst * factor * 100) / 100;
}

/** Voorkeursmaat per product voor een medewerker. */
export type Voorkeursmaat = {
  product_id: string;
  voorkeursmaat: string | null;
  plus_minus_toegestaan: boolean;
};

export type PakketProductRegel = {
  product_id: string;
  variant_id: string | null;
  aantal: number;
  product_naam: string;
  variant_maat: string | null;
  variant_kleur: string | null;
};

export type WebshopPakket = {
  id: string;
  naam: string;
  soort: 'start' | 'regulier';
  pakketprijs: number | null;
  buiten_budget: boolean;
  actief: boolean;
  producten: PakketProductRegel[];
};

export type WebshopOrder = {
  id: string;
  status: string | null;
  goedkeuring_status: string | null;
  bedrag: number | null;
  notitie: string | null;
  created_at: string;
  medewerker_id: string | null;
  aangevraagd_door: string | null;
};

export type BestelRegelInput = {
  product_id: string;
  variant_id: string;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
  stukprijs: number;
};

/** Verstrekkingstype per artikel. Bepaalt of een artikel van het budget afgaat of (deels) gratis is. */
export type VerstrekkingType = 'budget' | 'periodiek_gratis' | 'altijd_gratis' | 'punten';
export type VerstrekkingPeriode = 'maand' | 'kwartaal' | 'jaar';

/** De verstrekkingsinstelling van één product binnen het assortiment van de eigen organisatie. */
export type Verstrekking = {
  product_id: string;
  verstrekking_type: VerstrekkingType;
  gratis_per_periode: number | null;
  periode: VerstrekkingPeriode;
};

/** De organisatie van de ingelogde gebruiker, met budget- en goedkeurinstellingen. RLS borgt de juiste org. */
export async function getMijnWebshopOrganisatie(): Promise<WebshopOrg | null> {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from('organisaties')
    .select(
      'id, naam, budget_actief, goedkeuren_bestellingen, min_bestelbedrag, max_bestelbedrag, toon_voorraad, gebruik_referentienr, opmerking_bij_bestelling, verzendkosten, korting_pct',
    )
    .limit(1)
    .maybeSingle();
  return (data as WebshopOrg) ?? null;
}

/** Eén assortimentregel zoals het portaal hem leest (RLS: alleen de eigen organisatie). */
type PortaalRegel = {
  product_id: string;
  afdeling_id: string | null;
  medewerker_id: string | null;
  kleur: string | null;
  toegestaan: boolean | null;
  verstrekking_type: string | null;
  gratis_per_periode: number | null;
  periode: string | null;
};

/** De assortimentregels van de eigen organisatie. Valt terug zonder kleur als die kolom (nog) ontbreekt. */
async function getPortaalRegels(): Promise<PortaalRegel[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const basis = 'product_id, afdeling_id, medewerker_id, toegestaan, verstrekking_type, gratis_per_periode, periode';
  const metKleur = await sb.from('assortiment').select(`${basis}, kleur`);
  if (!metKleur.error) return (metKleur.data as PortaalRegel[]) ?? [];
  const zonder = await sb.from('assortiment').select(basis);
  return ((zonder.data as Omit<PortaalRegel, 'kleur'>[]) ?? []).map((r) => ({ ...r, kleur: null }));
}

/**
 * Geldt deze regel voor deze werknemer? Zonder afdeling en zonder werknemer geldt
 * hij voor de hele klant; anders moet de afdeling of de werknemer zelf kloppen.
 */
function regelGeldt(regel: PortaalRegel, mw: { id: string; afdeling_id?: string | null }): boolean {
  if (regel.medewerker_id) return regel.medewerker_id === mw.id;
  if (regel.afdeling_id) return regel.afdeling_id === (mw.afdeling_id ?? null);
  return true;
}

/** Hoe specifiek een regel is: voor één werknemer > voor zijn afdeling > hele klant. */
function specificiteit(regel: PortaalRegel): number {
  return regel.medewerker_id ? 2 : regel.afdeling_id ? 1 : 0;
}

const zelfdeKleur = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/**
 * Alle producten in het assortiment van de eigen organisatie, met hun actieve varianten. RLS filtert op assortiment.
 *
 * Is de ingelogde gebruiker zelf een werknemer, dan ziet hij alleen wat voor de hele
 * klant, voor zijn eigen afdeling of voor hem persoonlijk in het assortiment staat
 * (bijv. laskleding alleen voor de afdeling Lassers). Ligt er per regel een kleur
 * vast, dan alleen de varianten in die kleur(en).
 *
 * `medewerker`: weglaten = de eigen werknemer opzoeken (en zonder match: als null);
 * een werknemer = filteren op wat voor hem geldt (beheerder die voor iemand bestelt);
 * null = geen werknemer bekend: alles wat in het assortiment staat, maar wel alleen
 * in de vastgelegde kleur(en) (samengenomen over alle regels van dat product).
 * Heeft de organisatie geen assortimentregels die het portaal kan lezen, dan blijft
 * het oude gedrag staan (alles, alle kleuren).
 */
export async function getAssortiment(
  medewerker?: { id: string; afdeling_id?: string | null } | null,
): Promise<WebshopProduct[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const [{ data: producten }, regels, eigen] = await Promise.all([
    sb.from('producten').select('id, naam, omschrijving, merk, categorie, btw, afbeeldingen').order('naam'),
    getPortaalRegels(),
    medewerker === undefined ? getMijnMedewerker() : Promise.resolve(medewerker),
  ]);
  let lijst = (producten as Omit<WebshopProduct, 'varianten'>[]) ?? [];
  if (lijst.length === 0) return [];

  // Per product de toegestane kleuren; null = alle kleuren. Zonder werknemer tellen
  // alle regels mee, zodat een vaste kleur ook voor een beheerder geldt.
  let kleurenPerProduct: Map<string, string[] | null> | null = null;
  if (regels.length > 0) {
    const geldend = regels.filter((r) => r.toegestaan !== false && (eigen ? regelGeldt(r, eigen) : true));
    kleurenPerProduct = new Map();
    for (const r of geldend) {
      const huidig = kleurenPerProduct.get(r.product_id);
      const kleur = r.kleur?.trim() || null;
      if (huidig === null) continue; // al 'alle kleuren'
      if (!kleur) kleurenPerProduct.set(r.product_id, null);
      else if (!huidig?.some((k) => zelfdeKleur(k, kleur))) kleurenPerProduct.set(r.product_id, [...(huidig ?? []), kleur]);
    }
    const toegestaan = kleurenPerProduct;
    lijst = lijst.filter((p) => toegestaan.has(p.id));
    if (lijst.length === 0) return [];
  }

  const ids = lijst.map((p) => p.id);
  const { data: varianten } = await sb
    .from('product_varianten')
    .select('id, product_id, maat, kleur, verkoopprijs, meerprijs, voorraad, actief')
    .in('product_id', ids)
    .eq('actief', true);
  const vlist = (varianten as WebshopVariant[]) ?? [];

  return lijst.map((p) => {
    const alle = vlist.filter((v) => v.product_id === p.id);
    const kleuren = kleurenPerProduct?.get(p.id) ?? null;
    if (!kleuren) return { ...p, varianten: alle };
    const inKleur = alle.filter((v) => kleuren.some((k) => zelfdeKleur(k, v.kleur)));
    // Klopt de vastgelegde kleur met geen enkele variant, dan liever alles tonen dan niets.
    return { ...p, varianten: inKleur.length > 0 ? inKleur : alle };
  });
}

/** Zoekt de medewerker waarvan het e-mailadres gelijk is aan dat van de ingelogde gebruiker. Kan null zijn. */
export async function getMijnMedewerker(): Promise<WebshopMedewerker | null> {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const { data: auth } = await sb.auth.getUser();
  const email = auth.user?.email;
  if (!email) return null;
  const { data } = await sb
    .from('medewerkers')
    .select(
      'id, naam, voornaam, achternaam, email, functie, budget, budget_type, startbudget, productbudget, buiten_budget_toegestaan, vestiging_id, afdeling_id, actief',
    )
    .ilike('email', email)
    .limit(1)
    .maybeSingle();
  return (data as WebshopMedewerker) ?? null;
}

/** Alle actieve medewerkers van de eigen organisatie. Voor de keuze als de gebruiker geen eigen match heeft. */
export async function getWebshopMedewerkers(): Promise<WebshopMedewerker[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('medewerkers')
    .select(
      'id, naam, voornaam, achternaam, email, functie, budget, budget_type, startbudget, productbudget, buiten_budget_toegestaan, vestiging_id, afdeling_id, actief',
    )
    .eq('actief', true)
    .order('naam');
  return (data as WebshopMedewerker[]) ?? [];
}

/**
 * Totaal verbruikt budget (in euro) van een medewerker: som van aantal × stukprijs
 * over alle orderregels van diens orders. RLS borgt dat alleen de eigen organisatie meekomt.
 * Afgewezen en geannuleerde bestellingen tellen niet mee: die zijn nooit geleverd,
 * dus het budget moet weer vrijkomen.
 */
export async function getBudgetVerbruik(medewerkerId: string): Promise<number> {
  const sb = await getServerSupabase();
  if (!sb) return 0;
  // In JavaScript filteren, niet met .neq(): die laat ook rijen met een lege status vallen.
  const { data: orders } = await sb
    .from('orders')
    .select('id, status, goedkeuring_status, bedrag, notitie')
    .eq('medewerker_id', medewerkerId);
  type Rij = { id: string; status: string | null; goedkeuring_status: string | null; bedrag: number | null; notitie: string | null };
  const tellend = ((orders as Rij[]) ?? []).filter((o) => o.status !== 'geannuleerd' && o.goedkeuring_status !== 'afgewezen');
  if (tellend.length === 0) return 0;
  const { data: regels } = await sb.from('orderregels').select('order_id, aantal, stukprijs').in('order_id', tellend.map((o) => o.id));
  const perOrder = new Map<string, number>();
  for (const r of (regels as { order_id: string; aantal: number | null; stukprijs: number | null }[]) ?? []) {
    perOrder.set(r.order_id, (perOrder.get(r.order_id) ?? 0) + (Number(r.aantal) || 0) * (Number(r.stukprijs) || 0));
  }
  return tellend.reduce((sum, o) => {
    const regelTotaal = perOrder.get(o.id) ?? 0;
    // Pakketbestelling: de artikelen staan op nul en de pakketprijs op de order (zie bestelPakket).
    // Die telt mee, behalve een pakket dat buiten het budget valt.
    if (regelTotaal === 0 && (Number(o.bedrag) || 0) > 0 && (o.notitie ?? '').startsWith('Pakket:')) {
      return (o.notitie ?? '').includes(PAKKET_BUITEN_BUDGET) ? sum : sum + (Number(o.bedrag) || 0);
    }
    return sum + regelTotaal;
  }, 0);
}

/** Staat in de notitie van een pakketbestelling die niet van het budget afgaat. */
const PAKKET_BUITEN_BUDGET = '(buiten budget)';

/** Eén afbeelding per kleur, per product, voor de eigen organisatie (RLS op assortiment). */
export async function getKleurAfbeeldingen(): Promise<Record<string, Record<string, string>>> {
  const sb = await getServerSupabase();
  if (!sb) return {};
  const { data } = await sb.from('product_kleur_afbeeldingen').select('product_id, kleur, afbeelding_url');
  const map: Record<string, Record<string, string>> = {};
  ((data as { product_id: string; kleur: string; afbeelding_url: string | null }[]) ?? []).forEach((r) => {
    if (!r.afbeelding_url) return;
    if (!map[r.product_id]) map[r.product_id] = {};
    map[r.product_id][r.kleur] = r.afbeelding_url;
  });
  return map;
}

/**
 * Verstrekkingstype per product voor de eigen organisatie, waarbij alleen de
 * eigen assortimentregels meekomen. Ontbreekt een product, dan valt het op 'budget' terug.
 *
 * Staat een product meerdere keren in het assortiment (hele klant, afdeling,
 * werknemer), dan wint de meest specifieke regel die voor de werknemer geldt.
 * `medewerker`: weglaten = de eigen werknemer opzoeken; null = geen voorkeur.
 */
export async function getVerstrekkingen(
  medewerker?: { id: string; afdeling_id?: string | null } | null,
): Promise<Record<string, Verstrekking>> {
  const sb = await getServerSupabase();
  if (!sb) return {};
  const [alleRegels, eigen] = await Promise.all([
    getPortaalRegels(),
    medewerker === undefined ? getMijnMedewerker() : Promise.resolve(medewerker),
  ]);
  const data = (eigen ? alleRegels.filter((r) => regelGeldt(r, eigen)) : alleRegels)
    .slice()
    .sort((a, b) => (eigen ? specificiteit(b) - specificiteit(a) : specificiteit(a) - specificiteit(b)));
  const geldigeTypes: VerstrekkingType[] = ['budget', 'periodiek_gratis', 'altijd_gratis', 'punten'];
  const geldigePeriodes: VerstrekkingPeriode[] = ['maand', 'kwartaal', 'jaar'];
  const map: Record<string, Verstrekking> = {};
  ((data as {
    product_id: string;
    verstrekking_type: string | null;
    gratis_per_periode: number | null;
    periode: string | null;
  }[]) ?? []).forEach((r) => {
    const type = geldigeTypes.includes(r.verstrekking_type as VerstrekkingType)
      ? (r.verstrekking_type as VerstrekkingType)
      : 'budget';
    const periode = geldigePeriodes.includes(r.periode as VerstrekkingPeriode)
      ? (r.periode as VerstrekkingPeriode)
      : 'jaar';
    // Eerste regel per product wint; assortiment kan in theorie meerdere regels per product hebben (afdeling/medewerker).
    if (!map[r.product_id]) {
      map[r.product_id] = {
        product_id: r.product_id,
        verstrekking_type: type,
        gratis_per_periode: r.gratis_per_periode,
        periode,
      };
    }
  });
  return map;
}

/** Begin van de huidige periode (maand, kwartaal of jaar) als ISO-datum, op basis van vandaag. */
export function periodeStart(periode: VerstrekkingPeriode, nu: Date = new Date()): Date {
  const jaar = nu.getFullYear();
  if (periode === 'maand') return new Date(jaar, nu.getMonth(), 1);
  if (periode === 'kwartaal') {
    const kwartaalMaand = Math.floor(nu.getMonth() / 3) * 3;
    return new Date(jaar, kwartaalMaand, 1);
  }
  return new Date(jaar, 0, 1);
}

/**
 * Telt hoeveel stuks van een product de medewerker al heeft besteld in de huidige periode.
 * Telt over orderregels van orders van deze medewerker met een besteldatum vanaf het begin van de periode.
 * RLS borgt dat alleen de eigen organisatie meekomt. Bij geen medewerker of geen treffers: 0.
 */
export async function getVerstrektInPeriode(
  medewerkerId: string,
  productId: string,
  periode: VerstrekkingPeriode,
): Promise<number> {
  const sb = await getServerSupabase();
  if (!sb) return 0;
  const vanaf = periodeStart(periode).toISOString();
  const { data: orders } = await sb
    .from('orders')
    .select('id')
    .eq('medewerker_id', medewerkerId)
    .gte('besteldatum', vanaf);
  const orderIds = ((orders as { id: string }[]) ?? []).map((o) => o.id);
  if (orderIds.length === 0) return 0;
  const { data: regels } = await sb
    .from('orderregels')
    .select('aantal')
    .eq('product_id', productId)
    .in('order_id', orderIds);
  return ((regels as { aantal: number | null }[]) ?? []).reduce((sum, r) => sum + (Number(r.aantal) || 0), 0);
}

/** Voorkeursmaten van een medewerker als map product_id -> { voorkeursmaat, plus_minus_toegestaan }. RLS borgt de scope. */
export async function getVoorkeursmaten(
  medewerkerId: string,
): Promise<Record<string, { voorkeursmaat: string | null; plus_minus_toegestaan: boolean }>> {
  const sb = await getServerSupabase();
  if (!sb) return {};
  const { data } = await sb
    .from('medewerker_maten')
    .select('product_id, voorkeursmaat, plus_minus_toegestaan')
    .eq('medewerker_id', medewerkerId);
  const map: Record<string, { voorkeursmaat: string | null; plus_minus_toegestaan: boolean }> = {};
  ((data as Voorkeursmaat[]) ?? []).forEach((r) => {
    map[r.product_id] = {
      voorkeursmaat: r.voorkeursmaat,
      plus_minus_toegestaan: Boolean(r.plus_minus_toegestaan),
    };
  });
  return map;
}

/** Actieve pakketten van de eigen organisatie met hun producten. RLS filtert op de eigen org. */
export async function getPakketten(): Promise<WebshopPakket[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data: pakketten } = await sb
    .from('pakketten')
    .select('id, naam, soort, pakketprijs, buiten_budget, actief')
    .eq('actief', true)
    .order('soort')
    .order('naam');
  const lijst = (pakketten as Omit<WebshopPakket, 'producten'>[]) ?? [];
  if (lijst.length === 0) return [];

  const ids = lijst.map((p) => p.id);
  const { data: producten } = await sb
    .from('pakket_producten')
    .select('pakket_id, product_id, variant_id, aantal, product:producten(naam), variant:product_varianten(maat, kleur)')
    .in('pakket_id', ids);
  const rows =
    (producten as unknown as {
      pakket_id: string;
      product_id: string;
      variant_id: string | null;
      aantal: number;
      product: { naam: string } | null;
      variant: { maat: string | null; kleur: string | null } | null;
    }[]) ?? [];

  return lijst.map((p) => ({
    ...p,
    producten: rows
      .filter((r) => r.pakket_id === p.id)
      .map((r) => ({
        product_id: r.product_id,
        variant_id: r.variant_id,
        aantal: Number(r.aantal) || 1,
        product_naam: r.product?.naam ?? 'Onbekend product',
        variant_maat: r.variant?.maat ?? null,
        variant_kleur: r.variant?.kleur ?? null,
      })),
  }));
}

/** Bestelhistorie van de eigen organisatie, recent eerst. RLS borgt de juiste org. */
export async function getWebshopOrders(): Promise<WebshopOrder[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('orders')
    .select('id, status, goedkeuring_status, bedrag, notitie, created_at, medewerker_id, aangevraagd_door')
    .order('created_at', { ascending: false })
    .limit(50);
  return (data as WebshopOrder[]) ?? [];
}

/** Extra gegevens en instellingen die de bestelling sturen. Alles optioneel: ontbreekt iets, dan valt de check weg. */
export type BestelOpties = {
  /** De medewerker waarvoor besteld wordt, met budgetvelden. Nodig voor budget- en productbudgetcheck. */
  medewerker?: WebshopMedewerker | null;
  /** Al verbruikt budget (som van eerdere orders). */
  verbruikt?: number;
  /** Referentienummer, alleen meegestuurd als de org dit gebruikt. */
  referentienr?: string | null;
  /** Verstrekking per product (map product_id -> instelling). Bepaalt welk deel van het budget afgaat. */
  verstrekkingen?: Record<string, Verstrekking>;
  /** Reeds in de huidige periode verstrekte aantallen per product (map product_id -> aantal). */
  reedsVerstrekt?: Record<string, number>;
};

/** Resultaat van de verstrekkingsverdeling: welk deel telt mee voor het budget, en welk deel is gratis. */
export type VerstrekkingVerdeling = {
  /** Het totaalbedrag dat van het budget afgaat (na aftrek van gratis verstrekte stuks). */
  budgetTotaal: number;
  /** Het totale (echte) bedrag van alle regels, los van verstrekking. */
  echtTotaal: number;
  /** Per variant het aantal stuks dat gratis is (altijd gratis of binnen de periodieke vrije ruimte). */
  gratisPerVariant: Record<string, number>;
};

/**
 * Verdeelt de regels in een budget-relevant deel en een gratis deel op basis van de verstrekking per product.
 * - 'altijd_gratis': het hele artikel gaat niet van het budget af.
 * - 'periodiek_gratis': gratis tot gratis_per_periode per periode; het meerdere gaat wel van het budget af.
 *   Reeds bestelde stuks in de periode komen via `reedsVerstrekt` (map product_id -> aantal) binnen.
 * - 'budget' en 'punten' gedragen zich zoals altijd: het hele bedrag telt mee.
 * Ontbreekt een instelling voor een product, dan valt het terug op 'budget'.
 */
export function verdeelVerstrekking(
  regels: BestelRegelInput[],
  verstrekkingen: Record<string, Verstrekking>,
  reedsVerstrekt: Record<string, number> = {},
): VerstrekkingVerdeling {
  const gratisPerVariant: Record<string, number> = {};
  // Houd per product bij hoeveel vrije ruimte er nog over is binnen deze bestelling.
  const restVrij: Record<string, number> = {};
  let budgetTotaal = 0;
  let echtTotaal = 0;

  for (const r of regels) {
    const regelBedrag = r.aantal * r.stukprijs;
    echtTotaal += regelBedrag;

    const v = verstrekkingen[r.product_id];
    const type: VerstrekkingType = v?.verstrekking_type ?? 'budget';

    if (type === 'altijd_gratis') {
      gratisPerVariant[r.variant_id] = (gratisPerVariant[r.variant_id] ?? 0) + r.aantal;
      continue; // Telt niet mee voor het budget.
    }

    if (type === 'periodiek_gratis') {
      const limiet = v?.gratis_per_periode != null && v.gratis_per_periode >= 0 ? v.gratis_per_periode : 0;
      if (!(r.product_id in restVrij)) {
        const alGehad = Math.max(0, Number(reedsVerstrekt[r.product_id]) || 0);
        restVrij[r.product_id] = Math.max(0, limiet - alGehad);
      }
      const gratisAantal = Math.min(r.aantal, restVrij[r.product_id]);
      restVrij[r.product_id] -= gratisAantal;
      if (gratisAantal > 0) {
        gratisPerVariant[r.variant_id] = (gratisPerVariant[r.variant_id] ?? 0) + gratisAantal;
      }
      const betaaldAantal = r.aantal - gratisAantal;
      budgetTotaal += betaaldAantal * r.stukprijs;
      continue;
    }

    // 'budget' en 'punten': volledig meetellen (huidig gedrag).
    budgetTotaal += regelBedrag;
  }

  return { budgetTotaal, echtTotaal, gratisPerVariant };
}

/** Resultaat van een handhavingscheck. ok=false betekent geblokkeerd, met een nette reden. */
type HandhaafResultaat = { ok: true } | { ok: false; reden: string };

/**
 * Controleert min/max bestelbedrag, budget en productbudget voor een wagentotaal.
 * Geeft een duidelijke reden terug in de taal van de gebruiker (vertaler `v`, standaard
 * Nederlands) als iets de bestelling blokkeert.
 * Ontbrekende instellingen worden overgeslagen, zodat het huidige gedrag behouden blijft.
 */
export function handhaafBestelling(
  org: WebshopOrg,
  totaal: number,
  aantalStuks: number,
  opts: BestelOpties & { slaMinMaxOver?: boolean; budgetTotaal?: number } = {},
  v: Vertaler = maakVertaler('nl', nl),
): HandhaafResultaat {
  // Min/max bestelbedrag van de organisatie. Kan overgeslagen worden als de aanroeper dit los doet.
  if (!opts.slaMinMaxOver) {
    if (org.min_bestelbedrag != null && totaal < Number(org.min_bestelbedrag)) {
      return {
        ok: false,
        reden: v.t('webshop.minBedrag', { bedrag: v.euro(Number(org.min_bestelbedrag)) }),
      };
    }
    if (org.max_bestelbedrag != null && totaal > Number(org.max_bestelbedrag)) {
      return {
        ok: false,
        reden: v.t('webshop.maxBedrag', { bedrag: v.euro(Number(org.max_bestelbedrag)) }),
      };
    }
  }

  // De budgetcheck draait op het budget-relevante deel (na verstrekking), als dat is meegegeven.
  const budgetBedrag = opts.budgetTotaal ?? totaal;
  const mw = opts.medewerker;
  if (org.budget_actief && mw) {
    // Budget: blokkeer alleen als buiten budget niet is toegestaan en het totaal het resterende overschrijdt.
    if (mw.budget != null && !mw.buiten_budget_toegestaan) {
      const resterend = Number(mw.budget) - (opts.verbruikt ?? 0);
      if (budgetBedrag > resterend) {
        const label =
          mw.budget_type === 'punten'
            ? v.tn('algemeen.punten', Math.round(resterend))
            : v.euro(resterend);
        return {
          ok: false,
          reden: v.t('webshop.budgetBlokkeert', { budget: label }),
        };
      }
    }
    // Productbudget: maximaal aantal stuks per bestelling, als ingesteld.
    if (mw.productbudget != null && aantalStuks > Number(mw.productbudget)) {
      return {
        ok: false,
        reden: v.t('webshop.productbudgetBlokkeert', { max: Number(mw.productbudget), n: aantalStuks }),
      };
    }
  }

  return { ok: true };
}

/**
 * Maakt een order plus orderregels aan. Goedkeuring en status volgen de instelling van de organisatie.
 * Voert eerst de handhaving uit (min/max bedrag, budget, productbudget) en blokkeert met een nette reden.
 * Zet vestiging_id op de vestiging van de medewerker en neemt referentienr en opmerking mee.
 */
export async function maakWebshopBestelling(
  org: WebshopOrg,
  aangevraagdDoor: string,
  medewerkerId: string | null,
  regels: BestelRegelInput[],
  notitie: string,
  opts: BestelOpties = {},
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  const v = await getVertaler();
  if (!sb) return { ok: false, error: v.t('algemeen.nietGeconfigureerd') };
  if (regels.length === 0) return { ok: false, error: v.t('webshop.wasLeeg') };

  const bedrag = Math.round(regels.reduce((sum, r) => sum + r.aantal * r.stukprijs, 0) * 100) / 100;
  const aantalStuks = regels.reduce((sum, r) => sum + r.aantal, 0);

  // Verstrekking: bepaal welk deel van het bedrag werkelijk van het budget afgaat.
  // Altijd-gratis artikelen tellen niet mee; periodiek-gratis tot het ingestelde aantal per periode.
  // Ontbreekt een instelling, dan valt het terug op 'budget' (volledig meetellen).
  const verdeling = verdeelVerstrekking(regels, opts.verstrekkingen ?? {}, opts.reedsVerstrekt ?? {});

  // Min/max op het echte bedrag, budgetcheck op het budget-relevante deel (na verstrekking).
  const check = handhaafBestelling(org, bedrag, aantalStuks, {
    ...opts,
    budgetTotaal: verdeling.budgetTotaal,
  }, v);
  if (!check.ok) return { ok: false, error: check.reden };

  // Dubbelklik, terugknop of twee tabbladen: dezelfde bestelling binnen een minuut weigeren.
  if (await isRecentDubbel(sb, org.id, aangevraagdDoor, medewerkerId, regels)) {
    return { ok: false, error: v.t('webshop.dubbel') };
  }

  const goedkeuringStatus = org.goedkeuren_bestellingen ? 'wacht' : 'niet_nodig';
  const status = org.goedkeuren_bestellingen ? 'concept' : 'nog_bestellen';
  const vestigingId = opts.medewerker?.vestiging_id ?? null;
  const referentienr = org.gebruik_referentienr ? opts.referentienr?.trim() || null : null;

  // bron 'portaal' (kolom uit migratie 20261006_orders_bron.sql); zonder die kolom nogmaals zonder.
  const { data, error } = await metIdTerugval(
    {
      organisatie_id: org.id,
      medewerker_id: medewerkerId,
      aangevraagd_door: aangevraagdDoor,
      status,
      goedkeuring_status: goedkeuringStatus,
      bedrag,
      notitie: notitie || null,
      vestiging_id: vestigingId,
      referentienr,
      bron: 'portaal',
    },
    ['bron'],
    (rij) => sb.from('orders').insert(rij).select('id').single(),
  );
  if (error || !data) return { ok: false, error: error?.message ?? v.t('webshop.plaatsenMislukt') };

  const orderId = (data as { id: string }).id;
  const rows = regels.map((r) => ({
    order_id: orderId,
    product_id: r.product_id,
    variant_id: r.variant_id,
    item_naam: r.item_naam,
    maat: r.maat,
    kleur: r.kleur,
    aantal: r.aantal,
    stukprijs: r.stukprijs,
  }));
  const { error: e2 } = await sb.from('orderregels').insert(rows);
  if (e2) {
    await ruimLegeOrderOp(orderId);
    return { ok: false, error: e2.message };
  }
  await naPlaatsen(orderId, status);
  return { ok: true };
}

/**
 * Heeft deze gebruiker in de laatste minuut al precies dezelfde bestelling geplaatst
 * (zelfde klant, zelfde besteller, zelfde medewerker, zelfde regels)? Alleen met
 * bestaande kolommen: orders.created_at, aangevraagd_door en de orderregels.
 * Via de service-rol als die er is, zodat RLS het zicht op de eigen order niet
 * beperkt. Lukt de controle niet, dan gaat de bestelling gewoon door.
 */
async function isRecentDubbel(
  sb: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>,
  organisatieId: string,
  aangevraagdDoor: string,
  medewerkerId: string | null,
  regels: BestelRegelInput[],
): Promise<boolean> {
  try {
    const db = kmsAdmin() ?? sb;
    const sinds = new Date(Date.now() - DUBBEL_VENSTER_SECONDEN * 1000).toISOString();
    let q = db
      .from('orders')
      .select('id')
      .eq('organisatie_id', organisatieId)
      .eq('aangevraagd_door', aangevraagdDoor)
      .neq('status', 'geannuleerd')
      .gte('created_at', sinds)
      .limit(20);
    q = medewerkerId ? q.eq('medewerker_id', medewerkerId) : q.is('medewerker_id', null);
    const { data: recent, error } = await q;
    const ids = ((recent as { id: string }[] | null) ?? []).map((o) => o.id);
    if (error || ids.length === 0) return false;
    const { data: rijen, error: e2 } = await db.from('orderregels').select('order_id, variant_id, product_id, item_naam, aantal').in('order_id', ids);
    if (e2) return false;
    const perOrder = new Map<string, RegelKern[]>();
    for (const r of (rijen as ({ order_id: string } & RegelKern)[] | null) ?? []) {
      const lijst = perOrder.get(r.order_id) ?? [];
      lijst.push(r);
      perOrder.set(r.order_id, lijst);
    }
    return isDubbeleBestelling(regels, [...perOrder.values()]);
  } catch {
    return false;
  }
}

/**
 * Zijn de regels niet opgeslagen, dan de lege order weer weghalen. Anders blijft
 * er een order van nul regels staan die wel budget en een ordernummer heeft.
 * Via de service-rol: de portaalgebruiker mag zelf geen orders verwijderen.
 */
async function ruimLegeOrderOp(orderId: string): Promise<void> {
  const admin = kmsAdmin();
  if (!admin) return;
  const { count } = await admin.from('orderregels').select('id', { count: 'exact', head: true }).eq('order_id', orderId);
  if ((count ?? 0) === 0) await admin.from('orders').delete().eq('id', orderId);
}

/**
 * Bestelling zonder goedkeuringsstap: meteen de inkoopregels klaarzetten voor
 * wat niet op voorraad is, net als na een goedkeuring. Best effort.
 */
async function naPlaatsen(orderId: string, status: string): Promise<void> {
  if (status !== 'nog_bestellen') return;
  await genereerInkoopregels(orderId).catch(() => 0);
  await volgOrderNaInkoop(orderId).catch(() => null);
}

/**
 * Bestelt een compleet pakket. Maakt een order met alle pakketproducten als regels en de pakketprijs als bedrag.
 * Een pakket met buiten_budget=true omzeilt de budget- en productbudgetcheck (denk aan het verplichte startpakket).
 * De min/max bestelbedrag-grens van de organisatie blijft wel gelden, tenzij het pakket buiten budget valt.
 */
export async function bestelPakket(
  pakketId: string,
  opts: {
    org: WebshopOrg;
    aangevraagdDoor: string;
    medewerkerId: string | null;
    medewerker?: WebshopMedewerker | null;
    verbruikt?: number;
    referentienr?: string | null;
    notitie?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  const v = await getVertaler();
  if (!sb) return { ok: false, error: v.t('algemeen.nietGeconfigureerd') };

  // Haal het pakket en zijn producten op (RLS borgt de eigen org).
  const pakketten = await getPakketten();
  const pakket = pakketten.find((p) => p.id === pakketId);
  if (!pakket) return { ok: false, error: v.t('webshop.pakketNietGevonden') };
  if (pakket.producten.length === 0) return { ok: false, error: v.t('webshop.pakketLeeg') };

  // Bouw de orderregels. Het ordertotaal is de pakketprijs (één vaste prijs voor het hele pakket),
  // dus de losse regels krijgen stukprijs 0; order.bedrag draagt de pakketprijs.
  const pakketprijs = pakket.pakketprijs != null ? Number(pakket.pakketprijs) : 0;
  const regels: BestelRegelInput[] = pakket.producten.map((pp) => ({
    product_id: pp.product_id,
    variant_id: pp.variant_id ?? '',
    item_naam: pp.product_naam,
    maat: pp.variant_maat,
    kleur: pp.variant_kleur,
    aantal: pp.aantal,
    stukprijs: 0,
  }));

  const { org, aangevraagdDoor, medewerkerId } = opts;
  const aantalStuks = regels.reduce((sum, r) => sum + r.aantal, 0);

  // buiten_budget-pakket: sla budget en productbudget over, maar houd min/max bestelbedrag aan.
  const handhaafOpts: BestelOpties = pakket.buiten_budget
    ? { referentienr: opts.referentienr }
    : { medewerker: opts.medewerker, verbruikt: opts.verbruikt, referentienr: opts.referentienr };
  const check = handhaafBestelling(org, pakketprijs, aantalStuks, handhaafOpts, v);
  if (!check.ok) return { ok: false, error: check.reden };

  const goedkeuringStatus = org.goedkeuren_bestellingen ? 'wacht' : 'niet_nodig';
  const status = org.goedkeuren_bestellingen ? 'concept' : 'nog_bestellen';
  const vestigingId = opts.medewerker?.vestiging_id ?? null;
  const referentienr = org.gebruik_referentienr ? opts.referentienr?.trim() || null : null;
  // Begint altijd met "Pakket:": daaraan herkennen de factuur en de budgetberekening de
  // pakketprijs. Een pakket buiten budget krijgt dat erbij, zodat het budget het overslaat.
  const extra = (opts.notitie ?? '').trim();
  const notitie = `Pakket: ${pakket.naam}${pakket.buiten_budget ? ` ${PAKKET_BUITEN_BUDGET}` : ''}${extra ? ` · ${extra}` : ''}`;

  // bron 'portaal' (kolom uit migratie 20261006_orders_bron.sql); zonder die kolom nogmaals zonder.
  const { data, error } = await metIdTerugval(
    {
      organisatie_id: org.id,
      medewerker_id: medewerkerId,
      aangevraagd_door: aangevraagdDoor,
      status,
      goedkeuring_status: goedkeuringStatus,
      bedrag: pakketprijs,
      notitie,
      vestiging_id: vestigingId,
      referentienr,
      bron: 'portaal',
    },
    ['bron'],
    (rij) => sb.from('orders').insert(rij).select('id').single(),
  );
  if (error || !data) return { ok: false, error: error?.message ?? v.t('webshop.plaatsenMislukt') };

  const orderId = (data as { id: string }).id;
  const rows = regels.map((r) => ({
    order_id: orderId,
    product_id: r.product_id,
    variant_id: r.variant_id || null,
    item_naam: r.item_naam,
    maat: r.maat,
    kleur: r.kleur,
    aantal: r.aantal,
    stukprijs: r.stukprijs,
  }));
  const { error: e2 } = await sb.from('orderregels').insert(rows);
  if (e2) {
    await ruimLegeOrderOp(orderId);
    return { ok: false, error: e2.message };
  }
  await naPlaatsen(orderId, status);
  return { ok: true };
}
