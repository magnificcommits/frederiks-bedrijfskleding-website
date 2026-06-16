import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor de module Rapportages.
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export type OmzetPerKlant = { naam: string; bedrag: number };
export type OmzetPerMerk = { merk: string; bedrag: number };
export type BudgetPerMedewerker = {
  id: string;
  naam: string;
  organisatie_naam: string | null;
  budget: number;
  verbruik: number;
  percentage: number;
};
export type VerstrekkingPerMedewerker = {
  id: string;
  naam: string;
  organisatie_naam: string | null;
  aantal: number;
};
export type Kerncijfers = {
  openOffertes: number;
  openOffertewaarde: number;
  openOrders: number;
  omzetDitJaar: number;
};

export async function omzetPerKlant(): Promise<OmzetPerKlant[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('facturen')
    .select('status, bedrag_incl, organisaties(naam)')
    .eq('status', 'betaald');
  const rows = (data as unknown as { status: string; bedrag_incl: number | null; organisaties: { naam: string } | null }[]) ?? [];
  const perKlant = new Map<string, number>();
  for (const r of rows) {
    const naam = r.organisaties?.naam ?? 'Onbekende klant';
    perKlant.set(naam, (perKlant.get(naam) ?? 0) + (Number(r.bedrag_incl) || 0));
  }
  return [...perKlant.entries()]
    .map(([naam, bedrag]) => ({ naam, bedrag }))
    .sort((a, b) => b.bedrag - a.bedrag);
}

export async function omzetPerMerk(): Promise<OmzetPerMerk[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('orderregels')
    .select('aantal, stukprijs, orders(status), producten(merk)');
  const rows = (data as unknown as {
    aantal: number | null;
    stukprijs: number | null;
    orders: { status: string } | null;
    producten: { merk: string | null } | null;
  }[]) ?? [];
  const perMerk = new Map<string, number>();
  for (const r of rows) {
    if (!r.orders || r.orders.status === 'concept') continue;
    const merk = r.producten?.merk?.trim() || 'Zonder merk';
    const bedrag = (Number(r.aantal) || 0) * (Number(r.stukprijs) || 0);
    perMerk.set(merk, (perMerk.get(merk) ?? 0) + bedrag);
  }
  return [...perMerk.entries()]
    .map(([merk, bedrag]) => ({ merk, bedrag }))
    .sort((a, b) => b.bedrag - a.bedrag);
}

export async function budgetPerMedewerker(): Promise<BudgetPerMedewerker[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const [medewerkersR, ordersR] = await Promise.all([
    sb.from('medewerkers').select('id, naam, budget, organisaties(naam)'),
    sb.from('orders').select('medewerker_id, bedrag'),
  ]);
  const medewerkers = (medewerkersR.data as unknown as {
    id: string;
    naam: string;
    budget: number | null;
    organisaties: { naam: string } | null;
  }[]) ?? [];
  const orders = (ordersR.data as { medewerker_id: string | null; bedrag: number | null }[]) ?? [];

  const verbruikPer = new Map<string, number>();
  for (const o of orders) {
    if (!o.medewerker_id) continue;
    verbruikPer.set(o.medewerker_id, (verbruikPer.get(o.medewerker_id) ?? 0) + (Number(o.bedrag) || 0));
  }

  return medewerkers
    .map((m) => {
      const budget = Number(m.budget) || 0;
      const verbruik = verbruikPer.get(m.id) ?? 0;
      const percentage = budget > 0 ? Math.round((verbruik / budget) * 100) : 0;
      return {
        id: m.id,
        naam: m.naam,
        organisatie_naam: m.organisaties?.naam ?? null,
        budget,
        verbruik,
        percentage,
      };
    })
    .sort((a, b) => b.percentage - a.percentage);
}

export async function verstrekkingenPerMedewerker(): Promise<VerstrekkingPerMedewerker[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const [medewerkersR, ordersR, regelsR] = await Promise.all([
    sb.from('medewerkers').select('id, naam, organisaties(naam)'),
    sb.from('orders').select('id, medewerker_id'),
    sb.from('orderregels').select('order_id, aantal'),
  ]);
  const medewerkers = (medewerkersR.data as unknown as {
    id: string;
    naam: string;
    organisaties: { naam: string } | null;
  }[]) ?? [];
  const orders = (ordersR.data as { id: string; medewerker_id: string | null }[]) ?? [];
  const regels = (regelsR.data as { order_id: string; aantal: number | null }[]) ?? [];

  const orderNaarMedewerker = new Map<string, string>();
  for (const o of orders) {
    if (o.medewerker_id) orderNaarMedewerker.set(o.id, o.medewerker_id);
  }
  const aantalPer = new Map<string, number>();
  for (const r of regels) {
    const medewerkerId = orderNaarMedewerker.get(r.order_id);
    if (!medewerkerId) continue;
    aantalPer.set(medewerkerId, (aantalPer.get(medewerkerId) ?? 0) + (Number(r.aantal) || 0));
  }

  return medewerkers
    .map((m) => ({
      id: m.id,
      naam: m.naam,
      organisatie_naam: m.organisaties?.naam ?? null,
      aantal: aantalPer.get(m.id) ?? 0,
    }))
    .filter((m) => m.aantal > 0)
    .sort((a, b) => b.aantal - a.aantal);
}

export async function kerncijfers(): Promise<Kerncijfers | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const [leadsR, ordersR, facturenR] = await Promise.all([
    sb.from('leads').select('status, offertewaarde'),
    sb.from('orders').select('status'),
    sb.from('facturen').select('status, bedrag_incl, betaaldatum'),
  ]);
  const leads = (leadsR.data as { status: string; offertewaarde: number | null }[]) ?? [];
  const orders = (ordersR.data as { status: string }[]) ?? [];
  const facturen = (facturenR.data as { status: string; bedrag_incl: number | null; betaaldatum: string | null }[]) ?? [];

  const offertes = leads.filter((l) => l.status === 'offerte');
  const openOffertes = offertes.length;
  const openOffertewaarde = offertes.reduce((t, l) => t + (Number(l.offertewaarde) || 0), 0);
  const openOrders = orders.filter((o) => o.status !== 'afgerond').length;
  const jaar = new Date().getFullYear();
  const omzetDitJaar = facturen
    .filter((f) => f.status === 'betaald' && f.betaaldatum && new Date(f.betaaldatum).getFullYear() === jaar)
    .reduce((t, f) => t + (Number(f.bedrag_incl) || 0), 0);

  return { openOffertes, openOffertewaarde, openOrders, omzetDitJaar };
}
