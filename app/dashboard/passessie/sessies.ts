import { kmsAdmin } from '@/lib/kms/adminClient';
import type { Passessie } from '@/lib/kms/passessies';

/**
 * Gegevens voor het overzicht /dashboard/passessie: de lijst eerdere sessies
 * met filters, en wat er over de gekozen klant te zeggen valt. Alleen
 * server-side, achter dashAuthed().
 */

export type SessieRij = Passessie & {
  organisatie_naam: string | null;
  regels: number;
  ordernummer: number | null;
};

export type SessieFilters = {
  klant?: string | null;
  status?: 'open' | 'afgerond' | 'omgezet' | null;
  /** Sessiedatum vanaf (inclusief), ISO-datum. */
  van?: string | null;
  /** Sessiedatum tot (exclusief), ISO-datum. */
  totExclusief?: string | null;
};

/** Eerdere sessies, nieuwste eerst, max. 200. Met het ordernummer als er een order van gemaakt is. */
export async function listSessies(f: SessieFilters = {}): Promise<SessieRij[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  let q = sb
    .from('passessies')
    .select('*, organisaties(naam), passessie_regels(count)')
    .order('datum', { ascending: false })
    .order('created_at', { ascending: false });
  if (f.klant) q = q.eq('organisatie_id', f.klant);
  if (f.status) q = q.eq('status', f.status);
  if (f.van) q = q.gte('datum', f.van);
  if (f.totExclusief) q = q.lt('datum', f.totExclusief);
  const { data } = await q.limit(200);
  const rijen = ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    ...(r as unknown as Passessie),
    organisatie_naam: (r.organisaties as { naam?: string } | null)?.naam ?? null,
    regels: (r.passessie_regels as { count: number }[] | null)?.[0]?.count ?? 0,
    ordernummer: null as number | null,
  }));

  // Ordernummers in één query, los van de sessiequery: zo hangt deze lijst niet
  // af van een embed tussen passessies en orders.
  const orderIds = [...new Set(rijen.map((r) => r.order_id).filter((x): x is string => !!x))];
  if (orderIds.length) {
    const { data: orders } = await sb.from('orders').select('id, ordernummer').in('id', orderIds);
    const nummer = new Map(((orders as { id: string; ordernummer: number }[] | null) ?? []).map((o) => [o.id, o.ordernummer]));
    for (const r of rijen) if (r.order_id) r.ordernummer = nummer.get(r.order_id) ?? null;
  }
  return rijen;
}

export type KlantSamenvatting = {
  id: string;
  naam: string;
  plaats: string | null;
  werknemers: number;
  openSessies: { id: string; datum: string; locatie: string | null; regels: number }[];
};

/** Naam, aantal actieve werknemers en open sessies van één klant, voor de keuzekaarten. */
export async function klantSamenvatting(id: string): Promise<KlantSamenvatting | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const [orgRes, medRes, sesRes] = await Promise.all([
    sb.from('organisaties').select('id, naam, plaats').eq('id', id).maybeSingle(),
    sb.from('medewerkers').select('id', { count: 'exact', head: true }).eq('organisatie_id', id).or('actief.is.null,actief.eq.true'),
    sb
      .from('passessies')
      .select('id, datum, locatie, passessie_regels(count)')
      .eq('organisatie_id', id)
      .eq('status', 'open')
      .order('datum', { ascending: false })
      .limit(5),
  ]);
  const org = orgRes.data as { id: string; naam: string | null; plaats: string | null } | null;
  if (!org) return null;
  return {
    id: org.id,
    naam: org.naam ?? 'Klant',
    plaats: org.plaats,
    werknemers: medRes.count ?? 0,
    openSessies: ((sesRes.data as Record<string, unknown>[] | null) ?? []).map((s) => ({
      id: String(s.id),
      datum: String(s.datum),
      locatie: (s.locatie as string | null) ?? null,
      regels: (s.passessie_regels as { count: number }[] | null)?.[0]?.count ?? 0,
    })),
  };
}
