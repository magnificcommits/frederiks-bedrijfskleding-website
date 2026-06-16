import { kmsAdmin } from '@/lib/kms/adminClient';

export type RecenteLead = { id: string; name: string; company: string | null; status: string; created_at: string };
export type Overzicht = {
  nieuweLeads: number;
  openOffertewaarde: number;
  openOrders: number;
  teBestellen: number;
  openFacturenBedrag: number;
  omzetMaand: number;
  recenteLeads: RecenteLead[];
};

export async function getOverzicht(): Promise<Overzicht | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const [leadsR, ordersR, inkoopR, facturenR] = await Promise.all([
    sb.from('leads').select('id, name, company, status, offertewaarde, created_at').order('created_at', { ascending: false }),
    sb.from('orders').select('status'),
    sb.from('inkoopregels').select('status'),
    sb.from('facturen').select('status, bedrag_incl, betaaldatum'),
  ]);
  const leads = (leadsR.data as { id: string; name: string; company: string | null; status: string; offertewaarde: number | null; created_at: string }[]) ?? [];
  const orders = (ordersR.data as { status: string }[]) ?? [];
  const inkoop = (inkoopR.data as { status: string }[]) ?? [];
  const facturen = (facturenR.data as { status: string; bedrag_incl: number | null; betaaldatum: string | null }[]) ?? [];

  const nieuweLeads = leads.filter((l) => l.status === 'nieuw').length;
  const openOffertewaarde = leads
    .filter((l) => l.status === 'nieuw' || l.status === 'offerte')
    .reduce((t, l) => t + (Number(l.offertewaarde) || 0), 0);
  const openOrders = orders.filter((o) => o.status !== 'afgerond').length;
  const teBestellen = inkoop.filter((r) => r.status === 'te_bestellen').length;
  const openFacturenBedrag = facturen
    .filter((f) => f.status !== 'betaald' && f.status !== 'concept')
    .reduce((t, f) => t + (Number(f.bedrag_incl) || 0), 0);
  const nu = new Date();
  const omzetMaand = facturen
    .filter((f) => f.status === 'betaald' && f.betaaldatum && new Date(f.betaaldatum).getMonth() === nu.getMonth() && new Date(f.betaaldatum).getFullYear() === nu.getFullYear())
    .reduce((t, f) => t + (Number(f.bedrag_incl) || 0), 0);
  const recenteLeads = leads.slice(0, 6).map((l) => ({ id: l.id, name: l.name, company: l.company, status: l.status, created_at: l.created_at }));

  return { nieuweLeads, openOffertewaarde, openOrders, teBestellen, openFacturenBedrag, omzetMaand, recenteLeads };
}
