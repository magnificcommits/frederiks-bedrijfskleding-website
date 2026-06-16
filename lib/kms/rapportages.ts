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
export type VerbruikPerGroep = { naam: string; bedrag: number; aantalOrders: number };
export type KledingInBezit = {
  id: string;
  naam: string;
  organisatie_naam: string | null;
  aantal: number;
};
export type BudgetmutatieRegel = {
  id: string;
  datum: string | null;
  medewerker_naam: string;
  soort: string;
  bedrag: number;
  saldo_na: number;
  omschrijving: string | null;
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

export async function verbruikPerVestiging(): Promise<VerbruikPerGroep[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const [ordersR, vestigingenR] = await Promise.all([
    sb.from('orders').select('vestiging_id, bedrag'),
    sb.from('vestigingen').select('id, naam'),
  ]);
  const orders = (ordersR.data as { vestiging_id: string | null; bedrag: number | null }[]) ?? [];
  const vestigingen = (vestigingenR.data as { id: string; naam: string }[]) ?? [];
  const naamPer = new Map<string, string>();
  for (const v of vestigingen) naamPer.set(v.id, v.naam);

  const bedragPer = new Map<string, number>();
  const aantalPer = new Map<string, number>();
  for (const o of orders) {
    const naam = o.vestiging_id ? naamPer.get(o.vestiging_id) ?? 'Onbekende vestiging' : 'Zonder vestiging';
    bedragPer.set(naam, (bedragPer.get(naam) ?? 0) + (Number(o.bedrag) || 0));
    aantalPer.set(naam, (aantalPer.get(naam) ?? 0) + 1);
  }
  return [...bedragPer.entries()]
    .map(([naam, bedrag]) => ({ naam, bedrag, aantalOrders: aantalPer.get(naam) ?? 0 }))
    .sort((a, b) => b.bedrag - a.bedrag);
}

export async function verbruikPerAfdeling(): Promise<VerbruikPerGroep[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const [ordersR, afdelingenR] = await Promise.all([
    sb.from('orders').select('afdeling_id, bedrag'),
    sb.from('afdelingen').select('id, naam'),
  ]);
  const orders = (ordersR.data as { afdeling_id: string | null; bedrag: number | null }[]) ?? [];
  const afdelingen = (afdelingenR.data as { id: string; naam: string }[]) ?? [];
  const naamPer = new Map<string, string>();
  for (const a of afdelingen) naamPer.set(a.id, a.naam);

  const bedragPer = new Map<string, number>();
  const aantalPer = new Map<string, number>();
  for (const o of orders) {
    const naam = o.afdeling_id ? naamPer.get(o.afdeling_id) ?? 'Onbekende afdeling' : 'Zonder afdeling';
    bedragPer.set(naam, (bedragPer.get(naam) ?? 0) + (Number(o.bedrag) || 0));
    aantalPer.set(naam, (aantalPer.get(naam) ?? 0) + 1);
  }
  return [...bedragPer.entries()]
    .map(([naam, bedrag]) => ({ naam, bedrag, aantalOrders: aantalPer.get(naam) ?? 0 }))
    .sort((a, b) => b.bedrag - a.bedrag);
}

export async function verbruikPerFunctiegroep(): Promise<VerbruikPerGroep[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const [ordersR, koppelingenR, functiesR] = await Promise.all([
    sb.from('orders').select('medewerker_id, bedrag'),
    sb.from('medewerker_functies').select('medewerker_id, functie_id'),
    sb.from('functies').select('id, naam'),
  ]);
  const orders = (ordersR.data as { medewerker_id: string | null; bedrag: number | null }[]) ?? [];
  const koppelingen = (koppelingenR.data as { medewerker_id: string; functie_id: string }[]) ?? [];
  const functies = (functiesR.data as { id: string; naam: string }[]) ?? [];

  const functieNaam = new Map<string, string>();
  for (const f of functies) functieNaam.set(f.id, f.naam);
  // Een medewerker kan meerdere functies hebben; we koppelen het orderbedrag aan elke functie.
  const functiesPerMedewerker = new Map<string, string[]>();
  for (const k of koppelingen) {
    const lijst = functiesPerMedewerker.get(k.medewerker_id) ?? [];
    lijst.push(k.functie_id);
    functiesPerMedewerker.set(k.medewerker_id, lijst);
  }

  const bedragPer = new Map<string, number>();
  const aantalPer = new Map<string, number>();
  for (const o of orders) {
    const bedrag = Number(o.bedrag) || 0;
    const functieIds = o.medewerker_id ? functiesPerMedewerker.get(o.medewerker_id) ?? [] : [];
    if (functieIds.length === 0) {
      bedragPer.set('Zonder functie', (bedragPer.get('Zonder functie') ?? 0) + bedrag);
      aantalPer.set('Zonder functie', (aantalPer.get('Zonder functie') ?? 0) + 1);
      continue;
    }
    for (const fid of functieIds) {
      const naam = functieNaam.get(fid) ?? 'Onbekende functie';
      bedragPer.set(naam, (bedragPer.get(naam) ?? 0) + bedrag);
      aantalPer.set(naam, (aantalPer.get(naam) ?? 0) + 1);
    }
  }
  return [...bedragPer.entries()]
    .map(([naam, bedrag]) => ({ naam, bedrag, aantalOrders: aantalPer.get(naam) ?? 0 }))
    .sort((a, b) => b.bedrag - a.bedrag);
}

export async function kledingInBezitPerMedewerker(): Promise<KledingInBezit[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const [medewerkersR, ordersR, regelsR] = await Promise.all([
    sb.from('medewerkers').select('id, naam, organisaties(naam)'),
    sb.from('orders').select('id, medewerker_id, status'),
    sb.from('orderregels').select('order_id, aantal'),
  ]);
  const medewerkers = (medewerkersR.data as unknown as {
    id: string;
    naam: string;
    organisaties: { naam: string } | null;
  }[]) ?? [];
  const orders = (ordersR.data as { id: string; medewerker_id: string | null; status: string }[]) ?? [];
  const regels = (regelsR.data as { order_id: string; aantal: number | null }[]) ?? [];

  // Alleen daadwerkelijk geleverde verstrekkingen tellen mee als 'in bezit'.
  const geleverd = new Set(['compleet_geleverd', 'afgerond']);
  const orderNaarMedewerker = new Map<string, string>();
  for (const o of orders) {
    if (o.medewerker_id && geleverd.has(o.status)) orderNaarMedewerker.set(o.id, o.medewerker_id);
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

export async function budgetmutatieHistorie(): Promise<BudgetmutatieRegel[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const [mutatiesR, medewerkersR] = await Promise.all([
    sb
      .from('budget_mutaties')
      .select('id, medewerker_id, soort, bedrag, saldo_na, omschrijving, datum')
      .order('datum', { ascending: false }),
    sb.from('medewerkers').select('id, naam'),
  ]);
  const mutaties = (mutatiesR.data as {
    id: string;
    medewerker_id: string | null;
    soort: string;
    bedrag: number | null;
    saldo_na: number | null;
    omschrijving: string | null;
    datum: string | null;
  }[]) ?? [];
  const medewerkers = (medewerkersR.data as { id: string; naam: string }[]) ?? [];
  const naamPer = new Map<string, string>();
  for (const m of medewerkers) naamPer.set(m.id, m.naam);

  return mutaties.map((m) => ({
    id: m.id,
    datum: m.datum,
    medewerker_naam: m.medewerker_id ? naamPer.get(m.medewerker_id) ?? 'Onbekende medewerker' : 'Onbekende medewerker',
    soort: m.soort,
    bedrag: Number(m.bedrag) || 0,
    saldo_na: Number(m.saldo_na) || 0,
    omschrijving: m.omschrijving,
  }));
}
