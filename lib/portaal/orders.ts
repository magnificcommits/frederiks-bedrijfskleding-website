import { getServerSupabase } from './supabaseServer';

/** Eén regel binnen een order: het bestelde artikel met maat, kleur en aantal. */
export type MijnOrderRegel = {
  id: string;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
};

/** Een bestelling uit de nieuwe orders-tabel, met regels en de medewerkernaam. */
export type MijnOrder = {
  id: string;
  ordernummer: number | null;
  status: string | null;
  goedkeuring_status: string | null;
  bedrag: number | null;
  besteldatum: string | null;
  created_at: string | null;
  aangevraagd_door: string | null;
  notitie: string | null;
  vervoerder: string | null;
  track_trace_code: string | null;
  medewerker_id: string | null;
  medewerker_naam: string | null;
  regels: MijnOrderRegel[];
};

/** Nette labels voor de bekende orderstatussen. */
const STATUS_LABELS: Record<string, string> = {
  concept: 'Concept',
  offerte_verstuurd: 'Offerte verstuurd',
  offerte_goedgekeurd: 'Offerte goedgekeurd',
  nog_bestellen: 'Nog bestellen',
  besteld: 'Besteld',
  deellevering: 'Deellevering',
  compleet_geleverd: 'Compleet geleverd',
  bedrukken: 'Bedrukken',
  borduren: 'Borduren',
  verpakken: 'Verpakken',
  bezorgen: 'Bezorgen',
  verzonden: 'Verzonden',
  factureren: 'Factureren',
  afgerond: 'Afgerond',
  geannuleerd: 'Geannuleerd',
};

/** Nette labels voor de goedkeuringsstatussen. */
const GOEDKEURING_LABELS: Record<string, string> = {
  niet_nodig: 'Geen goedkeuring nodig',
  wacht: 'Wacht op goedkeuring',
  goedgekeurd: 'Goedgekeurd',
  afgewezen: 'Afgewezen',
  afgekeurd: 'Afgewezen',
};

/**
 * Leesbare weergave van een statuswaarde.
 * Gebruikt een net label voor bekende statussen, en valt anders terug op
 * de ruwe waarde met underscores vervangen door spaties.
 */
export function leesbareStatus(status: string | null): string {
  if (!status) return 'Onbekend';
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

/** Leesbare weergave van een goedkeuringsstatus, met terugval op spaties. */
export function leesbareGoedkeuring(status: string | null): string {
  if (!status) return '';
  return GOEDKEURING_LABELS[status] ?? status.replace(/_/g, ' ');
}

/**
 * De bestellingen van de ingelogde gebruiker uit de nieuwe orders-tabel.
 * RLS regelt de scope: een medewerker ziet alleen eigen orders, een beheerder
 * of leidinggevende de hele organisatie. Nieuwste eerst.
 */
export async function getMijnOrders(): Promise<MijnOrder[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];

  const { data } = await sb
    .from('orders')
    .select(
      'id, ordernummer, status, goedkeuring_status, bedrag, besteldatum, created_at, aangevraagd_door, notitie, vervoerder, track_trace_code, medewerker_id, medewerkers(naam)',
    )
    .order('created_at', { ascending: false });

  const orders =
    (data as unknown as (Omit<MijnOrder, 'regels' | 'medewerker_naam'> & {
      medewerkers: { naam: string | null } | null;
    })[]) ?? [];
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const { data: regelData } = await sb
    .from('orderregels')
    .select('id, order_id, item_naam, maat, kleur, aantal')
    .in('order_id', orderIds);
  const regels = (regelData as (MijnOrderRegel & { order_id: string })[]) ?? [];

  return orders.map((o) => {
    const { medewerkers, ...rest } = o;
    return {
      ...rest,
      medewerker_naam: medewerkers?.naam ?? null,
      regels: regels.filter((r) => r.order_id === o.id),
    };
  });
}
