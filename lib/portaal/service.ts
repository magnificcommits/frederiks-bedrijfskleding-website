import { getServerSupabase } from './supabaseServer';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { getMijnToegang } from './team';

export type RetourStatus = 'aangemeld' | 'goedgekeurd' | 'afgewezen' | 'verwerkt';
export type KlachtSoort = 'vraag' | 'klacht';
export type KlachtStatus = 'open' | 'in_behandeling' | 'afgehandeld';

export type OrderKeuze = { id: string; ordernummer: string | null; status: string | null };

/** Eén regel die geretourneerd kan worden, met het aantal dat oorspronkelijk besteld is. */
export type OrderregelKeuze = {
  orderregel_id: string;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  besteld_aantal: number;
};

/** Een bestelling die binnen de retourtermijn valt, met de regels die geretourneerd kunnen worden. */
export type RetourneerbareOrder = {
  id: string;
  ordernummer: string | null;
  besteldatum: string;
  regels: OrderregelKeuze[];
};

/** Eén geretourneerd artikel zoals opgeslagen in retouren.regels (JSON). */
export type RetourRegel = {
  orderregel_id: string;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
};

const RETOURTERMIJN_STANDAARD = 30;

/**
 * Leest de ingestelde retourtermijn (dagen) via de service-role client, omdat de tabel
 * `instellingen` RLS aan heeft zonder policies en dus niet via de portaal-client leesbaar is.
 * Valt terug op 30 dagen.
 */
export async function getRetourtermijn(): Promise<number> {
  const admin = kmsAdmin();
  if (!admin) return RETOURTERMIJN_STANDAARD;
  const { data } = await admin
    .from('instellingen')
    .select('waarde')
    .eq('sleutel', 'retourtermijn_dagen')
    .maybeSingle();
  const waarde = (data as { waarde: string | null } | null)?.waarde;
  const n = waarde != null ? Number.parseInt(waarde, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : RETOURTERMIJN_STANDAARD;
}

/**
 * Zet de retourtermijn (dagen) via de service-role client (upsert op sleutel).
 * Alleen server-side gebruiken; in het dashboard achter dashAuthed().
 */
export async function zetRetourtermijn(dagen: number): Promise<boolean> {
  const admin = kmsAdmin();
  if (!admin) return false;
  const veilig = Number.isFinite(dagen) && dagen > 0 ? Math.floor(dagen) : RETOURTERMIJN_STANDAARD;
  const { error } = await admin
    .from('instellingen')
    .upsert({ sleutel: 'retourtermijn_dagen', waarde: String(veilig) }, { onConflict: 'sleutel' });
  return !error;
}

export type Retour = {
  id: string;
  order_id: string | null;
  reden: string | null;
  status: RetourStatus;
  retouradres: string | null;
  instructie: string | null;
  created_at: string;
  ordernummer: string | null;
  regels: RetourRegel[];
};

/** Maakt van de ruwe JSON-kolom `regels` een net getypeerde array. */
function leesRetourRegels(raw: unknown): RetourRegel[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const aantal = Number(o.aantal);
      return {
        orderregel_id: String(o.orderregel_id ?? ''),
        item_naam: String(o.item_naam ?? ''),
        maat: o.maat == null ? null : String(o.maat),
        kleur: o.kleur == null ? null : String(o.kleur),
        aantal: Number.isFinite(aantal) && aantal > 0 ? aantal : 1,
      };
    })
    .filter((r) => r.item_naam !== '');
}

export type Klacht = {
  id: string;
  order_id: string | null;
  soort: KlachtSoort;
  omschrijving: string;
  status: KlachtStatus;
  antwoord: string | null;
  created_at: string;
  ordernummer: string | null;
};

/** Bestellingen van de eigen organisatie voor de keuzelijst bij een retour of klacht. RLS scoopt op org. */
export async function getMijnOrders(): Promise<OrderKeuze[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('orders')
    .select('id, ordernummer, status')
    .order('created_at', { ascending: false });
  return (data as unknown as OrderKeuze[]) ?? [];
}

/** Retouren van de eigen organisatie, nieuwste eerst. RLS scoopt op org. */
export async function getMijnRetouren(): Promise<Retour[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('retouren')
    .select('id, order_id, reden, status, retouradres, instructie, created_at, regels, orders(ordernummer)')
    .order('created_at', { ascending: false });
  const rijen =
    (data as unknown as {
      id: string;
      order_id: string | null;
      reden: string | null;
      status: RetourStatus;
      retouradres: string | null;
      instructie: string | null;
      created_at: string;
      regels: unknown;
      orders: { ordernummer: string | null } | null;
    }[]) ?? [];
  return rijen.map((r) => ({
    id: r.id,
    order_id: r.order_id,
    reden: r.reden,
    status: r.status,
    retouradres: r.retouradres,
    instructie: r.instructie,
    created_at: r.created_at,
    ordernummer: r.orders?.ordernummer ?? null,
    regels: leesRetourRegels(r.regels),
  }));
}

/**
 * Bestellingen van de eigen organisatie die nog binnen de retourtermijn vallen
 * (besteldatum + termijn-dagen >= vandaag), met per order de regels die geretourneerd
 * kunnen worden. RLS scoopt op org. Nieuwste besteldatum eerst.
 */
export async function getMijnRetourneerbareOrders(termijnDagen: number): Promise<RetourneerbareOrder[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const grens = new Date();
  grens.setHours(0, 0, 0, 0);
  // Orders die op of na (vandaag - termijn) zijn besteld vallen nog binnen de termijn.
  grens.setDate(grens.getDate() - termijnDagen);
  const { data } = await sb
    .from('orders')
    .select('id, ordernummer, besteldatum, orderregels(id, item_naam, maat, kleur, aantal)')
    .gte('besteldatum', grens.toISOString())
    .order('besteldatum', { ascending: false });
  const rijen =
    (data as unknown as {
      id: string;
      ordernummer: string | null;
      besteldatum: string;
      orderregels: { id: string; item_naam: string | null; maat: string | null; kleur: string | null; aantal: number | null }[] | null;
    }[]) ?? [];
  return rijen
    .map((o) => ({
      id: o.id,
      ordernummer: o.ordernummer != null ? String(o.ordernummer) : null,
      besteldatum: o.besteldatum,
      regels: (o.orderregels ?? []).map((r) => ({
        orderregel_id: r.id,
        item_naam: r.item_naam ?? 'Artikel',
        maat: r.maat,
        kleur: r.kleur,
        besteld_aantal: r.aantal != null && r.aantal > 0 ? r.aantal : 1,
      })),
    }))
    .filter((o) => o.regels.length > 0);
}

/**
 * Meldt een retour aan binnen de eigen organisatie. Zet organisatie_id en medewerker_id op de eigen waarden.
 * Slaat de geselecteerde regels op in de JSON-kolom `regels`. Weigert orders die buiten de
 * retourtermijn vallen en retouren zonder geselecteerde regels.
 */
export async function meldRetour(input: {
  orderId: string | null;
  reden: string;
  regels: RetourRegel[];
}): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const toegang = await getMijnToegang();
  if (!toegang.organisatieId) return { ok: false, error: 'Geen organisatie gekoppeld' };

  if (!input.orderId) return { ok: false, error: 'Kies een bestelling om te retourneren' };
  if (input.regels.length === 0) return { ok: false, error: 'Kies minstens één artikel om te retourneren' };

  // Controleer dat de order binnen de termijn valt en hoor bij de eigen organisatie (RLS),
  // en valideer de geselecteerde regels tegen de werkelijke orderregels.
  const termijn = await getRetourtermijn();
  const orders = await getMijnRetourneerbareOrders(termijn);
  const order = orders.find((o) => o.id === input.orderId);
  if (!order) return { ok: false, error: 'Deze bestelling valt buiten de retourtermijn of is niet van jou' };

  const perRegel = new Map(order.regels.map((r) => [r.orderregel_id, r]));
  const schoneRegels: RetourRegel[] = [];
  for (const r of input.regels) {
    const bron = perRegel.get(r.orderregel_id);
    if (!bron) continue;
    const aantal = Math.min(Math.max(1, Math.floor(r.aantal)), bron.besteld_aantal);
    schoneRegels.push({
      orderregel_id: bron.orderregel_id,
      item_naam: bron.item_naam,
      maat: bron.maat,
      kleur: bron.kleur,
      aantal,
    });
  }
  if (schoneRegels.length === 0) return { ok: false, error: 'Kies minstens één geldig artikel om te retourneren' };

  const { error } = await sb.from('retouren').insert({
    organisatie_id: toegang.organisatieId,
    medewerker_id: toegang.medewerkerId,
    order_id: input.orderId,
    reden: input.reden,
    status: 'aangemeld',
    regels: schoneRegels,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Klachten en vragen van de eigen organisatie, nieuwste eerst. RLS scoopt op org. */
export async function getMijnKlachten(): Promise<Klacht[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('klachten')
    .select('id, order_id, soort, omschrijving, status, antwoord, created_at, orders(ordernummer)')
    .order('created_at', { ascending: false });
  const rijen =
    (data as unknown as {
      id: string;
      order_id: string | null;
      soort: KlachtSoort;
      omschrijving: string;
      status: KlachtStatus;
      antwoord: string | null;
      created_at: string;
      orders: { ordernummer: string | null } | null;
    }[]) ?? [];
  return rijen.map((k) => ({
    id: k.id,
    order_id: k.order_id,
    soort: k.soort,
    omschrijving: k.omschrijving,
    status: k.status,
    antwoord: k.antwoord,
    created_at: k.created_at,
    ordernummer: k.orders?.ordernummer ?? null,
  }));
}

/** Meldt een vraag of klacht aan binnen de eigen organisatie. Zet organisatie_id en medewerker_id op de eigen waarden. */
export async function meldKlacht(input: {
  orderId: string | null;
  soort: KlachtSoort;
  omschrijving: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const toegang = await getMijnToegang();
  if (!toegang.organisatieId) return { ok: false, error: 'Geen organisatie gekoppeld' };
  const { error } = await sb.from('klachten').insert({
    organisatie_id: toegang.organisatieId,
    medewerker_id: toegang.medewerkerId,
    order_id: input.orderId,
    soort: input.soort,
    omschrijving: input.omschrijving,
    status: 'open',
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
