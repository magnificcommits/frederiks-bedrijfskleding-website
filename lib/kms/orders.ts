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
};

export type Orderregel = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
  stukprijs: number | null;
  created_at: string;
};

export type OrderMetKlant = Order & { organisatie_naam: string | null; medewerker_naam: string | null };
export type OrderDetail = OrderMetKlant & { regels: Orderregel[] };

export type OrderVelden = {
  organisatie_id: string;
  medewerker_id?: string | null;
  afdeling_id?: string | null;
  aangevraagd_door?: string | null;
  notitie?: string | null;
  status?: string;
  goedkeuring_status?: string;
};

export type OrderregelVelden = {
  product_id?: string | null;
  variant_id?: string | null;
  item_naam: string;
  maat?: string | null;
  kleur?: string | null;
  aantal: number;
  stukprijs?: number | null;
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

/** Eén pagina orders (nieuwste eerst) met optioneel statusfilter, plus het totaal aantal rijen voor paginering. */
export async function listOrdersPaged(opts: { pagina: number; perPagina: number; status?: string }): Promise<{ rijen: OrderMetKlant[]; totaal: number }> {
  const sb = kmsAdmin(); if (!sb) return { rijen: [], totaal: 0 };
  const pagina = Math.max(1, opts.pagina);
  const from = (pagina - 1) * opts.perPagina;
  const to = from + opts.perPagina - 1;
  let q = sb
    .from('orders')
    .select('*, organisaties(naam), medewerkers(naam)', { count: 'exact' })
    .order('ordernummer', { ascending: false });
  if (opts.status && opts.status.trim()) q = q.eq('status', opts.status.trim());
  const { data, count } = await q.range(from, to);
  const rows = (data as unknown as (Order & { organisaties: { naam: string } | null; medewerkers: { naam: string } | null })[]) ?? [];
  const rijen = rows.map((r) => {
    const { organisaties, medewerkers, ...rest } = r;
    return { ...rest, organisatie_naam: organisaties?.naam ?? null, medewerker_naam: medewerkers?.naam ?? null } as OrderMetKlant;
  });
  return { rijen, totaal: count ?? 0 };
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
  const { organisaties, medewerkers, ...rest } = row;
  return {
    ...rest,
    organisatie_naam: organisaties?.naam ?? null,
    medewerker_naam: medewerkers?.naam ?? null,
    regels: (regelData as Orderregel[]) ?? [],
  };
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
