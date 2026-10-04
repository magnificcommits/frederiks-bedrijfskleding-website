import { kmsAdmin } from '@/lib/kms/adminClient';
import { binnen, plusDagen, type Periode } from '@/lib/kms/analysePeriode';
import { inStukken, nlDatum, num, pagineer } from '@/lib/kms/analyseData';
import { bronKanaal } from '@/lib/kms/leadsModel';
import { bronKanaalLabel, kanaalUitHerkomst, landingsGroep } from '@/lib/leadHerkomst';

/**
 * Leads per kanaal, campagne, landingspagina en ingang, met hoe vaak het een
 * offerte en een order werd. Voor het blok in Analyse > Funnel.
 *
 * - Offerte: er hangt een offerte aan de lead die verstuurd is (of verder), of
 *   de lead staat op offerte/gewonnen. Een concept telt niet: dat zet de site
 *   automatisch klaar.
 * - Order: de lead is gewonnen, de offerte is geaccepteerd, of de klant van de
 *   lead plaatste na binnenkomst een order (niet concept/geannuleerd).
 */

export type HerkomstGroep = {
  naam: string;
  leads: number;
  offerte: number;
  order: number;
  waarde: number;
};

export type LeadHerkomstData = {
  totaal: number;
  metHerkomst: number;
  kanaal: HerkomstGroep[];
  campagne: HerkomstGroep[];
  landing: HerkomstGroep[];
  ingang: HerkomstGroep[];
};

type Rij = {
  id: string;
  created_at: string;
  status: string;
  bron: string | null;
  bron_kanaal?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  gclid?: string | null;
  referrer?: string | null;
  landingspagina?: string | null;
  organisatie_id: string | null;
  offertewaarde: number | null;
};

const MET_HERKOMST = 'id, created_at, status, bron, bron_kanaal, utm_source, utm_medium, utm_campaign, gclid, referrer, landingspagina, organisatie_id, offertewaarde';
const ZONDER = 'id, created_at, status, bron, organisatie_id, offertewaarde';

export async function analyseLeadHerkomst(p: Periode): Promise<LeadHerkomstData> {
  const leeg: LeadHerkomstData = { totaal: 0, metHerkomst: 0, kanaal: [], campagne: [], landing: [], ingang: [] };
  const sb = kmsAdmin();
  if (!sb) return leeg;
  const vanafTs = `${plusDagen(p.van, -1)}T00:00:00Z`;
  const totTs = `${plusDagen(p.tot, 2)}T00:00:00Z`;

  let r = await pagineer<Rij>((a, b) => sb.from('leads').select(MET_HERKOMST).gte('created_at', vanafTs).lt('created_at', totTs).order('created_at').order('id').range(a, b));
  if (r.fout) r = await pagineer<Rij>((a, b) => sb.from('leads').select(ZONDER).gte('created_at', vanafTs).lt('created_at', totTs).order('created_at').order('id').range(a, b));
  const leads = r.rijen.filter((l) => binnen(nlDatum(l.created_at), p));
  if (!leads.length) return leeg;

  const ids = leads.map((l) => l.id);
  const offertes = await inStukken<{ lead_id: string; status: string }>(ids, (s) => sb.from('offertes').select('lead_id, status').in('lead_id', s).limit(5000));
  const orgIds = [...new Set(leads.map((l) => l.organisatie_id).filter((x): x is string => !!x))];
  const orders = orgIds.length
    ? await inStukken<{ organisatie_id: string; created_at: string; status: string }>(orgIds, (s) =>
        sb.from('orders').select('organisatie_id, created_at, status').in('organisatie_id', s).limit(10000),
      )
    : [];

  const offertePer = new Map<string, Set<string>>();
  for (const o of offertes) offertePer.set(o.lead_id, (offertePer.get(o.lead_id) ?? new Set()).add(o.status));
  const ordersPer = new Map<string, string[]>();
  for (const o of orders) {
    if (o.status === 'concept' || o.status === 'geannuleerd') continue;
    ordersPer.set(o.organisatie_id, [...(ordersPer.get(o.organisatie_id) ?? []), o.created_at]);
  }

  const groepen = { kanaal: new Map<string, HerkomstGroep>(), campagne: new Map<string, HerkomstGroep>(), landing: new Map<string, HerkomstGroep>(), ingang: new Map<string, HerkomstGroep>() };
  const tel = (m: Map<string, HerkomstGroep>, naam: string, offerte: boolean, order: boolean, waarde: number) => {
    const g = m.get(naam) ?? { naam, leads: 0, offerte: 0, order: 0, waarde: 0 };
    g.leads += 1;
    if (offerte) g.offerte += 1;
    if (order) { g.order += 1; g.waarde += waarde; }
    m.set(naam, g);
  };

  let metHerkomst = 0;
  for (const l of leads) {
    const st = offertePer.get(l.id) ?? new Set<string>();
    const order =
      l.status === 'geaccordeerd' ||
      st.has('geaccepteerd') ||
      (!!l.organisatie_id && (ordersPer.get(l.organisatie_id) ?? []).some((d) => d >= l.created_at));
    const offerte = order || l.status === 'offerte' || st.has('verstuurd') || st.has('afgewezen');
    const waarde = l.status === 'geaccordeerd' ? num(l.offertewaarde) : 0;
    const gestructureerd = !!(l.bron_kanaal || l.utm_source || l.utm_campaign || l.landingspagina || l.referrer || l.gclid);
    if (gestructureerd) metHerkomst += 1;

    tel(groepen.kanaal, kanaalUitHerkomst(l) ?? bronKanaal(l.bron), offerte, order, waarde);
    tel(groepen.campagne, l.utm_campaign?.trim() || (gestructureerd ? 'Geen campagne' : 'Onbekend (oudere lead)'), offerte, order, waarde);
    tel(groepen.landing, l.landingspagina ? landingsGroep(l.landingspagina) : 'Onbekend', offerte, order, waarde);
    tel(groepen.ingang, l.bron_kanaal ? bronKanaalLabel(l.bron_kanaal) : 'Onbekend (oudere lead)', offerte, order, waarde);
  }

  const sorteer = (m: Map<string, HerkomstGroep>) => [...m.values()].sort((a, b) => b.leads - a.leads || b.order - a.order);
  return {
    totaal: leads.length,
    metHerkomst,
    kanaal: sorteer(groepen.kanaal),
    campagne: sorteer(groepen.campagne),
    landing: sorteer(groepen.landing),
    ingang: sorteer(groepen.ingang),
  };
}
