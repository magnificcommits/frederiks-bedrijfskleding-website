import { kmsAdmin } from '@/lib/kms/adminClient';
import { stuurStatusMail, stuurLeverancierBestelmail } from '@/lib/kms/notificaties';

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
] as const;
export type OrderStatus = (typeof ORDER_STATUSSEN)[number];

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
};

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
  notitie?: string | null;
  interne_notitie?: string | null;
  status?: string;
  goedkeuring_status?: string;
};

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
  notitie: string | null;
  interne_notitie: string | null;
};

export async function listOrders(status?: string): Promise<OrderMetKlant[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  let q = sb
    .from('orders')
    .select('*, organisaties(naam), medewerkers(naam)')
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

/** Eén pagina orders met optioneel statusfilter en sortering, plus het totaal aantal rijen voor paginering. */
export async function listOrdersPaged(opts: { pagina: number; perPagina: number; status?: string; zoek?: string; sort?: string; dir?: 'asc' | 'desc' }): Promise<{ rijen: OrderMetKlant[]; totaal: number }> {
  const sb = kmsAdmin(); if (!sb) return { rijen: [], totaal: 0 };
  const pagina = Math.max(1, opts.pagina);
  const from = (pagina - 1) * opts.perPagina;
  const to = from + opts.perPagina - 1;
  const kolom = (SORTEERKOLOMMEN as readonly string[]).includes(opts.sort ?? '') ? (opts.sort as string) : 'ordernummer';
  const oplopend = opts.dir === 'asc' ? true : false;
  let q = sb
    .from('orders')
    .select('*, organisaties(naam), medewerkers(naam)', { count: 'exact' })
    .order(kolom, { ascending: oplopend });
  if (opts.status && opts.status.trim()) q = q.eq('status', opts.status.trim());
  // Zoeken op klantnaam of op nummer. De klant zit in een join, en PostgREST kan
  // daar niet zonder meer op filteren; daarom eerst de organisatie-ids ophalen.
  if (opts.zoek && opts.zoek.trim()) {
    const term = opts.zoek.trim().replace(/[%,()]/g, ' ');
    const { data: orgRijen } = await sb.from('organisaties').select('id').ilike('naam', `%${term}%`);
    const orgIds = ((orgRijen as { id: string }[]) ?? []).map((o) => o.id);
    const delen: string[] = [];
    if (orgIds.length) delen.push(`organisatie_id.in.(${orgIds.join(',')})`);
    if (/^\d+$/.test(term)) delen.push(`ordernummer.eq.${Number(term)}`);
    // Niets dat kan matchen: dan liever nul rijen dan de hele lijst.
    q = delen.length ? q.or(delen.join(',')) : q.eq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { data, count } = await q.range(from, to);
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
  const { data } = await sb
    .from('orders')
    .select('*, organisaties(naam), medewerkers(naam)')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Order & { organisaties: { naam: string } | null; medewerkers: { naam: string } | null };
  const { data: regelData } = await sb.from('orderregels').select('*').eq('order_id', id).order('created_at');
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
  const { error } = await sb.from('orders').update(v).eq('id', id);
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

  // Maten sorteren op getal waar dat kan (48 voor 50), anders alfabetisch met
  // numeric-optie zodat M voor XL komt en 2XL na XL.
  varianten.sort((a, b) => {
    const kleurVerschil = (a.kleur ?? '').localeCompare(b.kleur ?? '', 'nl');
    if (kleurVerschil !== 0) return kleurVerschil;
    // Number('') en Number(null) zijn 0; daarom eerst op leeg controleren,
    // anders schuift een variant zonder maat tussen de confectiematen.
    const na = a.maat?.trim() ? Number(a.maat) : NaN;
    const nb = b.maat?.trim() ? Number(b.maat) : NaN;
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return (a.maat ?? '').localeCompare(b.maat ?? '', 'nl', { numeric: true });
  });
  return varianten;
}

export async function maakOrder(v: OrderVelden): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data, error } = await sb
    .from('orders')
    .insert({ status: 'concept', goedkeuring_status: 'niet_nodig', besteldatum: new Date().toISOString(), ...v })
    .select('id')
    .single();
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
  const { error } = await sb.from('orderregels').delete().eq('id', id);
  if (error) return false;
  if (orderId) await herberekenOrderbedrag(orderId);
  return true;
}

export async function zetOrderStatus(id: string, status: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('orders').update({ status }).eq('id', id);
  if (error) return false;
  // Statusupdate naar de besteller (best effort; faalt de mutatie nooit).
  await stuurStatusMail(id).catch(() => {});
  return true;
}

export async function zetGoedkeuring(id: string, status: string, doorWie?: string | null): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const patch: { goedkeuring_status: string; goedgekeurd_door?: string | null } = { goedkeuring_status: status };
  if (status === 'goedgekeurd' || status === 'afgewezen') patch.goedgekeurd_door = doorWie ?? null;
  const { error } = await sb.from('orders').update(patch).eq('id', id);
  if (error) return false;
  // Statusupdate naar de besteller; bij goedkeuring ook de bestelmail naar de leverancier(s).
  await stuurStatusMail(id).catch(() => {});
  if (status === 'goedgekeurd') await stuurLeverancierBestelmail(id).catch(() => {});
  return true;
}

export async function herberekenOrderbedrag(id: string): Promise<number> {
  const sb = kmsAdmin(); if (!sb) return 0;
  const { data } = await sb.from('orderregels').select('aantal, stukprijs').eq('order_id', id);
  const regels = (data as { aantal: number; stukprijs: number | null }[]) ?? [];
  const bedrag = regels.reduce((t, r) => t + (Number(r.aantal) || 0) * (Number(r.stukprijs) || 0), 0);
  await sb.from('orders').update({ bedrag }).eq('id', id);
  return bedrag;
}
