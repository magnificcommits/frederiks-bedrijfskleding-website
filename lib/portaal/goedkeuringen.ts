import { getServerSupabase } from './supabaseServer';
import { stuurStatusMail, stuurLeverancierBestelmail } from '@/lib/kms/notificaties';

export type OrderRegel = {
  id: string;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
  stukprijs: number | null;
};

export type WachtendeOrder = {
  id: string;
  ordernummer: string | null;
  status: string | null;
  goedkeuring_status: string | null;
  bedrag: number | null;
  besteldatum: string | null;
  created_at: string | null;
  medewerker_id: string | null;
  medewerker_naam: string | null;
  aangevraagd_door: string | null;
  regels: OrderRegel[];
};

/**
 * Orders van de eigen organisatie die op goedkeuring wachten.
 * RLS borgt dat alleen beheerder en leidinggevende de hele organisatie zien.
 */
export async function getWachtendeOrders(): Promise<WachtendeOrder[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];

  const { data: orders } = await sb
    .from('orders')
    .select('id, ordernummer, status, goedkeuring_status, bedrag, besteldatum, created_at, medewerker_id, aangevraagd_door')
    .eq('goedkeuring_status', 'wacht')
    .order('created_at', { ascending: false });
  const lijst =
    (orders as Omit<WachtendeOrder, 'regels' | 'medewerker_naam'>[]) ?? [];
  if (lijst.length === 0) return [];

  const orderIds = lijst.map((o) => o.id);
  const { data: regels } = await sb
    .from('orderregels')
    .select('id, order_id, item_naam, maat, kleur, aantal, stukprijs')
    .in('order_id', orderIds);
  const regelLijst = (regels as (OrderRegel & { order_id: string })[]) ?? [];

  const medewerkerIds = Array.from(
    new Set(lijst.map((o) => o.medewerker_id).filter((x): x is string => !!x)),
  );
  const naamPerMedewerker = new Map<string, string>();
  if (medewerkerIds.length > 0) {
    const { data: mws } = await sb
      .from('medewerkers')
      .select('id, naam, voornaam, achternaam')
      .in('id', medewerkerIds);
    for (const m of (mws as { id: string; naam: string | null; voornaam: string | null; achternaam: string | null }[]) ?? []) {
      const naam = m.naam ?? [m.voornaam, m.achternaam].filter(Boolean).join(' ');
      if (naam) naamPerMedewerker.set(m.id, naam);
    }
  }

  return lijst.map((o) => ({
    ...o,
    medewerker_naam: o.medewerker_id ? naamPerMedewerker.get(o.medewerker_id) ?? null : null,
    regels: regelLijst.filter((r) => r.order_id === o.id),
  }));
}

export type BehandeldeOrder = {
  id: string;
  ordernummer: string | null;
  goedkeuring_status: string | null;
  goedgekeurd_door: string | null;
  bedrag: number | null;
  besteldatum: string | null;
  created_at: string | null;
  medewerker_id: string | null;
  medewerker_naam: string | null;
};

/**
 * Orders van de eigen organisatie die al behandeld zijn (goedgekeurd of afgewezen).
 * RLS borgt dat alleen beheerder en leidinggevende de hele organisatie zien.
 */
export async function getBehandeldeOrders(): Promise<BehandeldeOrder[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];

  const { data: orders } = await sb
    .from('orders')
    .select('id, ordernummer, goedkeuring_status, goedgekeurd_door, bedrag, besteldatum, created_at, medewerker_id')
    .in('goedkeuring_status', ['goedgekeurd', 'afgewezen'])
    .order('created_at', { ascending: false });
  const lijst =
    (orders as Omit<BehandeldeOrder, 'medewerker_naam'>[]) ?? [];
  if (lijst.length === 0) return [];

  const medewerkerIds = Array.from(
    new Set(lijst.map((o) => o.medewerker_id).filter((x): x is string => !!x)),
  );
  const naamPerMedewerker = new Map<string, string>();
  if (medewerkerIds.length > 0) {
    const { data: mws } = await sb
      .from('medewerkers')
      .select('id, naam, voornaam, achternaam')
      .in('id', medewerkerIds);
    for (const m of (mws as { id: string; naam: string | null; voornaam: string | null; achternaam: string | null }[]) ?? []) {
      const naam = m.naam ?? [m.voornaam, m.achternaam].filter(Boolean).join(' ');
      if (naam) naamPerMedewerker.set(m.id, naam);
    }
  }

  return lijst.map((o) => ({
    ...o,
    medewerker_naam: o.medewerker_id ? naamPerMedewerker.get(o.medewerker_id) ?? null : null,
  }));
}

/**
 * Keurt een order goed of af. Zet goedkeuring_status en goedgekeurd_door.
 * RLS borgt dat alleen beheerder en leidinggevende dit mogen.
 */
export async function beslisOverOrder(
  orderId: string,
  besluit: 'goedgekeurd' | 'afgewezen',
  doorNaam: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const nieuweStatus = besluit === 'goedgekeurd' ? 'nog_bestellen' : 'geannuleerd';
  const { error } = await sb
    .from('orders')
    .update({
      goedkeuring_status: besluit,
      goedgekeurd_door: doorNaam,
      status: nieuweStatus,
    })
    .eq('id', orderId);
  if (error) return { ok: false, error: error.message };
  // Statusupdate naar de besteller; bij goedkeuring ook de bestelmail naar de leverancier(s).
  // Best effort: een mislukte mail laat de beslissing nooit falen.
  await stuurStatusMail(orderId).catch(() => {});
  if (besluit === 'goedgekeurd') await stuurLeverancierBestelmail(orderId).catch(() => {});
  return { ok: true };
}
