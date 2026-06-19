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

export type VandaagSignalen = {
  openTaken: number;
  verlopenTaken: number;
  ordersWachtGoedkeuring: number;
  retourenTeBeoordelen: number;
  vervallenFacturen: number;
};

/**
 * Tellingen voor het "Vandaag oppakken"-blok op de dashboard-home.
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS), in dezelfde stijl als
 * getOverzicht(). Alleen server-side gebruiken, achter dashAuthed().
 *
 * - Taken: open taken, plus daarvan de verlopen taken (vervaldatum < vandaag).
 * - Orders: goedkeuring_status === 'wacht' (wacht op goedkeuring).
 * - Retouren: status === 'aangemeld' (nog te beoordelen).
 * - Facturen: verstuurd (niet betaald, niet concept) met verstreken vervaldatum.
 */
export async function getVandaagSignalen(): Promise<VandaagSignalen | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const vandaag = new Date().toISOString().slice(0, 10);

  const [takenR, ordersR, retourenR, facturenR] = await Promise.all([
    sb.from('taken').select('status, vervaldatum').eq('status', 'open'),
    sb.from('orders').select('goedkeuring_status'),
    sb.from('retouren').select('status'),
    sb.from('facturen').select('status, vervaldatum'),
  ]);

  const taken = (takenR.data as { status: string; vervaldatum: string | null }[]) ?? [];
  const orders = (ordersR.data as { goedkeuring_status: string }[]) ?? [];
  const retouren = (retourenR.data as { status: string }[]) ?? [];
  const facturen = (facturenR.data as { status: string; vervaldatum: string | null }[]) ?? [];

  const openTaken = taken.length;
  const verlopenTaken = taken.filter((t) => t.vervaldatum && t.vervaldatum < vandaag).length;
  const ordersWachtGoedkeuring = orders.filter((o) => o.goedkeuring_status === 'wacht').length;
  const retourenTeBeoordelen = retouren.filter((r) => r.status === 'aangemeld').length;
  const vervallenFacturen = facturen.filter(
    (f) => f.status !== 'betaald' && f.status !== 'concept' && f.vervaldatum && f.vervaldatum < vandaag,
  ).length;

  return { openTaken, verlopenTaken, ordersWachtGoedkeuring, retourenTeBeoordelen, vervallenFacturen };
}
