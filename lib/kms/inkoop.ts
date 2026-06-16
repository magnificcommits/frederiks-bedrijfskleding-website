import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor de module Inkoop.
 * Genereert inkoopregels op basis van orderregels waar de voorraad tekortschiet
 * en beheert de status van die inkoopregels. Alleen server-side, achter dashAuthed().
 */

export const INKOOP_STATUSSEN = ['te_bestellen', 'besteld', 'deels', 'geleverd'] as const;
export type InkoopStatus = (typeof INKOOP_STATUSSEN)[number];

export type Inkoopregel = {
  id: string;
  order_id: string | null;
  orderregel_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  leverancier_id: string | null;
  merk: string | null;
  item_naam: string | null;
  maat: string | null;
  kleur: string | null;
  aantal: number;
  status: string;
  besteld_op: string | null;
  geleverd_aantal: number;
  created_at: string;
};

export type InkoopregelMetLeverancier = Inkoopregel & { leverancier_naam: string | null };

type OrderregelRij = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
};

/**
 * Loopt door de orderregels van een order. Voor elke regel kijkt hij naar de
 * voorraad van de gekoppelde variant. Is die voorraad lager dan het bestelde
 * aantal (of is er geen variant), dan maakt hij een inkoopregel voor het tekort.
 * Merk en leverancier komen van het gekoppelde product. Geeft het aantal
 * aangemaakte inkoopregels terug.
 */
export async function genereerInkoopregels(orderId: string): Promise<number> {
  const sb = kmsAdmin(); if (!sb) return 0;

  const { data: regelData } = await sb
    .from('orderregels')
    .select('id, order_id, product_id, variant_id, item_naam, maat, kleur, aantal')
    .eq('order_id', orderId);
  const regels = (regelData as OrderregelRij[]) ?? [];
  if (regels.length === 0) return 0;

  // Voorkom dubbele inkoopregels: welke orderregels hebben er al een?
  const { data: bestaand } = await sb.from('inkoopregels').select('orderregel_id').eq('order_id', orderId);
  const alAanwezig = new Set(((bestaand as { orderregel_id: string | null }[]) ?? []).map((b) => b.orderregel_id).filter(Boolean));

  // Varianten ophalen voor de voorraadcheck.
  const variantIds = regels.map((r) => r.variant_id).filter((v): v is string => Boolean(v));
  const voorraadPerVariant = new Map<string, number>();
  if (variantIds.length > 0) {
    const { data: varData } = await sb.from('product_varianten').select('id, voorraad').in('id', variantIds);
    for (const v of (varData as { id: string; voorraad: number }[]) ?? []) voorraadPerVariant.set(v.id, Number(v.voorraad) || 0);
  }

  // Merk + leverancier per product ophalen.
  const productIds = regels.map((r) => r.product_id).filter((p): p is string => Boolean(p));
  const productInfo = new Map<string, { merk: string | null; leverancier_id: string | null }>();
  if (productIds.length > 0) {
    const { data: prodData } = await sb.from('producten').select('id, merk, leverancier_id').in('id', productIds);
    for (const p of (prodData as { id: string; merk: string | null; leverancier_id: string | null }[]) ?? []) {
      productInfo.set(p.id, { merk: p.merk, leverancier_id: p.leverancier_id });
    }
  }

  const nieuw: Record<string, unknown>[] = [];
  for (const r of regels) {
    if (alAanwezig.has(r.id)) continue;
    const voorraad = r.variant_id ? (voorraadPerVariant.get(r.variant_id) ?? 0) : 0;
    const tekort = Math.max(0, (Number(r.aantal) || 0) - voorraad);
    if (tekort <= 0) continue;
    const info = r.product_id ? productInfo.get(r.product_id) : undefined;
    nieuw.push({
      order_id: r.order_id,
      orderregel_id: r.id,
      product_id: r.product_id,
      variant_id: r.variant_id,
      leverancier_id: info?.leverancier_id ?? null,
      merk: info?.merk ?? null,
      item_naam: r.item_naam,
      maat: r.maat,
      kleur: r.kleur,
      aantal: tekort,
      status: 'te_bestellen',
    });
  }

  if (nieuw.length === 0) return 0;
  const { error } = await sb.from('inkoopregels').insert(nieuw);
  return error ? 0 : nieuw.length;
}

export async function listInkoopregels(status?: string): Promise<InkoopregelMetLeverancier[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  let q = sb.from('inkoopregels').select('*, leveranciers(naam)').order('created_at', { ascending: false });
  if (status && status.trim()) q = q.eq('status', status.trim());
  const { data } = await q;
  const rows = (data as unknown as (Inkoopregel & { leveranciers: { naam: string } | null })[]) ?? [];
  return rows.map((r) => {
    const { leveranciers, ...rest } = r;
    return { ...rest, leverancier_naam: leveranciers?.naam ?? null } as InkoopregelMetLeverancier;
  });
}

export async function listInkoopregelsVoorOrder(orderId: string): Promise<InkoopregelMetLeverancier[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('inkoopregels')
    .select('*, leveranciers(naam)')
    .eq('order_id', orderId)
    .order('created_at');
  const rows = (data as unknown as (Inkoopregel & { leveranciers: { naam: string } | null })[]) ?? [];
  return rows.map((r) => {
    const { leveranciers, ...rest } = r;
    return { ...rest, leverancier_naam: leveranciers?.naam ?? null } as InkoopregelMetLeverancier;
  });
}

export async function zetInkoopStatus(id: string, status: string, besteldOp?: string | null, geleverdAantal?: number | null): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const patch: Record<string, unknown> = { status };
  if (besteldOp !== undefined) patch.besteld_op = besteldOp;
  if (geleverdAantal !== undefined && geleverdAantal !== null) patch.geleverd_aantal = geleverdAantal;
  const { error } = await sb.from('inkoopregels').update(patch).eq('id', id);
  return !error;
}
