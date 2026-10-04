import { kmsAdmin } from '@/lib/kms/adminClient';
import { zoekWoorden, klantIdsVoorZoekterm } from '@/lib/kms/zoeken';
import { stuurStatusMail } from '@/lib/kms/notificaties';
import { metIdTerugval, orderIdsVoorAanvrager } from '@/lib/kms/personen';
import { orderIdsMetDrukproef } from '@/lib/kms/filterOpties';
import { eisData } from '@/lib/dbFout';
import { sorteerMaten } from '@/lib/kms/variantenStandaard';
import { genereerInkoopregels, annuleerInkoopVoorOrder, boekOrderVoorraadAf, volgOrderNaInkoop } from '@/lib/kms/inkoop';

/**
 * Data-access voor de module Orders.
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export const ORDER_STATUSSEN = [
  'concept',
  'offerte_verstuurd',
  'offerte_goedgekeurd',
  'nog_bestellen',
  'besteld',
  'deellevering',
  'compleet_geleverd',
  'bedrukken',
  'borduren',
  'verpakken',
  'bezorgen',
  'verzonden',
  'factureren',
  'afgerond',
  // Afgewezen in het portaal of door Jessi geannuleerd. Telt nergens meer mee
  // (geen voorraadreservering, geen spaarpunten, niet factureerbaar).
  'geannuleerd',
] as const;
export type OrderStatus = (typeof ORDER_STATUSSEN)[number];

export function isOrderStatus(s: string): s is OrderStatus {
  return (ORDER_STATUSSEN as readonly string[]).includes(s);
}

/** Leesbaar label voor een orderstatus (zelfde woorden als het portaal). */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  concept: 'Concept',
  offerte_verstuurd: 'Offerte verstuurd',
  offerte_goedgekeurd: 'Offerte goedgekeurd',
  nog_bestellen: 'Nog bestellen',
  besteld: 'Besteld bij leverancier',
  deellevering: 'Deels binnen',
  compleet_geleverd: 'Alles binnen',
  bedrukken: 'Bedrukken',
  borduren: 'Borduren',
  verpakken: 'Verpakken',
  bezorgen: 'Bezorgen',
  verzonden: 'Verzonden',
  factureren: 'Factureren',
  afgerond: 'Afgerond',
  geannuleerd: 'Geannuleerd',
};

/**
 * De logische volgende stap per status, voor de knop "Volgende stap" op de
 * orderpagina. Bedrukken en borduren gaan via de werkbon; die stap staat hier
 * toch, zodat een order zonder werkbon ook verder kan.
 */
export const VOLGENDE_ORDERSTATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  concept: 'nog_bestellen',
  offerte_verstuurd: 'offerte_goedgekeurd',
  offerte_goedgekeurd: 'nog_bestellen',
  nog_bestellen: 'besteld',
  besteld: 'compleet_geleverd',
  deellevering: 'compleet_geleverd',
  compleet_geleverd: 'verpakken',
  bedrukken: 'verpakken',
  borduren: 'verpakken',
  verpakken: 'verzonden',
  bezorgen: 'factureren',
  verzonden: 'factureren',
  factureren: 'afgerond',
};

/** Statussen waarin de goederen de deur uit zijn: dan wordt de voorraad afgeboekt. */
export const UITGELEVERDE_ORDERSTATUSSEN: readonly string[] = ['bezorgen', 'verzonden', 'factureren', 'afgerond'];

/** Statussen waarin aan de regels van een order niets meer mag veranderen. */
export const GESLOTEN_ORDERSTATUSSEN: readonly string[] = ['afgerond', 'geannuleerd'];

export const GOEDKEURING_STATUSSEN = ['niet_nodig', 'wacht', 'goedgekeurd', 'afgewezen'] as const;
export type GoedkeuringStatus = (typeof GOEDKEURING_STATUSSEN)[number];

export type Order = {
  id: string;
  ordernummer: number;
  organisatie_id: string;
  medewerker_id: string | null;
  afdeling_id: string | null;
  besteldatum: string | null;
  status: string;
  goedkeuring_status: string;
  goedgekeurd_door: string | null;
  bedrag: number | null;
  aangevraagd_door: string | null;
  notitie: string | null;
  interne_notitie: string | null;
  created_at: string;
  // Staan al in de tabel en komen mee met select('*'); hier getypeerd
  // zodat de orderlijst ze kan tonen.
  referentienr: string | null;
  track_trace_code: string | null;
  vervoerder: string | null;
  vestiging_id: string | null;
  // Koppeling naar de persoon achter de naam (migratie 20261004_persoon_verwijzingen).
  // Optioneel: vóór die migratie bestaan de kolommen nog niet.
  aangevraagd_door_contact_id?: string | null;
  aangevraagd_door_medewerker_id?: string | null;
  goedgekeurd_door_contact_id?: string | null;
  goedgekeurd_door_medewerker_id?: string | null;
};

/** De id-kolommen achter "aangevraagd door"; vallen weg als de migratie nog niet gedraaid is. */
export const AANVRAGER_ID_KOLOMMEN = ['aangevraagd_door_contact_id', 'aangevraagd_door_medewerker_id'];
const GOEDKEURDER_ID_KOLOMMEN = ['goedgekeurd_door_contact_id', 'goedgekeurd_door_medewerker_id'];

export type Orderregel = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  /**
   * Broeklengte in centimeters bij maatwerk. Wordt onder meer gevuld als een
   * passessie naar een order wordt omgezet; de coupeuse werkt hiermee.
   */
  lengte: number | null;
  aantal: number;
  stukprijs: number | null;
  created_at: string;
  /**
   * Artikelfoto bij de regel. Staat niet in de tabel maar wordt door getOrder
   * bijgezocht, zodat de orderpagina in één oogopslag laat zien wat er besteld is.
   */
  afbeelding?: string | null;
};

/**
 * Artikel zoals de regelkiezer het nodig heeft. Bewust klein: de hele lijst
 * gaat naar de browser zodat zoeken zonder serverronde werkt.
 */
export type OrderProduct = {
  id: string;
  naam: string;
  merk: string | null;
  categorie: string | null;
  afbeelding: string | null;
  /** Kan dit artikel op lengte gemaakt worden? Zo ja, vraagt de kiezer erom. */
  maatwerk_lengte: boolean;
};

/** Eén maat-kleurcombinatie van een artikel, met de prijs die de klant betaalt. */
export type OrderVariant = {
  id: string;
  maat: string | null;
  kleur: string | null;
  prijs: number | null;
  voorraad: number;
  afbeelding: string | null;
};

export type OrderMetKlant = Order & { organisatie_naam: string | null; medewerker_naam: string | null };
export type OrderDetail = OrderMetKlant & { regels: Orderregel[] };

export type OrderVelden = {
  organisatie_id: string;
  medewerker_id?: string | null;
  afdeling_id?: string | null;
  vestiging_id?: string | null;
  besteldatum?: string;
  referentienr?: string | null;
  aangevraagd_door?: string | null;
  aangevraagd_door_contact_id?: string | null;
  aangevraagd_door_medewerker_id?: string | null;
  notitie?: string | null;
  interne_notitie?: string | null;
  status?: string;
  goedkeuring_status?: string;
  /** Herkomst; zonder waarde zet de database 'handmatig'. Zie ORDER_BRONNEN. */
  bron?: OrderBron;
};

/** Waar een order vandaan komt (kolom orders.bron, migratie 20261006_orders_bron.sql). */
export const ORDER_BRONNEN = ['handmatig', 'portaal', 'api'] as const;
export type OrderBron = (typeof ORDER_BRONNEN)[number];

export type OrderregelVelden = {
  product_id?: string | null;
  variant_id?: string | null;
  item_naam: string;
  maat?: string | null;
  kleur?: string | null;
  lengte?: number | null;
  aantal: number;
  stukprijs?: number | null;
};

/** De losse tekstvelden van een order die op de orderpagina te wijzigen zijn. */
export type OrderGegevens = {
  referentienr: string | null;
  aangevraagd_door: string | null;
  aangevraagd_door_contact_id?: string | null;
  aangevraagd_door_medewerker_id?: string | null;
  notitie: string | null;
  interne_notitie: string | null;
};

export async function listOrders(status?: string): Promise<OrderMetKlant[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  let q = sb
    .from('orders')
    .select('*, organisaties(naam), medewerkers!orders_medewerker_id_fkey(naam)')
    .order('ordernummer', { ascending: false });
  if (status && status.trim()) q = q.eq('status', status.trim());
  const { data } = await q;
  const rows = (data as unknown as (Order & { organisaties: { naam: string } | null; medewerkers: { naam: string } | null })[]) ?? [];
  return rows.map((r) => {
    const { organisaties, medewerkers, ...rest } = r;
    return { ...rest, organisatie_naam: organisaties?.naam ?? null, medewerker_naam: medewerkers?.naam ?? null } as OrderMetKlant;
  });
}

/** Toegestane sorteerkolommen (echte DB-kolommen op orders). */
const SORTEERKOLOMMEN = ['ordernummer', 'besteldatum', 'bedrag', 'status', 'goedkeuring_status'] as const;

/**
 * Statussen waarin een order klaar is (geleverd of verder). Een order die
 * hier níet in staat en ouder is dan x dagen, telt als "loopt achter".
 * Geannuleerd staat erbij: die order loopt niet achter, hij loopt niet meer.
 */
export const AFGEHANDELDE_ORDERSTATUSSEN = ['compleet_geleverd', 'verzonden', 'factureren', 'afgerond', 'geannuleerd'] as const;
/** Fase "klaar" in de lijst: geleverd of verder, zonder de geannuleerde orders. */
const KLAAR_ORDERSTATUSSEN = AFGEHANDELDE_ORDERSTATUSSEN.filter((s) => s !== 'geannuleerd');

/** Extra filters op de orderlijst (FilterBalk). Alles optioneel. */
export type OrderLijstFilters = {
  /** organisatie_id */
  klant?: string | null;
  /** Besteldatum vanaf (inclusief), ISO-datum. */
  van?: string | null;
  /** Besteldatum tot (exclusief), ISO-datum. */
  totExclusief?: string | null;
  bedragMin?: number | null;
  bedragMax?: number | null;
  goedkeuring?: string | null;
  /** Herkomst uit de kolom orders.bron (portaal, handmatig of api). */
  bron?: OrderBron | null;
  drukproef?: 'ja' | 'nee' | null;
  /** Alleen open orders (niet geleverd of verder) met een besteldatum van meer dan x dagen geleden. */
  ouderDan?: number | null;
  /** 'open': nog niet geleverd. 'klaar': geleverd, verzonden, te factureren of afgerond. */
  fase?: 'open' | 'klaar' | null;
};

/** Eén pagina orders met optioneel statusfilter en sortering, plus het totaal aantal rijen voor paginering. */
export async function listOrdersPaged(opts: { pagina: number; perPagina: number; status?: string; zoek?: string; sort?: string; dir?: 'asc' | 'desc'; aanvrager?: string; filters?: OrderLijstFilters }): Promise<{ rijen: OrderMetKlant[]; totaal: number }> {
  const sb = kmsAdmin(); if (!sb) return { rijen: [], totaal: 0 };
  const pagina = Math.max(1, opts.pagina);
  const from = (pagina - 1) * opts.perPagina;
  const to = from + opts.perPagina - 1;
  const kolom = (SORTEERKOLOMMEN as readonly string[]).includes(opts.sort ?? '') ? (opts.sort as string) : 'ordernummer';
  const oplopend = opts.dir === 'asc' ? true : false;
  const f = opts.filters ?? {};
  let q = sb
    .from('orders')
    .select('*, organisaties(naam), medewerkers!orders_medewerker_id_fkey(naam)', { count: 'exact' })
    .order(kolom, { ascending: oplopend });
  // Filter "Aangevraagd door": de order-ids van die persoon, ook van oude orders
  // waar alleen de naam of het e-mailadres als tekst staat.
  if (opts.aanvrager && opts.aanvrager.trim()) {
    const ids = await orderIdsVoorAanvrager(opts.aanvrager);
    q = ids.length ? q.in('id', ids) : q.eq('id', '00000000-0000-0000-0000-000000000000');
  }
  if (opts.status && opts.status.trim()) q = q.eq('status', opts.status.trim());

  if (f.klant) q = q.eq('organisatie_id', f.klant);
  if (f.van) q = q.gte('besteldatum', f.van);
  if (f.totExclusief) q = q.lt('besteldatum', f.totExclusief);
  if (f.bedragMin != null) q = q.gte('bedrag', f.bedragMin);
  if (f.bedragMax != null) q = q.lte('bedrag', f.bedragMax);
  if (f.goedkeuring) q = q.eq('goedkeuring_status', f.goedkeuring);
  // Echte kolom (gezet bij aanmaken) in plaats van de oude schatting "aanvrager bevat een @",
  // die een passessie met het e-mailadres van een beheerder als portaalorder telde.
  if (f.bron) q = q.eq('bron', f.bron);
  if (f.drukproef) {
    const ids = await orderIdsMetDrukproef();
    if (f.drukproef === 'ja') q = ids.length ? q.in('id', ids) : q.eq('id', '00000000-0000-0000-0000-000000000000');
    else if (ids.length) q = q.not('id', 'in', `(${ids.join(',')})`);
  }
  if (f.fase === 'open') q = q.not('status', 'in', `(${AFGEHANDELDE_ORDERSTATUSSEN.join(',')})`);
  if (f.fase === 'klaar') q = q.in('status', [...KLAAR_ORDERSTATUSSEN]);
  if (f.ouderDan && f.ouderDan > 0) {
    const grens = new Date(Date.now() - f.ouderDan * 86_400_000).toISOString();
    q = q.lt('besteldatum', grens).not('status', 'in', `(${AFGEHANDELDE_ORDERSTATUSSEN.join(',')})`);
  }

  // Zoeken op klant (naam, plaats, klantnummer, contactpersoon; elk woord moet
  // passen), ordernummer, referentie of aanvrager. De klant zit in een join, en
  // PostgREST kan daar niet zonder meer op filteren; daarom eerst de klant-ids.
  const woorden = zoekWoorden(opts.zoek);
  if (woorden.length) {
    const term = woorden.join(' ');
    const orgIds = await klantIdsVoorZoekterm(sb, woorden);
    const delen: string[] = [`referentienr.ilike.%${term}%`, `aangevraagd_door.ilike.%${term}%`];
    if (orgIds.length) delen.push(`organisatie_id.in.(${orgIds.join(',')})`);
    const nummer = term.replace(/^#/, '');
    if (/^\d{1,9}$/.test(nummer)) delen.push(`ordernummer.eq.${Number(nummer)}`);
    q = q.or(delen.join(','));
  }

  const res = await q.range(from, to);
  const data = eisData('orders.lijst', res);
  const count = res.count;
  const rows = (data as unknown as (Order & { organisaties: { naam: string } | null; medewerkers: { naam: string } | null })[]) ?? [];
  const rijen = rows.map((r) => {
    const { organisaties, medewerkers, ...rest } = r;
    return { ...rest, organisatie_naam: organisaties?.naam ?? null, medewerker_naam: medewerkers?.naam ?? null } as OrderMetKlant;
  });
  return { rijen, totaal: count ?? 0 };
}

/** Kleurnamen komen uit importbestanden: "Zwart", "zwart " en "ZWART" zijn hetzelfde. */
const kleurSleutel = (kleur: string | null) => (kleur ?? '').trim().toLowerCase();

/**
 * Foto per orderregel: eerst de foto van die kleur, anders de eerste
 * productafbeelding. Twee queries voor de hele order, niet één per regel.
 * Sleutel van de map is het regel-id.
 */
async function afbeeldingPerRegel(regels: Orderregel[]): Promise<Map<string, string>> {
  const kaart = new Map<string, string>();
  const sb = kmsAdmin();
  const productIds = Array.from(new Set(regels.map((r) => r.product_id).filter((p): p is string => !!p)));
  if (!sb || productIds.length === 0) return kaart;

  const [{ data: prodData }, { data: kleurData }] = await Promise.all([
    sb.from('producten').select('id, afbeeldingen').in('id', productIds),
    sb.from('product_kleur_afbeeldingen').select('product_id, kleur, afbeelding_url').in('product_id', productIds),
  ]);

  const eersteFoto = new Map<string, string>();
  for (const p of ((prodData as { id: string; afbeeldingen: string[] | null }[]) ?? [])) {
    const eerste = (p.afbeeldingen ?? [])[0];
    if (eerste) eersteFoto.set(p.id, eerste);
  }
  const kleurFoto = new Map<string, string>();
  for (const k of ((kleurData as { product_id: string; kleur: string | null; afbeelding_url: string | null }[]) ?? [])) {
    if (k.afbeelding_url) kleurFoto.set(`${k.product_id}|${kleurSleutel(k.kleur)}`, k.afbeelding_url);
  }

  for (const r of regels) {
    if (!r.product_id) continue;
    const foto = kleurFoto.get(`${r.product_id}|${kleurSleutel(r.kleur)}`) ?? eersteFoto.get(r.product_id);
    if (foto) kaart.set(r.id, foto);
  }
  return kaart;
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const data = eisData(
    'orders.detail',
    await sb
      .from('orders')
      .select('*, organisaties(naam), medewerkers!orders_medewerker_id_fkey(naam)')
      .eq('id', id)
      .maybeSingle(),
  );
  if (!data) return null;
  const row = data as unknown as Order & { organisaties: { naam: string } | null; medewerkers: { naam: string } | null };
  // Zonder regels zou een pakbon of factuur leeg worden; een fout moet dus zichtbaar zijn.
  const regelData = eisData('orders.regels', await sb.from('orderregels').select('*').eq('order_id', id).order('created_at'));
  const regels = (regelData as Orderregel[]) ?? [];
  const fotos = await afbeeldingPerRegel(regels);
  const { organisaties, medewerkers, ...rest } = row;
  return {
    ...rest,
    organisatie_naam: organisaties?.naam ?? null,
    medewerker_naam: medewerkers?.naam ?? null,
    regels: regels.map((r) => ({ ...r, afbeelding: fotos.get(r.id) ?? null })),
  };
}

/**
 * Naam van de afdeling en de vestiging die aan een order hangen.
 *
 * Bewust twee losse lookups op id en geen join in getOrder: een join zou de
 * werkbon, pakbon, picklijst en factuur (die dezelfde getOrder gebruiken) laten
 * struikelen zodra de verwijzing tussen orders en deze twee tabellen ontbreekt.
 */
export async function afdelingEnVestigingNamen(
  afdelingId: string | null,
  vestigingId: string | null,
): Promise<{ afdeling: string | null; vestiging: string | null }> {
  const sb = kmsAdmin();
  if (!sb) return { afdeling: null, vestiging: null };

  const naamVan = async (tabel: 'afdelingen' | 'vestigingen', id: string | null): Promise<string | null> => {
    if (!id) return null;
    const { data } = await sb.from(tabel).select('naam').eq('id', id).maybeSingle();
    return (data as { naam: string | null } | null)?.naam ?? null;
  };

  const [afdeling, vestiging] = await Promise.all([
    naamVan('afdelingen', afdelingId),
    naamVan('vestigingen', vestigingId),
  ]);
  return { afdeling, vestiging };
}

/**
 * Inkoopwaarde van een order: inkoopprijs van de gekozen variant maal het
 * aantal. Regels zonder variant (vrije regels) tellen niet mee, dus de marge
 * die hierop volgt is een indicatie zolang niet elke regel aan een variant hangt.
 */
export async function inkoopwaardeVanOrder(regels: Orderregel[]): Promise<number> {
  const sb = kmsAdmin();
  const variantIds = Array.from(new Set(regels.map((r) => r.variant_id).filter((v): v is string => !!v)));
  if (!sb || variantIds.length === 0) return 0;

  const { data } = await sb.from('product_varianten').select('id, inkoopprijs').in('id', variantIds);
  const prijsVan = new Map<string, number>(
    ((data as { id: string; inkoopprijs: number | null }[]) ?? []).map((v) => [v.id, Number(v.inkoopprijs) || 0]),
  );
  return regels.reduce(
    (totaal, r) => totaal + (Number(r.aantal) || 0) * (r.variant_id ? prijsVan.get(r.variant_id) ?? 0 : 0),
    0,
  );
}

/**
 * Referentie, aanvrager en de twee notities bijwerken. Hier gaat een lege waarde
 * wel als null de update in: een veld dat je leegmaakt moet ook echt leeg
 * worden, anders krijg je een verkeerde notitie er nooit meer af.
 */
export async function werkOrderGegevens(id: string, v: OrderGegevens): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !id) return false;
  const { error } = await metIdTerugval({ ...v }, AANVRAGER_ID_KOLOMMEN, (rij) =>
    sb.from('orders').update(rij).eq('id', id),
  );
  return !error;
}

export type OrderKlant = { id: string; naam: string; plaats: string | null; klantnummer: string | null };
/** Medewerker, afdeling of vestiging: alle drie horen bij één klant. */
export type OrderKeuzeRij = { id: string; naam: string; organisatie_id: string };
export type NieuweOrderKeuzes = {
  klanten: OrderKlant[];
  medewerkers: OrderKeuzeRij[];
  afdelingen: OrderKeuzeRij[];
  vestigingen: OrderKeuzeRij[];
};

/**
 * Alles wat het aanmaakscherm nodig heeft, in vier parallelle queries.
 * De browser filtert medewerkers, afdelingen en vestigingen zelf op de gekozen
 * klant, zodat die keuzelijsten meteen kloppen zonder de pagina te herladen.
 * `actief` is bij oudere rijen leeg; die horen er gewoon bij te staan.
 */
export async function keuzesVoorNieuweOrder(): Promise<NieuweOrderKeuzes> {
  const leeg: NieuweOrderKeuzes = { klanten: [], medewerkers: [], afdelingen: [], vestigingen: [] };
  const sb = kmsAdmin();
  if (!sb) return leeg;

  const [klantRes, medewRes, afdRes, vestRes] = await Promise.all([
    sb.from('organisaties').select('id, naam, plaats, klantnummer').or('actief.is.null,actief.eq.true').order('naam').limit(2000),
    sb.from('medewerkers').select('id, naam, organisatie_id').or('actief.is.null,actief.eq.true').order('naam').limit(5000),
    sb.from('afdelingen').select('id, naam, organisatie_id').order('naam').limit(2000),
    sb.from('vestigingen').select('id, naam, organisatie_id').order('naam').limit(2000),
  ]);

  const keuzeRijen = (data: unknown): OrderKeuzeRij[] =>
    ((data as { id: string; naam: string | null; organisatie_id: string | null }[]) ?? [])
      .filter((r) => !!r.organisatie_id)
      .map((r) => ({ id: r.id, naam: r.naam ?? 'Zonder naam', organisatie_id: r.organisatie_id as string }));

  return {
    klanten: ((klantRes.data as { id: string; naam: string | null; plaats: string | null; klantnummer: string | null }[]) ?? []).map((k) => ({
      id: k.id,
      naam: k.naam ?? 'Zonder naam',
      plaats: k.plaats,
      klantnummer: k.klantnummer,
    })),
    medewerkers: keuzeRijen(medewRes.data),
    afdelingen: keuzeRijen(afdRes.data),
    vestigingen: keuzeRijen(vestRes.data),
  };
}

/**
 * Actieve artikelen voor de regelkiezer op de orderpagina.
 *
 * Deze lijst gaat in zijn geheel naar de browser, zodat zoeken meeloopt met wat
 * Jessi typt. Roep hem daarom aan vanuit de kiezer zelf en niet bij het
 * opbouwen van de orderpagina: wie alleen een status komt bijwerken hoeft de
 * hele catalogus niet mee te krijgen.
 */
export async function listProductenVoorRegels(): Promise<OrderProduct[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('producten')
    .select('id, naam, merk, categorie, afbeeldingen, maatwerk_lengte')
    .eq('actief', true)
    .order('naam')
    .limit(2000);
  return ((data as Record<string, unknown>[]) ?? []).map((p) => ({
    id: p.id as string,
    naam: (p.naam as string | null) ?? 'Naamloos',
    merk: (p.merk as string | null) ?? null,
    categorie: (p.categorie as string | null) ?? null,
    afbeelding: ((p.afbeeldingen as string[] | null) ?? [])[0] ?? null,
    maatwerk_lengte: Boolean(p.maatwerk_lengte),
  }));
}

/**
 * Maten en kleuren van één artikel, met kleurfoto en prijs.
 * `actief` is bij oudere varianten nooit ingevuld; die zouden met een harde
 * `actief = true` uit de lijst vallen en dan lijkt het artikel maatloos.
 */
export async function listVariantenVoorProduct(productId: string): Promise<OrderVariant[]> {
  const sb = kmsAdmin();
  if (!sb || !productId.trim()) return [];

  const [{ data: varData }, { data: fotoData }] = await Promise.all([
    sb
      .from('product_varianten')
      .select('id, maat, kleur, verkoopprijs, meerprijs, voorraad')
      .eq('product_id', productId)
      .or('actief.is.null,actief.eq.true')
      .limit(2000),
    sb.from('product_kleur_afbeeldingen').select('kleur, afbeelding_url').eq('product_id', productId),
  ]);

  const fotoVan = new Map<string, string>();
  for (const f of ((fotoData as { kleur: string | null; afbeelding_url: string | null }[]) ?? [])) {
    if (f.afbeelding_url) fotoVan.set(kleurSleutel(f.kleur), f.afbeelding_url);
  }

  type VariantRij = {
    id: string;
    maat: string | null;
    kleur: string | null;
    verkoopprijs: number | null;
    meerprijs: number | null;
    voorraad: number | null;
  };

  const varianten: OrderVariant[] = ((varData as VariantRij[]) ?? []).map((v) => ({
    id: v.id,
    maat: v.maat,
    kleur: v.kleur,
    // Meerprijs is een toeslag bovenop de verkoopprijs (grote maten, extra lengte).
    // Staan beide leeg, dan is er geen prijs bekend en vult de kiezer niets in.
    prijs: v.verkoopprijs == null && v.meerprijs == null ? null : (Number(v.verkoopprijs) || 0) + (Number(v.meerprijs) || 0),
    voorraad: Number(v.voorraad) || 0,
    afbeelding: fotoVan.get(kleurSleutel(v.kleur)) ?? null,
  }));

  // Maten volgens de vaste matenlijst (XS, S, M, L, XL, 2XL; broekmaten oplopend).
  // Alfabetisch (ook met numeric) gaf L, M, S, XL, XS. Varianten zonder maat achteraan.
  const matenVolgorde = sorteerMaten([...new Set(varianten.map((v) => v.maat?.trim() ?? '').filter(Boolean))]);
  const plek = (m: string | null) => {
    const i = matenVolgorde.indexOf(m?.trim() ?? '');
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  varianten.sort((a, b) => (a.kleur ?? '').localeCompare(b.kleur ?? '', 'nl') || plek(a.maat) - plek(b.maat));
  return varianten;
}

export async function maakOrder(v: OrderVelden): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data, error } = await metIdTerugval(
    { status: 'concept', goedkeuring_status: 'niet_nodig', besteldatum: new Date().toISOString(), ...v },
    [...AANVRAGER_ID_KOLOMMEN, 'bron'],
    (rij) => sb.from('orders').insert(rij).select('id').single(),
  );
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function voegOrderregelToe(orderId: string, v: OrderregelVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('orderregels').insert({ order_id: orderId, ...v });
  if (error) return false;
  await herberekenOrderbedrag(orderId);
  return true;
}

export async function verwijderOrderregel(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { data } = await sb.from('orderregels').select('order_id').eq('id', id).maybeSingle();
  const orderId = (data as { order_id: string } | null)?.order_id ?? null;
  // Eerst de inkoop die nog niet weg is intrekken; anders blijft er een
  // inkoopregel zonder orderregel in de werkvoorraad staan.
  if (orderId) await annuleerInkoopVoorOrder(orderId, id);
  const { error } = await sb.from('orderregels').delete().eq('id', id);
  if (error) return false;
  if (orderId) await herberekenOrderbedrag(orderId);
  return true;
}

/**
 * Mag er nog aan de regels van deze order gewerkt worden? Niet als hij is
 * afgerond of geannuleerd, en niet als er al een factuur de deur uit is: dan
 * kloppen order en factuur niet meer met elkaar. Geeft de reden terug, of null.
 */
export async function orderRegelsGeslotenReden(orderId: string): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb || !orderId) return null;
  const [{ data: o }, { data: f }] = await Promise.all([
    sb.from('orders').select('status').eq('id', orderId).maybeSingle(),
    sb.from('facturen').select('status').eq('order_id', orderId),
  ]);
  const status = (o as { status: string | null } | null)?.status ?? '';
  if (status === 'geannuleerd') return 'geannuleerd';
  if (status === 'afgerond') return 'afgerond';
  if (((f as { status: string }[]) ?? []).some((x) => x.status !== 'concept')) return 'gefactureerd';
  return null;
}

export type StatusUitkomst = {
  ok: boolean;
  /** Zelfde status als hij al had: niets gedaan, geen mail. */
  ongewijzigd?: boolean;
  /** Bij annuleren: inkoopregels die uit de werkvoorraad zijn gehaald. */
  inkoopGeannuleerd?: number;
  /** Bij annuleren: inkoopregels die al besteld zijn en zelf afgezegd moeten worden. */
  inkoopAlBesteld?: number;
  /** Bij uitleveren: aantal stuks dat van de voorraad is afgeboekt. */
  voorraadAfgeboekt?: number;
  /** Geweigerd met een reden die Jessi moet zien (bijv. annuleren na facturering). */
  fout?: string;
  /** Korte code van die reden, voor de melding in de URL. */
  foutCode?: AnnuleerBlokkade;
};

export type AnnuleerBlokkade = 'gefactureerd' | 'uitgeleverd';

export const ANNULEER_BLOKKADE_TEKST: Record<AnnuleerBlokkade, string> = {
  gefactureerd: 'Deze order kan niet worden geannuleerd: er is al een factuur verstuurd. Maak eerst een creditfactuur.',
  uitgeleverd: 'Deze order kan niet worden geannuleerd: hij is al uitgeleverd. Boek een retour in plaats van te annuleren.',
};

/**
 * Mag een order nog geannuleerd worden? Niet als hij al de deur uit is, en niet
 * als er een factuur bestaat die geen concept meer is. Puur, dus los te testen.
 */
export function annuleerBlokkade(orderStatus: string, factuurStatussen: readonly string[]): AnnuleerBlokkade | null {
  if (factuurStatussen.some((s) => s !== 'concept')) return 'gefactureerd';
  if (UITGELEVERDE_ORDERSTATUSSEN.includes(orderStatus)) return 'uitgeleverd';
  return null;
}

/**
 * Zet de orderstatus en doet wat er bij die stap hoort:
 * - alleen bekende statussen; dezelfde status opnieuw kiezen doet niets (ook geen mail);
 * - geannuleerd: openstaande inkoop intrekken;
 * - de deur uit (bezorgen, verzonden, factureren, afgerond): voorraad afboeken (één keer);
 * - daarna de statusmail naar de besteller (best effort).
 */
export async function zetOrderStatusMetGevolgen(id: string, status: string, actor?: string | null): Promise<StatusUitkomst> {
  const sb = kmsAdmin(); if (!sb) return { ok: false };
  if (!isOrderStatus(status)) return { ok: false };
  const { data } = await sb.from('orders').select('status').eq('id', id).maybeSingle();
  const huidig = (data as { status: string } | null)?.status;
  if (huidig === undefined) return { ok: false };
  if (huidig === status) return { ok: true, ongewijzigd: true };
  if (status === 'geannuleerd') {
    // Kan de facturen niet lezen: dan liever weigeren dan een gefactureerde order annuleren.
    const { data: f, error: fFout } = await sb.from('facturen').select('status').eq('order_id', id);
    if (fFout) return { ok: false };
    const blokkade = annuleerBlokkade(huidig, ((f as { status: string }[]) ?? []).map((x) => x.status));
    if (blokkade) return { ok: false, fout: ANNULEER_BLOKKADE_TEKST[blokkade], foutCode: blokkade };
  }
  const { error } = await sb.from('orders').update({ status }).eq('id', id);
  if (error) return { ok: false };

  const uitkomst: StatusUitkomst = { ok: true };
  if (status === 'geannuleerd') {
    const inkoop = await annuleerInkoopVoorOrder(id);
    uitkomst.inkoopGeannuleerd = inkoop.geannuleerd;
    uitkomst.inkoopAlBesteld = inkoop.alBesteld;
  } else if (huidig === 'geannuleerd') {
    // Heropend: de inkoop is bij het annuleren ingetrokken, dus opnieuw klaarzetten
    // (genereerInkoopregels voorkomt zelf dubbels). volgOrderNaInkoop zet de order
    // daarna op de stap die bij de inkoop past (alleen vooruit, alleen in de inkoopfase).
    // Niet voor een concept of offerte (nog geen inkoop) en niet voor een order die
    // direct op een uitgeleverde status wordt gezet (dan valt er niets meer in te kopen).
    if (UITGELEVERDE_ORDERSTATUSSEN.includes(status)) {
      const af = await boekOrderVoorraadAf(id, actor ?? null).catch(() => ({ geboekt: 0, stuks: 0 }));
      uitkomst.voorraadAfgeboekt = af.stuks;
    } else if (!['concept', 'offerte_verstuurd', 'offerte_goedgekeurd'].includes(status)) {
      await genereerInkoopregels(id).catch(() => 0);
      await volgOrderNaInkoop(id).catch(() => null);
    }
  } else if (UITGELEVERDE_ORDERSTATUSSEN.includes(status)) {
    const af = await boekOrderVoorraadAf(id, actor ?? null).catch(() => ({ geboekt: 0, stuks: 0 }));
    uitkomst.voorraadAfgeboekt = af.stuks;
  }
  // Statusupdate naar de besteller (best effort; faalt de mutatie nooit).
  await stuurStatusMail(id).catch(() => {});
  return uitkomst;
}

export async function zetOrderStatus(id: string, status: string): Promise<boolean> {
  return (await zetOrderStatusMetGevolgen(id, status)).ok;
}

/**
 * Goedkeuring vastleggen. `persoon` koppelt "door wie" aan een contactpersoon of
 * werknemer van de klant; zonder migratie blijft alleen de naam staan.
 *
 * De orderstatus loopt mee, net als bij een beslissing in het portaal:
 * goedgekeurd zet een order die nog concept was op "nog bestellen" en maakt de
 * inkoopregels aan; afgewezen annuleert de order (en de openstaande inkoop).
 */
export async function zetGoedkeuring(
  id: string,
  status: string,
  doorWie?: string | null,
  persoon?: { contactId?: string | null; medewerkerId?: string | null },
): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  if (!(GOEDKEURING_STATUSSEN as readonly string[]).includes(status)) return false;
  const { data: huidigData } = await sb.from('orders').select('status').eq('id', id).maybeSingle();
  const huidigeStatus = (huidigData as { status: string } | null)?.status ?? null;
  if (huidigeStatus === null) return false;
  const patch: Record<string, unknown> = { goedkeuring_status: status };
  if (status === 'goedgekeurd' || status === 'afgewezen') {
    patch.goedgekeurd_door = doorWie ?? null;
    if (persoon) {
      patch.goedgekeurd_door_contact_id = persoon.contactId ?? null;
      patch.goedgekeurd_door_medewerker_id = persoon.medewerkerId ?? null;
    }
  }
  if (status === 'goedgekeurd' && (huidigeStatus === 'concept' || huidigeStatus === 'geannuleerd')) patch.status = 'nog_bestellen';
  if (status === 'afgewezen' && huidigeStatus !== 'geannuleerd') {
    // Zelfde grens als bij annuleren: niet als de order al de deur uit is of gefactureerd.
    const { data: f, error: fFout } = await sb.from('facturen').select('status').eq('order_id', id);
    const blokkade = fFout ? 'gefactureerd' : annuleerBlokkade(huidigeStatus, ((f as { status: string }[]) ?? []).map((x) => x.status));
    if (!blokkade) patch.status = 'geannuleerd';
  }
  // Terug naar "wacht": een order die net was goedgekeurd gaat terug naar concept.
  if (status === 'wacht' && huidigeStatus === 'nog_bestellen') patch.status = 'concept';
  const { error } = await metIdTerugval(patch, GOEDKEURDER_ID_KOLOMMEN, (rij) =>
    sb.from('orders').update(rij).eq('id', id),
  );
  if (error) return false;
  if (patch.status === 'geannuleerd') await annuleerInkoopVoorOrder(id);
  // Bij goedkeuring meteen inkoopregels voor wat niet op voorraad is (voorkomt zelf dubbels).
  if (status === 'goedgekeurd') {
    await genereerInkoopregels(id).catch(() => 0);
    await volgOrderNaInkoop(id).catch(() => null);
  }
  // Statusupdate naar de besteller. Bewust geen bestelmail naar de leverancier
  // meer: die mailde álle regels (ook wat op voorraad lag) en de inkoopregels
  // bleven op "te bestellen" staan, zodat via Inkoop alles nog een keer besteld
  // werd. Bestellen bij de leverancier gaat nu alleen via Inkoop.
  await stuurStatusMail(id).catch(() => {});
  return true;
}

export async function herberekenOrderbedrag(id: string): Promise<number> {
  const sb = kmsAdmin(); if (!sb) return 0;
  const [{ data }, { data: oData }] = await Promise.all([
    sb.from('orderregels').select('aantal, stukprijs').eq('order_id', id),
    sb.from('orders').select('bedrag').eq('id', id).maybeSingle(),
  ]);
  const regels = (data as { aantal: number; stukprijs: number | null }[]) ?? [];
  // Per regel op centen, net als de factuur: anders wijkt het ordertotaal een cent af.
  const bedrag = Math.round(
    regels.reduce((t, r) => t + Math.round((Number(r.aantal) || 0) * (Number(r.stukprijs) || 0) * 100), 0),
  ) / 100;
  // Pakketbestelling uit het portaal: de regels staan op nul en de pakketprijs
  // staat alleen op de order. Die niet wegpoetsen als er een regel bijkomt of afgaat.
  const huidig = Number((oData as { bedrag: number | null } | null)?.bedrag) || 0;
  if (bedrag === 0 && regels.length > 0 && huidig > 0 && regels.every((r) => (Number(r.stukprijs) || 0) === 0)) return huidig;
  await sb.from('orders').update({ bedrag }).eq('id', id);
  return bedrag;
}
