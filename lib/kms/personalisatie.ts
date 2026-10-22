import { kmsAdmin } from '@/lib/kms/adminClient';
import { drukproefVoorRegel, listDrukproevenVoorOrder, type Drukproef } from '@/lib/kms/drukproeven';
import { allePlaatsingen, normaliseerOntwerp } from '@/app/dashboard/drukproeven/ontwerp';
import {
  berekenPersonalisatie,
  type Formaat,
  type Kosten,
  type PersonalisatieRegel,
  type ProefInvoer,
  type RegelInvoer,
  type Tarief,
} from '@/lib/personalisatie';

/**
 * Personalisatiekosten op offerte en order (mail Jessi 21 okt 2026). Leest de
 * centrale prijslijst, de afwijkende staffels van de klant en de goedgekeurde
 * drukproeven, en zet de uitkomst als aparte regels (soort 'personalisatie').
 *
 * Herberekenen vervangt alleen de automatische regels. Een regel waarvan Jessi de
 * prijs met de hand heeft aangepast (handmatig) houdt zijn prijs; alleen het
 * aantal loopt mee met de order.
 */

export type Prijslijst = { tarieven: Tarief[]; klantTarieven: Tarief[]; formaten: Formaat[]; kosten: Kosten[] };

export async function laadPrijslijst(orgId: string | null): Promise<Prijslijst> {
  const sb = kmsAdmin();
  if (!sb) return { tarieven: [], klantTarieven: [], formaten: [], kosten: [] };
  const [t, f, k, kt] = await Promise.all([
    sb.from('decoratie_tarieven').select('techniek, formaat, vanaf_aantal, stukprijs'),
    sb.from('decoratie_formaten').select('techniek, formaat, omschrijving, max_oppervlakte_cm2, volgorde'),
    sb.from('decoratie_kosten').select('techniek, soort, omschrijving, bedrag, eenheid'),
    orgId ? sb.from('klant_decoratie_tarieven').select('techniek, formaat, vanaf_aantal, stukprijs').eq('organisatie_id', orgId) : Promise.resolve({ data: [] }),
  ]);
  const num = <T extends Record<string, unknown>>(rijen: unknown, velden: string[]): T[] =>
    ((rijen as T[]) ?? []).map((r) => {
      const uit: Record<string, unknown> = { ...r };
      for (const v of velden) uit[v] = uit[v] == null ? null : Number(uit[v]);
      return uit as T;
    });
  return {
    tarieven: num<Tarief>(t.data, ['vanaf_aantal', 'stukprijs']),
    formaten: num<Formaat>(f.data, ['max_oppervlakte_cm2', 'volgorde']),
    kosten: num<Kosten>(k.data, ['bedrag']),
    klantTarieven: num<Tarief>(kt.data, ['vanaf_aantal', 'stukprijs']),
  };
}

function alsProef(p: Drukproef | null): ProefInvoer | null {
  if (!p) return null;
  const o = normaliseerOntwerp(p.ontwerp);
  if (!o) return null;
  const plekken = allePlaatsingen(o).map((x) => ({ logo_url: x.logo_url, label: x.label, breedte_cm: x.breedte_cm ?? null, formaat: x.formaat }));
  return plekken.length ? { techniek: p.techniek || 'bedrukken', plekken } : null;
}

/** Alleen goedgekeurde proeven tellen voor de prijs. */
function proefZoeker(proeven: Drukproef[]) {
  const goed = proeven.filter((p) => p.status === 'goedgekeurd');
  return (r: RegelInvoer) => alsProef(drukproefVoorRegel({ product_id: r.product_id, kleur: r.kleur }, goed));
}

export type Uitkomst = { ok: boolean; regels: number; totaal: number; zonderPrijs: string[]; geenProef: boolean };

type Bestaand = { id: string; decoratie_sleutel: string | null; handmatig: boolean | null };

/** Gemeenschappelijk: bestaande personalisatieregels gelijkzetten met de berekening. */
async function synchroniseer(
  tabel: 'orderregels' | 'offerteregels',
  ouder: { kolom: 'order_id' | 'offerte_id'; id: string },
  berekend: PersonalisatieRegel[],
  nieuweRij: (r: PersonalisatieRegel, i: number) => Record<string, unknown>,
): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { data, error } = await sb.from(tabel).select('id, decoratie_sleutel, handmatig').eq(ouder.kolom, ouder.id).eq('soort', 'personalisatie');
  if (error) return false;
  const bestaand = (data as Bestaand[]) ?? [];
  const handmatig = new Map(bestaand.filter((b) => b.handmatig && b.decoratie_sleutel).map((b) => [b.decoratie_sleutel as string, b.id]));
  const weg = bestaand.filter((b) => !b.handmatig).map((b) => b.id);
  if (weg.length) {
    const { error: e } = await sb.from(tabel).delete().in('id', weg);
    if (e) return false;
  }
  const nieuw: Record<string, unknown>[] = [];
  for (const [i, r] of berekend.entries()) {
    const hid = handmatig.get(r.sleutel);
    if (hid) await sb.from(tabel).update({ aantal: r.aantal }).eq('id', hid);
    else nieuw.push(nieuweRij(r, i));
  }
  if (nieuw.length) {
    const { error: e } = await sb.from(tabel).insert(nieuw);
    if (e) return false;
  }
  return true;
}

/** Personalisatie op een order berekenen en als regels zetten. */
export async function berekenPersonalisatieVoorOrder(orderId: string): Promise<Uitkomst> {
  const leeg: Uitkomst = { ok: false, regels: 0, totaal: 0, zonderPrijs: [], geenProef: false };
  const sb = kmsAdmin(); if (!sb) return leeg;
  const [{ data: o }, { data: r, error: rf }] = await Promise.all([
    sb.from('orders').select('organisatie_id').eq('id', orderId).maybeSingle(),
    sb.from('orderregels').select('product_id, kleur, aantal, soort').eq('order_id', orderId),
  ]);
  if (rf) return leeg;
  const orgId = (o as { organisatie_id: string | null } | null)?.organisatie_id ?? null;
  const regels = ((r as (RegelInvoer & { soort: string | null })[]) ?? []).filter((x) => (x.soort ?? 'kleding') === 'kleding');
  const [prijslijst, proeven] = await Promise.all([laadPrijslijst(orgId), listDrukproevenVoorOrder(orderId)]);
  const uitkomst = berekenPersonalisatie({ regels, proefVoor: proefZoeker(proeven), ...prijslijst });
  const ok = await synchroniseer('orderregels', { kolom: 'order_id', id: orderId }, uitkomst.regels, (x) => ({
    order_id: orderId,
    item_naam: x.omschrijving,
    aantal: x.aantal,
    stukprijs: x.stukprijs,
    soort: 'personalisatie',
    decoratie_sleutel: x.sleutel,
  }));
  if (ok) {
    const { herberekenOrderbedrag } = await import('@/lib/kms/orders');
    await herberekenOrderbedrag(orderId).catch(() => 0);
  }
  return {
    ok,
    regels: uitkomst.regels.length,
    totaal: Math.round(uitkomst.regels.reduce((s, x) => s + x.aantal * x.stukprijs, 0) * 100) / 100,
    zonderPrijs: uitkomst.zonderPrijs,
    geenProef: uitkomst.regels.length === 0 && !proeven.some((p) => p.status === 'goedgekeurd'),
  };
}

/** Zelfde voor een offerte: de goedgekeurde proeven van de klant voor de artikelen op de offerte. */
export async function berekenPersonalisatieVoorOfferte(offerteId: string): Promise<Uitkomst> {
  const leeg: Uitkomst = { ok: false, regels: 0, totaal: 0, zonderPrijs: [], geenProef: false };
  const sb = kmsAdmin(); if (!sb) return leeg;
  const [{ data: o }, { data: r, error: rf }] = await Promise.all([
    sb.from('offertes').select('organisatie_id').eq('id', offerteId).maybeSingle(),
    sb.from('offerteregels').select('product_id, kleur, aantal, soort, positie').eq('offerte_id', offerteId),
  ]);
  if (rf) return leeg;
  const orgId = (o as { organisatie_id: string | null } | null)?.organisatie_id ?? null;
  const alle = (r as (RegelInvoer & { soort: string | null; positie: number | null })[]) ?? [];
  const regels = alle.filter((x) => (x.soort ?? 'kleding') === 'kleding');
  const productIds = [...new Set(regels.map((x) => x.product_id).filter((v): v is string => Boolean(v)))];
  let proeven: Drukproef[] = [];
  if (orgId && productIds.length) {
    const { data } = await sb.from('drukproeven').select('*').eq('organisatie_id', orgId).eq('status', 'goedgekeurd').in('product_id', productIds);
    proeven = (data as Drukproef[]) ?? [];
  }
  const prijslijst = await laadPrijslijst(orgId);
  const uitkomst = berekenPersonalisatie({ regels, proefVoor: proefZoeker(proeven), ...prijslijst });
  const start = alle.reduce((m, x) => Math.max(m, x.positie ?? 0), 0) + 1;
  const ok = await synchroniseer('offerteregels', { kolom: 'offerte_id', id: offerteId }, uitkomst.regels, (x, i) => ({
    offerte_id: offerteId,
    omschrijving: x.omschrijving,
    aantal: x.aantal,
    stukprijs: x.stukprijs,
    korting_pct: 0,
    positie: start + i,
    soort: 'personalisatie',
    decoratie_sleutel: x.sleutel,
  }));
  return {
    ok,
    regels: uitkomst.regels.length,
    totaal: Math.round(uitkomst.regels.reduce((s, x) => s + x.aantal * x.stukprijs, 0) * 100) / 100,
    zonderPrijs: uitkomst.zonderPrijs,
    geenProef: proeven.length === 0,
  };
}

/** Prijs van een personalisatieregel met de hand aanpassen: blijft dan staan bij herberekenen. */
export async function zetPersonalisatiePrijs(tabel: 'orderregels' | 'offerteregels', regelId: string, stukprijs: number): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { data, error } = await sb.from(tabel).update({ stukprijs, handmatig: true }).eq('id', regelId).eq('soort', 'personalisatie').select(tabel === 'orderregels' ? 'order_id' : 'offerte_id');
  if (error || !data?.length) return false;
  if (tabel === 'orderregels') {
    const { herberekenOrderbedrag } = await import('@/lib/kms/orders');
    await herberekenOrderbedrag((data[0] as unknown as { order_id: string }).order_id).catch(() => 0);
  }
  return true;
}
