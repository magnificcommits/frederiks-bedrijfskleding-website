import { getServerSupabase } from './supabaseServer';
import { eisRijen } from '@/lib/dbFout';
import { stuurStatusMail } from '@/lib/kms/notificaties';
import { genereerInkoopregels, annuleerInkoopVoorOrder, volgOrderNaInkoop } from '@/lib/kms/inkoop';

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
  // Alleen een order die echt nog wacht en die RLS deze gebruiker laat wijzigen.
  // Zonder deze voorwaarde kon een tweede klik (of een oud tabblad) een order die al
  // in productie is alsnog annuleren. RLS geeft bij een vreemd order-id 0 rijen: zonder
  // de controle zou het vervolg hieronder (service-role) voor een ander bedrijf lopen.
  const r = eisRijen(
    'portaal.beslisOverOrder',
    await sb
      .from('orders')
      .update({
        goedkeuring_status: besluit,
        goedgekeurd_door: doorNaam,
        status: nieuweStatus,
      })
      .eq('id', orderId)
      .eq('goedkeuring_status', 'wacht')
      .select('id'),
    'Order niet gevonden of al beoordeeld.',
  );
  if (!r.ok) return { ok: false, error: r.fout };
  // Zelfde vervolg als goedkeuren in het KMS: inkoopregels voor wat niet op
  // voorraad is; bij afwijzen eventuele open inkoop intrekken.
  if (besluit === 'goedgekeurd') {
    await genereerInkoopregels(orderId).catch(() => 0);
    await volgOrderNaInkoop(orderId).catch(() => null);
  } else await annuleerInkoopVoorOrder(orderId).catch(() => null);
  // Statusupdate naar de besteller (best effort). Bestellen bij de leverancier
  // gaat via Inkoop, op basis van de inkoopregels hierboven; een directe
  // bestelmail hier zorgde voor dubbel bestellen.
  await stuurStatusMail(orderId).catch(() => {});
  return { ok: true };
}
