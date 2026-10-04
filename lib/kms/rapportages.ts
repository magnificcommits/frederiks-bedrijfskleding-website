import { kmsAdmin } from '@/lib/kms/adminClient';
import {
  NIET_VERKOCHT,
  inStukken,
  laadFacturen,
  laadKlanten,
  laadMedewerkers,
  laadOrders,
  laadRegels,
  nlDatum,
  pagineer,
  verrijkRegels,
  type Klant,
  type Medewerker,
  type Order,
  type VerrijkteRegel,
} from '@/lib/kms/analyseData';
import {
  binnen,
  datumKort,
  dagenTussen,
  leesPeriode,
  plusDagen,
  urlMet,
  type Periode,
  type PeriodeKeuze,
} from '@/lib/kms/analysePeriode';

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

/**
 * @deprecated Gebruik het rapport 'omzet-merk' (RAPPORTEN). Blijft bestaan voor
 * oude aanroepen; valt nu ook terug op het merk via de variant, en noemt een
 * regel zonder artikel "Vrije regel" in plaats van "Zonder merk".
 */
export async function omzetPerMerk(): Promise<OmzetPerMerk[]> {
  const orders = (await laadOrders()).filter((o) => o.status !== 'concept');
  const regels = await verrijkRegels(await laadRegels(orders.map((o) => o.id)));
  const perMerk = new Map<string, number>();
  for (const r of regels) perMerk.set(r.merk, (perMerk.get(r.merk) ?? 0) + r.omzet);
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

/* ==================================================================== */
/* Rapportenbibliotheek                                                  */
/* ==================================================================== */
/*
 * Vaste overzichten om te exporteren en te delen. Elk rapport levert dezelfde
 * vorm: kolommen, rijen, totalen en eventueel een samenvatting. De pagina,
 * de printversie en de CSV/Excel-export lezen allemaal deze ene definitie,
 * zodat wat je ziet en wat je downloadt altijd hetzelfde is.
 *
 * Definities gelijk aan de startpagina en Analyse (zie lib/kms/analyseData.ts).
 */

export type KolomSoort = 'tekst' | 'euro' | 'getal' | 'pct' | 'datum';
export type RapportKolom = { kop: string; soort: KolomSoort; som?: boolean; smal?: boolean };
export type Cel = string | number | null;
export type RapportRij = { cellen: Cel[]; href?: string | null; subtotaal?: boolean };
export type RapportSamenvatting = { label: string; waarde: number; soort: KolomSoort; uitleg?: string };
export type RapportTabel = {
  kolommen: RapportKolom[];
  rijen: RapportRij[];
  /** Totaalregel; null als optellen geen zin heeft. Wordt berekend uit kolommen met som. */
  totalen: Cel[] | null;
  samenvatting?: RapportSamenvatting[];
  toelichting?: string;
  leeg: { titel: string; tekst: string };
};

export type RapportFilters = { periode: Periode; klantId: string | null };

export const RAPPORT_GROEPEN = ['Verkoop', 'Boekhouding', 'Klanten en budget', 'Inkoop en voorraad'] as const;
export type RapportGroep = (typeof RAPPORT_GROEPEN)[number];

export type RapportDef = {
  key: string;
  titel: string;
  beschrijving: string;
  groep: RapportGroep;
  /** Gebruikt het rapport een periode? Zo nee: peildatum vandaag. */
  periode: boolean;
  /** Standaardperiode als er geen in de URL staat. */
  standaardPeriode?: PeriodeKeuze;
  /** Kan het rapport op één klant gefilterd worden? */
  klant: boolean;
  /** Oude export-sleutels die naar dit rapport wijzen. */
  aliassen?: string[];
  bouw: (f: RapportFilters) => Promise<RapportTabel>;
};

const klantNaam = (klanten: Map<string, Klant>, id: string | null | undefined) => (id && klanten.get(id)?.naam) || 'Onbekende klant';

function metTotalen(t: Omit<RapportTabel, 'totalen'> & { totalen?: Cel[] | null }): RapportTabel {
  if (t.totalen !== undefined) return t as RapportTabel;
  if (!t.kolommen.some((k) => k.som)) return { ...t, totalen: null };
  const basis = t.rijen.filter((r) => !r.subtotaal);
  const totalen: Cel[] = t.kolommen.map((k, i) =>
    k.som ? basis.reduce((s, r) => s + (typeof r.cellen[i] === 'number' ? (r.cellen[i] as number) : 0), 0) : i === 0 ? 'Totaal' : null,
  );
  return { ...t, totalen };
}

/** Orders die als verkocht tellen, binnen periode en eventueel klant. */
async function verkochteOrders(f: RapportFilters): Promise<Order[]> {
  const orders = await laadOrders();
  return orders.filter((o) => !NIET_VERKOCHT.has(o.status) && binnen(o.datum, f.periode) && (!f.klantId || o.organisatie_id === f.klantId));
}

async function omzetPerGroep(f: RapportFilters, groep: (r: VerrijkteRegel) => string, kop: string): Promise<RapportTabel> {
  const orders = await verkochteOrders(f);
  const regels = await verrijkRegels(await laadRegels(orders.map((o) => o.id)));
  const per = new Map<string, { stuks: number; omzet: number; marge: number; margeOmzet: number; regels: number }>();
  for (const r of regels) {
    const k = groep(r);
    const g = per.get(k) ?? { stuks: 0, omzet: 0, marge: 0, margeOmzet: 0, regels: 0 };
    g.stuks += r.stuks;
    g.omzet += r.omzet;
    g.regels += 1;
    if (r.inkoop !== null) {
      g.marge += (Number(r.stukprijs) - r.inkoop) * r.stuks;
      g.margeOmzet += r.omzet;
    }
    per.set(k, g);
  }
  const rijen = [...per.entries()]
    .sort((a, b) => b[1].omzet - a[1].omzet)
    .map(([naam, g]) => ({
      cellen: [naam, g.regels, g.stuks, g.omzet, g.margeOmzet > 0 ? g.marge : null, g.margeOmzet > 0 ? g.marge / g.margeOmzet : null] as Cel[],
    }));
  const vrij = regels.filter((r) => r.vrij).length;
  return metTotalen({
    kolommen: [
      { kop, soort: 'tekst' },
      { kop: 'Regels', soort: 'getal', som: true, smal: true },
      { kop: 'Stuks', soort: 'getal', som: true },
      { kop: 'Omzet excl. btw', soort: 'euro', som: true },
      { kop: 'Marge', soort: 'euro', som: true },
      { kop: 'Marge %', soort: 'pct' },
    ],
    rijen,
    toelichting:
      'Uit de orderregels van geplaatste orders (geen concept, offerte of geannuleerd), op besteldatum. ' +
      'Een regel zonder artikel krijgt het merk van zijn variant; zonder beide heet hij "Vrije regel". ' +
      `Marge alleen waar de inkoopprijs bekend is.${vrij ? ` ${vrij} van de ${regels.length} regels zijn vrije regels.` : ''}`,
    leeg: { titel: 'Geen verkochte artikelen in deze periode', tekst: 'Kies een langere periode of een andere klant.' },
  });
}

/** Orderregels per order, met artikelnaam en stuks, voor "wat heeft wie gekregen". */
async function regelsPerOrder(orderIds: string[]): Promise<Map<string, VerrijkteRegel[]>> {
  const regels = await verrijkRegels(await laadRegels(orderIds));
  const per = new Map<string, VerrijkteRegel[]>();
  for (const r of regels) {
    const l = per.get(r.order_id) ?? [];
    l.push(r);
    per.set(r.order_id, l);
  }
  return per;
}

function artikelTekst(regels: VerrijkteRegel[]): string {
  const per = new Map<string, number>();
  for (const r of regels) {
    const k = `${r.productNaam}${r.maat ? ` (${r.maat})` : ''}`;
    per.set(k, (per.get(k) ?? 0) + r.stuks);
  }
  return [...per.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n}× ${k}`).join(', ');
}

/** Laatste saldo per medewerker uit de budgetmutaties. */
async function saldoPerMedewerker(): Promise<Map<string, number>> {
  const sb = kmsAdmin();
  const uit = new Map<string, number>();
  if (!sb) return uit;
  const { rijen } = await pagineer<{ medewerker_id: string | null; saldo_na: number | null }>((a, b) =>
    sb.from('budget_mutaties').select('medewerker_id, saldo_na').order('datum', { ascending: false }).order('created_at', { ascending: false }).order('id').range(a, b),
  );
  for (const r of rijen) if (r.medewerker_id && !uit.has(r.medewerker_id)) uit.set(r.medewerker_id, Number(r.saldo_na) || 0);
  return uit;
}

type OfferteMetRegels = {
  id: string; offertenummer: number | null; organisatie_id: string | null; status: string; created_at: string; geldig_tot: string | null;
  offerteregels?: { aantal: number | null; stukprijs: number | null; korting_pct: number | null }[] | null;
};

export const RAPPORTEN: RapportDef[] = [
  /* ---------------- Verkoop ---------------- */
  {
    key: 'omzet-klant',
    titel: 'Omzet per klant',
    beschrijving: 'Gefactureerd per klant, excl. en incl. btw, met aandeel in de totale omzet.',
    groep: 'Verkoop',
    periode: true,
    klant: false,
    bouw: async (f) => {
      const [facturen, klanten] = await Promise.all([laadFacturen(), laadKlanten()]);
      const per = new Map<string, { id: string | null; n: number; excl: number; btw: number; incl: number }>();
      for (const fa of facturen) {
        if (!binnen(fa.factuurdatum, f.periode)) continue;
        const k = fa.organisatie_id ?? 'onbekend';
        const r = per.get(k) ?? { id: fa.organisatie_id, n: 0, excl: 0, btw: 0, incl: 0 };
        r.n += 1;
        r.excl += Number(fa.bedrag_excl) || 0;
        r.btw += Number(fa.btw_bedrag) || 0;
        r.incl += Number(fa.bedrag_incl) || 0;
        per.set(k, r);
      }
      const totaal = [...per.values()].reduce((t, r) => t + r.excl, 0);
      return metTotalen({
        kolommen: [
          { kop: 'Klant', soort: 'tekst' },
          { kop: 'Facturen', soort: 'getal', som: true, smal: true },
          { kop: 'Excl. btw', soort: 'euro', som: true },
          { kop: 'Btw', soort: 'euro', som: true },
          { kop: 'Incl. btw', soort: 'euro', som: true },
          { kop: 'Aandeel', soort: 'pct' },
        ],
        rijen: [...per.values()]
          .sort((a, b) => b.excl - a.excl)
          .map((r) => ({
            cellen: [klantNaam(klanten, r.id), r.n, r.excl, r.btw, r.incl, totaal ? r.excl / totaal : null],
            href: r.id ? urlMet(`/dashboard/rapportages/klant/${r.id}`, { jaar: f.periode.tot.slice(0, 4) }) : null,
          })),
        toelichting: `Alle facturen behalve concepten, op factuurdatum. Dezelfde omzet als op de startpagina en in Analyse. Klik op een klant voor het rapport per klant.`,
        leeg: { titel: 'Geen facturen in deze periode', tekst: 'Kies een langere periode. Conceptfacturen tellen niet mee.' },
      });
    },
  },
  {
    key: 'omzet-merk',
    titel: 'Omzet per merk',
    beschrijving: 'Verkochte stuks, omzet en marge per merk. Handig voor gesprekken met leveranciers.',
    groep: 'Verkoop',
    periode: true,
    klant: true,
    bouw: (f) => omzetPerGroep(f, (r) => r.merk, 'Merk'),
  },
  {
    key: 'omzet-categorie',
    titel: 'Omzet per productcategorie',
    beschrijving: 'Stuks, omzet en marge per categorie: broeken, jassen, schoenen en de rest.',
    groep: 'Verkoop',
    periode: true,
    klant: true,
    bouw: (f) => omzetPerGroep(f, (r) => r.categorie, 'Categorie'),
  },
  {
    key: 'offertes',
    titel: 'Offertes en conversie',
    beschrijving: 'Alle offertes in de periode met status en waarde, en hoeveel er akkoord gingen.',
    groep: 'Verkoop',
    periode: true,
    klant: true,
    bouw: async (f) => {
      const sb = kmsAdmin();
      const klanten = await laadKlanten();
      if (!sb) return metTotalen({ kolommen: [], rijen: [], leeg: { titel: 'Geen database', tekst: '' } });
      const vanTs = `${plusDagen(f.periode.van, -1)}T00:00:00Z`;
      const totTs = `${plusDagen(f.periode.tot, 1)}T23:59:59Z`;
      const basis = (sel: string) => (a: number, b: number) => {
        let q = sb.from('offertes').select(sel).gte('created_at', vanTs).lte('created_at', totTs).order('created_at').order('id').range(a, b);
        if (f.klantId) q = q.eq('organisatie_id', f.klantId);
        return q;
      };
      let res = await pagineer<OfferteMetRegels>(basis('id, offertenummer, organisatie_id, status, created_at, geldig_tot, offerteregels(aantal, stukprijs, korting_pct)'));
      if (res.fout) res = await pagineer<OfferteMetRegels>(basis('id, offertenummer, organisatie_id, status, created_at, geldig_tot'));
      const lijst = res.rijen.filter((o) => binnen(nlDatum(o.created_at), f.periode));
      const waarde = (o: OfferteMetRegels) =>
        (o.offerteregels ?? []).reduce((t, r) => t + (Number(r.aantal) || 0) * (Number(r.stukprijs) || 0) * (1 - (Number(r.korting_pct) || 0) / 100), 0);
      const tel = (s: string) => lijst.filter((o) => o.status === s).length;
      const akkoord = tel('geaccepteerd');
      const afgewezen = tel('afgewezen');
      return metTotalen({
        kolommen: [
          { kop: 'Offerte', soort: 'tekst', smal: true },
          { kop: 'Datum', soort: 'datum' },
          { kop: 'Klant', soort: 'tekst' },
          { kop: 'Status', soort: 'tekst' },
          { kop: 'Geldig tot', soort: 'datum' },
          { kop: 'Waarde excl. btw', soort: 'euro', som: true },
        ],
        rijen: lijst.map((o) => ({
          cellen: [`#${o.offertenummer ?? '–'}`, nlDatum(o.created_at), klantNaam(klanten, o.organisatie_id), o.status, o.geldig_tot, waarde(o)],
          href: `/dashboard/offertes/${o.id}`,
        })),
        samenvatting: [
          { label: 'Aangemaakt', waarde: lijst.length, soort: 'getal' },
          { label: 'Verstuurd of verder', waarde: lijst.filter((o) => o.status !== 'concept').length, soort: 'getal' },
          { label: 'Geaccepteerd', waarde: akkoord, soort: 'getal' },
          { label: 'Afgewezen', waarde: afgewezen, soort: 'getal' },
          { label: 'Conversie', waarde: akkoord + afgewezen ? akkoord / (akkoord + afgewezen) : NaN, soort: 'pct', uitleg: 'geaccepteerd ÷ (geaccepteerd + afgewezen)' },
          { label: 'Waarde geaccepteerd', waarde: lijst.filter((o) => o.status === 'geaccepteerd').reduce((t, o) => t + waarde(o), 0), soort: 'euro' },
        ],
        toelichting: 'Offertes op aanmaakdatum. Waarde = aantal × stukprijs × (1 − korting), excl. btw.',
        leeg: { titel: 'Geen offertes in deze periode', tekst: 'Kies een langere periode of een andere klant.' },
      });
    },
  },

  /* ---------------- Boekhouding ---------------- */
  {
    key: 'btw',
    titel: 'Btw-overzicht',
    beschrijving: 'Omzet en btw per tarief over een aangifteperiode, met alle facturen eronder. Voor de boekhouder.',
    groep: 'Boekhouding',
    periode: true,
    standaardPeriode: 'vorig-kwartaal',
    klant: false,
    bouw: async (f) => {
      const sb = kmsAdmin();
      const [facturen, klanten] = await Promise.all([laadFacturen(), laadKlanten()]);
      const lijst = facturen.filter((fa) => binnen(fa.factuurdatum, f.periode)).sort((a, b) => (a.factuurdatum ?? '').localeCompare(b.factuurdatum ?? '') || (a.factuurnummer ?? '').localeCompare(b.factuurnummer ?? ''));
      type FR = { factuur_id: string; btw_pct: number | null; bedrag: number | null; aantal: number | null; stukprijs: number | null; korting_pct: number | null };
      const regels = sb
        ? await inStukken<FR>(lijst.map((fa) => fa.id), (s) => sb.from('factuurregels').select('factuur_id, btw_pct, bedrag, aantal, stukprijs, korting_pct').in('factuur_id', s).limit(1000))
        : [];
      const metRegels = new Set(regels.map((r) => r.factuur_id));
      const perTarief = new Map<string, number>();
      for (const r of regels) {
        const grondslag = r.bedrag !== null && r.bedrag !== undefined
          ? Number(r.bedrag) || 0
          : (Number(r.aantal) || 0) * (Number(r.stukprijs) || 0) * (1 - (Number(r.korting_pct) || 0) / 100);
        const k = String(Number(r.btw_pct ?? 21));
        perTarief.set(k, (perTarief.get(k) ?? 0) + grondslag);
      }
      const zonderRegels = lijst.filter((fa) => !metRegels.has(fa.id));
      const samenvatting: RapportSamenvatting[] = [...perTarief.entries()]
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .flatMap(([pctTarief, grondslag]) => [
          { label: `Omzet ${pctTarief}%`, waarde: grondslag, soort: 'euro' as const },
          { label: `Btw ${pctTarief}%`, waarde: (grondslag * Number(pctTarief)) / 100, soort: 'euro' as const },
        ]);
      if (zonderRegels.length) {
        samenvatting.push({
          label: 'Zonder regels',
          waarde: zonderRegels.reduce((t, fa) => t + (Number(fa.bedrag_excl) || 0), 0),
          soort: 'euro',
          uitleg: `${zonderRegels.length} ${zonderRegels.length === 1 ? 'factuur' : 'facturen'} zonder factuurregels; tarief niet bekend, btw volgens factuur`,
        });
      }
      samenvatting.push({ label: 'Btw volgens facturen', waarde: lijst.reduce((t, fa) => t + (Number(fa.btw_bedrag) || 0), 0), soort: 'euro', uitleg: 'Dit bedrag staat op de facturen zelf' });
      return metTotalen({
        kolommen: [
          { kop: 'Factuur', soort: 'tekst', smal: true },
          { kop: 'Datum', soort: 'datum' },
          { kop: 'Klant', soort: 'tekst' },
          { kop: 'Status', soort: 'tekst' },
          { kop: 'Excl. btw', soort: 'euro', som: true },
          { kop: 'Btw', soort: 'euro', som: true },
          { kop: 'Incl. btw', soort: 'euro', som: true },
        ],
        rijen: lijst.map((fa) => ({
          cellen: [fa.factuurnummer ?? '–', fa.factuurdatum, klantNaam(klanten, fa.organisatie_id), fa.status, Number(fa.bedrag_excl) || 0, Number(fa.btw_bedrag) || 0, Number(fa.bedrag_incl) || 0],
          href: `/dashboard/facturen/${fa.id}`,
        })),
        samenvatting,
        toelichting:
          'Alle facturen behalve concepten, op factuurdatum (factuurstelsel). Btw per tarief is berekend uit de factuurregels; ' +
          'kleine verschillen met het bedrag op de facturen komen door afronding per factuur. Controleer met je boekhouder voor je aangifte doet.',
        leeg: { titel: 'Geen facturen in deze periode', tekst: 'Kies het kwartaal van je aangifte. Conceptfacturen tellen niet mee.' },
      });
    },
  },
  {
    key: 'debiteuren',
    titel: 'Openstaande facturen',
    beschrijving: 'Wie moet nog betalen en hoe lang al: 0–30, 31–60 en meer dan 60 dagen.',
    groep: 'Boekhouding',
    periode: false,
    klant: true,
    bouw: async (f) => {
      const [facturen, klanten] = await Promise.all([laadFacturen(), laadKlanten()]);
      const vandaag = f.periode.vandaag;
      const open = facturen
        .filter((fa) => fa.status !== 'betaald' && (!f.klantId || fa.organisatie_id === f.klantId))
        .map((fa) => ({ fa, dagen: fa.factuurdatum ? Math.max(0, dagenTussen(fa.factuurdatum, vandaag)) : 0, over: fa.vervaldatum ? dagenTussen(fa.vervaldatum, vandaag) : null }))
        .sort((a, b) => b.dagen - a.dagen);
      const emmer = (min: number, max: number) => open.filter((o) => o.dagen >= min && o.dagen <= max).reduce((t, o) => t + (Number(o.fa.bedrag_incl) || 0), 0);
      return metTotalen({
        kolommen: [
          { kop: 'Factuur', soort: 'tekst', smal: true },
          { kop: 'Klant', soort: 'tekst' },
          { kop: 'Factuurdatum', soort: 'datum' },
          { kop: 'Vervaldatum', soort: 'datum' },
          { kop: 'Dagen open', soort: 'getal' },
          { kop: 'Dagen over termijn', soort: 'getal' },
          { kop: 'Openstaand incl. btw', soort: 'euro', som: true },
        ],
        rijen: open.map(({ fa, dagen, over }) => ({
          cellen: [fa.factuurnummer ?? '–', klantNaam(klanten, fa.organisatie_id), fa.factuurdatum, fa.vervaldatum, dagen, over !== null && over > 0 ? over : null, Number(fa.bedrag_incl) || 0],
          href: `/dashboard/facturen/${fa.id}`,
        })),
        samenvatting: [
          { label: '0–30 dagen', waarde: emmer(0, 30), soort: 'euro' },
          { label: '31–60 dagen', waarde: emmer(31, 60), soort: 'euro' },
          { label: 'Meer dan 60 dagen', waarde: emmer(61, 100_000), soort: 'euro' },
          { label: 'Waarvan over de termijn', waarde: open.filter((o) => (o.over ?? 0) > 0).reduce((t, o) => t + (Number(o.fa.bedrag_incl) || 0), 0), soort: 'euro', uitleg: 'vervaldatum is verstreken' },
        ],
        toelichting: `Peildatum ${vandaag}. Verstuurde facturen zonder betaaldatum; de ouderdom telt vanaf de factuurdatum.`,
        leeg: { titel: 'Alles is betaald', tekst: 'Er staan geen verstuurde facturen meer open.' },
      });
    },
  },

  /* ---------------- Klanten en budget ---------------- */
  {
    key: 'budget-medewerker',
    titel: 'Budgetverbruik per klant en medewerker',
    beschrijving: 'Budget, verbruik in de periode en het saldo per medewerker, met een subtotaal per klant.',
    groep: 'Klanten en budget',
    periode: true,
    standaardPeriode: 'jaar',
    klant: true,
    aliassen: ['budget'],
    bouw: async (f) => {
      const [medewerkers, orders, klanten, saldo] = await Promise.all([laadMedewerkers(), laadOrders(), laadKlanten(), saldoPerMedewerker()]);
      const verbruik = new Map<string, number>();
      for (const o of orders) {
        if (!o.medewerker_id || o.status === 'concept' || !binnen(o.datum, f.periode)) continue;
        verbruik.set(o.medewerker_id, (verbruik.get(o.medewerker_id) ?? 0) + (Number(o.bedrag) || 0));
      }
      const lijst = medewerkers.filter((m) => (!f.klantId || m.organisatie_id === f.klantId) && ((Number(m.budget) || 0) > 0 || verbruik.has(m.id)));
      const perKlant = new Map<string, Medewerker[]>();
      for (const m of lijst) {
        const k = m.organisatie_id ?? 'onbekend';
        perKlant.set(k, [...(perKlant.get(k) ?? []), m]);
      }
      const rijen: RapportRij[] = [];
      const klantIds = [...perKlant.keys()].sort((a, b) => klantNaam(klanten, a).localeCompare(klantNaam(klanten, b), 'nl'));
      for (const k of klantIds) {
        const ms = perKlant.get(k)!;
        let b = 0, v = 0, s = 0;
        for (const m of ms) {
          const budget = Number(m.budget) || 0;
          const gebruikt = verbruik.get(m.id) ?? 0;
          b += budget; v += gebruikt; s += saldo.get(m.id) ?? 0;
          rijen.push({ cellen: [klantNaam(klanten, m.organisatie_id), m.naam, budget || null, gebruikt, budget > 0 ? gebruikt / budget : null, saldo.has(m.id) ? saldo.get(m.id)! : null] });
        }
        if (klantIds.length > 1) rijen.push({ cellen: [klantNaam(klanten, k), `Subtotaal (${ms.length})`, b || null, v, b > 0 ? v / b : null, s || null], subtotaal: true, href: urlMet(`/dashboard/rapportages/klant/${k}`, { jaar: f.periode.tot.slice(0, 4) }) });
      }
      return metTotalen({
        kolommen: [
          { kop: 'Klant', soort: 'tekst' },
          { kop: 'Medewerker', soort: 'tekst' },
          { kop: 'Budget', soort: 'euro', som: true },
          { kop: 'Verbruikt', soort: 'euro', som: true },
          { kop: 'Verbruik %', soort: 'pct' },
          { kop: 'Saldo', soort: 'euro', som: true },
        ],
        rijen,
        toelichting: 'Verbruikt = orderbedragen van de medewerker in de periode (geen concepten). Saldo = het saldo na de laatste budgetmutatie, als die er is.',
        leeg: { titel: 'Geen medewerkers met budget of verbruik', tekst: 'Geef medewerkers een budget bij de klant, of kies een andere periode.' },
      });
    },
  },
  {
    key: 'verstrekkingen',
    titel: 'Verstrekkingen per medewerker',
    beschrijving: 'Wat heeft iedere medewerker gekregen: stuks, waarde en welke artikelen.',
    groep: 'Klanten en budget',
    periode: true,
    standaardPeriode: 'jaar',
    klant: true,
    bouw: async (f) => {
      const [orders, medewerkers, klanten] = await Promise.all([verkochteOrders(f), laadMedewerkers(), laadKlanten()]);
      const metMw = orders.filter((o) => o.medewerker_id);
      const regels = await regelsPerOrder(metMw.map((o) => o.id));
      const mwNaam = new Map(medewerkers.map((m) => [m.id, m]));
      const per = new Map<string, { orders: number; stuks: number; waarde: number; laatste: string | null; regels: VerrijkteRegel[]; org: string | null }>();
      for (const o of metMw) {
        const r = per.get(o.medewerker_id!) ?? { orders: 0, stuks: 0, waarde: 0, laatste: null, regels: [], org: o.organisatie_id };
        const rs = regels.get(o.id) ?? [];
        r.orders += 1;
        r.stuks += rs.reduce((t, x) => t + x.stuks, 0);
        r.waarde += Number(o.bedrag) || rs.reduce((t, x) => t + x.omzet, 0);
        if (!r.laatste || (o.datum && o.datum > r.laatste)) r.laatste = o.datum;
        r.regels.push(...rs);
        per.set(o.medewerker_id!, r);
      }
      return metTotalen({
        kolommen: [
          { kop: 'Klant', soort: 'tekst' },
          { kop: 'Medewerker', soort: 'tekst' },
          { kop: 'Orders', soort: 'getal', som: true, smal: true },
          { kop: 'Stuks', soort: 'getal', som: true },
          { kop: 'Waarde excl. btw', soort: 'euro', som: true },
          { kop: 'Laatste', soort: 'datum' },
          { kop: 'Artikelen', soort: 'tekst' },
        ],
        rijen: [...per.entries()]
          .map(([id, r]) => ({ id, r, naam: mwNaam.get(id)?.naam ?? 'Onbekende medewerker', klant: klantNaam(klanten, mwNaam.get(id)?.organisatie_id ?? r.org) }))
          .sort((a, b) => a.klant.localeCompare(b.klant, 'nl') || a.naam.localeCompare(b.naam, 'nl'))
          .map(({ r, naam, klant }) => ({ cellen: [klant, naam, r.orders, r.stuks, r.waarde, r.laatste, artikelTekst(r.regels)] })),
        toelichting: 'Geplaatste orders met een medewerker erop, op besteldatum. Waarde = orderbedrag, of de som van de regels als de order geen bedrag heeft.',
        leeg: { titel: 'Geen verstrekkingen in deze periode', tekst: 'Alleen orders die aan een medewerker hangen tellen mee. Kies een langere periode of een andere klant.' },
      });
    },
  },
  {
    key: 'verbruik-vestiging',
    titel: 'Verbruik per vestiging',
    beschrijving: 'Orders en orderwaarde per vestiging van de klant.',
    groep: 'Klanten en budget',
    periode: true,
    standaardPeriode: 'jaar',
    klant: true,
    bouw: (f) => verbruikPer(f, 'vestiging'),
  },
  {
    key: 'verbruik-afdeling',
    titel: 'Verbruik per afdeling',
    beschrijving: 'Orders en orderwaarde per afdeling of kostenplaats.',
    groep: 'Klanten en budget',
    periode: true,
    standaardPeriode: 'jaar',
    klant: true,
    bouw: (f) => verbruikPer(f, 'afdeling'),
  },
  {
    key: 'kleding-in-bezit',
    titel: 'Kleding in bezit',
    beschrijving: 'Geleverde stuks per medewerker, ooit. Handig bij uitdiensttreding.',
    groep: 'Klanten en budget',
    periode: false,
    klant: true,
    bouw: async (f) => {
      const [orders, medewerkers, klanten] = await Promise.all([laadOrders(), laadMedewerkers(), laadKlanten()]);
      const geleverd = new Set(['compleet_geleverd', 'verzonden', 'factureren', 'afgerond']);
      const lijst = orders.filter((o) => o.medewerker_id && geleverd.has(o.status) && (!f.klantId || o.organisatie_id === f.klantId));
      const regels = await regelsPerOrder(lijst.map((o) => o.id));
      const mw = new Map(medewerkers.map((m) => [m.id, m]));
      const per = new Map<string, VerrijkteRegel[]>();
      for (const o of lijst) per.set(o.medewerker_id!, [...(per.get(o.medewerker_id!) ?? []), ...(regels.get(o.id) ?? [])]);
      return metTotalen({
        kolommen: [
          { kop: 'Klant', soort: 'tekst' },
          { kop: 'Medewerker', soort: 'tekst' },
          { kop: 'Stuks', soort: 'getal', som: true },
          { kop: 'Artikelen', soort: 'tekst' },
        ],
        rijen: [...per.entries()]
          .filter(([, rs]) => rs.length)
          .map(([id, rs]) => ({ cellen: [klantNaam(klanten, mw.get(id)?.organisatie_id), mw.get(id)?.naam ?? 'Onbekende medewerker', rs.reduce((t, r) => t + r.stuks, 0), artikelTekst(rs)] as Cel[] }))
          .sort((a, b) => String(a.cellen[0]).localeCompare(String(b.cellen[0]), 'nl') || String(a.cellen[1]).localeCompare(String(b.cellen[1]), 'nl')),
        toelichting: 'Orders met status compleet geleverd, verzonden, factureren of afgerond. Retouren zijn niet afgetrokken.',
        leeg: { titel: 'Nog geen geleverde verstrekkingen', tekst: 'Zodra orders voor medewerkers geleverd zijn, staat hier wat iedereen in bezit heeft.' },
      });
    },
  },
  {
    key: 'budgetmutaties',
    titel: 'Budgetmutaties',
    beschrijving: 'Alle op- en afboekingen op budgetten, met saldo na elke mutatie.',
    groep: 'Klanten en budget',
    periode: true,
    standaardPeriode: 'jaar',
    klant: true,
    bouw: async (f) => {
      const sb = kmsAdmin();
      const [medewerkers, klanten] = await Promise.all([laadMedewerkers(), laadKlanten()]);
      const mw = new Map(medewerkers.map((m) => [m.id, m]));
      type M = { id: string; medewerker_id: string | null; soort: string; bedrag: number | null; saldo_na: number | null; omschrijving: string | null; datum: string | null };
      const { rijen } = sb
        ? await pagineer<M>((a, b) =>
            sb.from('budget_mutaties').select('id, medewerker_id, soort, bedrag, saldo_na, omschrijving, datum')
              .gte('datum', f.periode.van).lte('datum', f.periode.tot).order('datum', { ascending: false }).order('id').range(a, b),
          )
        : { rijen: [] as M[] };
      const lijst = rijen.filter((r) => !f.klantId || mw.get(r.medewerker_id ?? '')?.organisatie_id === f.klantId);
      return metTotalen({
        kolommen: [
          { kop: 'Datum', soort: 'datum' },
          { kop: 'Klant', soort: 'tekst' },
          { kop: 'Medewerker', soort: 'tekst' },
          { kop: 'Soort', soort: 'tekst' },
          { kop: 'Omschrijving', soort: 'tekst' },
          { kop: 'Bedrag', soort: 'euro', som: true },
          { kop: 'Saldo na', soort: 'euro' },
        ],
        rijen: lijst.map((r) => {
          const m = mw.get(r.medewerker_id ?? '');
          return { cellen: [r.datum, klantNaam(klanten, m?.organisatie_id), m?.naam ?? 'Onbekende medewerker', r.soort, r.omschrijving, Number(r.bedrag) || 0, Number(r.saldo_na) || 0] };
        }),
        leeg: { titel: 'Geen budgetmutaties in deze periode', tekst: 'Kies een langere periode of een andere klant.' },
      });
    },
  },

  /* ---------------- Inkoop en voorraad ---------------- */
  {
    key: 'inkoop-leverancier',
    titel: 'Inkoop per leverancier',
    beschrijving: 'Bestelde en geleverde stuks en de inkoopwaarde per leverancier.',
    groep: 'Inkoop en voorraad',
    periode: true,
    klant: false,
    bouw: async (f) => {
      const sb = kmsAdmin();
      type I = { variant_id: string | null; leverancier_id: string | null; merk: string | null; aantal: number | null; geleverd_aantal: number | null; status: string; besteld_op: string | null; created_at: string };
      const { rijen } = sb
        ? await pagineer<I>((a, b) =>
            sb.from('inkoopregels').select('variant_id, leverancier_id, merk, aantal, geleverd_aantal, status, besteld_op, created_at')
              .gte('created_at', `${plusDagen(f.periode.van, -400)}T00:00:00Z`).order('created_at').order('id').range(a, b),
          )
        : { rijen: [] as I[] };
      const lijst = rijen.filter((r) => binnen(r.besteld_op ?? nlDatum(r.created_at), f.periode));
      const [leveranciers, varianten] = sb
        ? await Promise.all([
            inStukken<{ id: string; naam: string }>(lijst.map((r) => r.leverancier_id ?? ''), (s) => sb.from('leveranciers').select('id, naam').in('id', s).limit(1000)),
            inStukken<{ id: string; inkoopprijs: number | null }>(lijst.map((r) => r.variant_id ?? ''), (s) => sb.from('product_varianten').select('id, inkoopprijs').in('id', s).limit(1000)),
          ])
        : [[], []];
      const levNaam = new Map(leveranciers.map((l) => [l.id, l.naam]));
      const prijs = new Map(varianten.map((v) => [v.id, Number(v.inkoopprijs) || 0]));
      const per = new Map<string, { regels: number; besteld: number; geleverd: number; waarde: number; onbekend: number }>();
      for (const r of lijst) {
        const k = (r.leverancier_id && levNaam.get(r.leverancier_id)) || (r.merk ? `Onbekende leverancier (${r.merk})` : 'Onbekende leverancier');
        const g = per.get(k) ?? { regels: 0, besteld: 0, geleverd: 0, waarde: 0, onbekend: 0 };
        const p = r.variant_id ? prijs.get(r.variant_id) ?? 0 : 0;
        g.regels += 1;
        g.besteld += Number(r.aantal) || 0;
        g.geleverd += Number(r.geleverd_aantal) || 0;
        g.waarde += p * (Number(r.aantal) || 0);
        if (!p) g.onbekend += 1;
        per.set(k, g);
      }
      return metTotalen({
        kolommen: [
          { kop: 'Leverancier', soort: 'tekst' },
          { kop: 'Regels', soort: 'getal', som: true, smal: true },
          { kop: 'Besteld', soort: 'getal', som: true },
          { kop: 'Geleverd', soort: 'getal', som: true },
          { kop: 'Nog te leveren', soort: 'getal', som: true },
          { kop: 'Inkoopwaarde', soort: 'euro', som: true },
        ],
        rijen: [...per.entries()]
          .sort((a, b) => b[1].waarde - a[1].waarde || b[1].besteld - a[1].besteld)
          .map(([naam, g]) => ({ cellen: [naam, g.regels, g.besteld, g.geleverd, Math.max(0, g.besteld - g.geleverd), g.waarde] })),
        toelichting: 'Inkoopregels op besteldatum (anders aanmaakdatum). Inkoopwaarde = aantal × inkoopprijs van de variant; regels zonder bekende prijs tellen voor € 0.',
        leeg: { titel: 'Geen inkoop in deze periode', tekst: 'Inkoopregels ontstaan als je vanuit een order bestelt bij de leverancier. Kies een langere periode.' },
      });
    },
  },
  {
    key: 'voorraad',
    titel: 'Voorraadwaardering',
    beschrijving: 'Wat ligt er op de plank: stuks, inkoopwaarde en verkoopwaarde per merk.',
    groep: 'Inkoop en voorraad',
    periode: false,
    klant: false,
    bouw: async () => {
      const sb = kmsAdmin();
      type V = { product_id: string | null; voorraad: number | null; inkoopprijs: number | null; verkoopprijs: number | null };
      // Alleen varianten met voorraad: van de ruim 25.000 varianten zijn dat er weinig.
      const { rijen } = sb
        ? await pagineer<V>((a, b) => sb.from('product_varianten').select('product_id, voorraad, inkoopprijs, verkoopprijs').gt('voorraad', 0).order('id').range(a, b), 50_000)
        : { rijen: [] as V[] };
      const producten = sb
        ? await inStukken<{ id: string; merk: string | null }>(rijen.map((v) => v.product_id ?? ''), (s) => sb.from('producten').select('id, merk').in('id', s).limit(1000))
        : [];
      const merk = new Map(producten.map((p) => [p.id, p.merk?.trim() || 'Merk niet ingevuld']));
      const per = new Map<string, { artikelen: Set<string>; stuks: number; inkoop: number; verkoop: number; zonderPrijs: number }>();
      for (const v of rijen) {
        const k = (v.product_id && merk.get(v.product_id)) || 'Onbekend artikel';
        const g = per.get(k) ?? { artikelen: new Set<string>(), stuks: 0, inkoop: 0, verkoop: 0, zonderPrijs: 0 };
        const n = Number(v.voorraad) || 0;
        if (v.product_id) g.artikelen.add(v.product_id);
        g.stuks += n;
        g.inkoop += n * (Number(v.inkoopprijs) || 0);
        g.verkoop += n * (Number(v.verkoopprijs) || 0);
        if (!Number(v.inkoopprijs)) g.zonderPrijs += n;
        per.set(k, g);
      }
      return metTotalen({
        kolommen: [
          { kop: 'Merk', soort: 'tekst' },
          { kop: 'Artikelen', soort: 'getal', som: true, smal: true },
          { kop: 'Stuks', soort: 'getal', som: true },
          { kop: 'Inkoopwaarde', soort: 'euro', som: true },
          { kop: 'Verkoopwaarde', soort: 'euro', som: true },
          { kop: 'Marge bij verkoop', soort: 'euro', som: true },
          { kop: 'Stuks zonder inkoopprijs', soort: 'getal', som: true },
        ],
        rijen: [...per.entries()]
          .sort((a, b) => b[1].inkoop - a[1].inkoop || b[1].stuks - a[1].stuks)
          .map(([naam, g]) => ({ cellen: [naam, g.artikelen.size, g.stuks, g.inkoop, g.verkoop, g.verkoop - g.inkoop, g.zonderPrijs], href: naam.startsWith('Merk niet') || naam.startsWith('Onbekend') ? null : `/dashboard/producten?merk=${encodeURIComponent(naam)}` })),
        toelichting: 'Peildatum vandaag. Voorraad × inkoopprijs en verkoopprijs van de variant. Frederiks werkt grotendeels op bestelling, dus een lage voorraad is normaal.',
        leeg: { titel: 'Geen voorraad geregistreerd', tekst: 'Er staat bij geen enkele variant voorraad. Dat klopt als je alles op bestelling inkoopt; houd je wel voorraad bij, vul die dan in bij Voorraad.' },
      });
    },
  },
];

async function verbruikPer(f: RapportFilters, soort: 'vestiging' | 'afdeling'): Promise<RapportTabel> {
  const sb = kmsAdmin();
  const tabel = soort === 'vestiging' ? 'vestigingen' : 'afdelingen';
  const [orders, klanten, groepen] = await Promise.all([
    verkochteOrders(f),
    laadKlanten(),
    sb ? pagineer<{ id: string; naam: string }>((a, b) => sb.from(tabel).select('id, naam').order('id').range(a, b)).then((r) => r.rijen) : Promise.resolve([]),
  ]);
  const naam = new Map(groepen.map((g) => [g.id, g.naam]));
  const per = new Map<string, { klant: string; groep: string; orders: number; bedrag: number }>();
  for (const o of orders) {
    const gid = soort === 'vestiging' ? o.vestiging_id : o.afdeling_id;
    const groep = gid ? naam.get(gid) ?? `Onbekende ${soort}` : `Zonder ${soort}`;
    const klant = klantNaam(klanten, o.organisatie_id);
    const k = `${o.organisatie_id}|${groep}`;
    const r = per.get(k) ?? { klant, groep, orders: 0, bedrag: 0 };
    r.orders += 1;
    r.bedrag += Number(o.bedrag) || 0;
    per.set(k, r);
  }
  return metTotalen({
    kolommen: [
      { kop: 'Klant', soort: 'tekst' },
      { kop: soort === 'vestiging' ? 'Vestiging' : 'Afdeling', soort: 'tekst' },
      { kop: 'Orders', soort: 'getal', som: true },
      { kop: 'Orderwaarde excl. btw', soort: 'euro', som: true },
    ],
    rijen: [...per.values()]
      .sort((a, b) => a.klant.localeCompare(b.klant, 'nl') || b.bedrag - a.bedrag)
      .map((r) => ({ cellen: [r.klant, r.groep, r.orders, r.bedrag] })),
    toelichting: 'Geplaatste orders op besteldatum (geen concept, offerte of geannuleerd).',
    leeg: { titel: 'Geen orders in deze periode', tekst: 'Kies een langere periode of een andere klant.' },
  });
}

export function vindRapport(key: string | null | undefined): RapportDef | null {
  if (!key) return null;
  return RAPPORTEN.find((r) => r.key === key || r.aliassen?.includes(key)) ?? null;
}

/** Filters uit de URL, met de standaardperiode van het rapport. */
export function leesRapportFilters(def: RapportDef, sp: { periode?: string; van?: string; tot?: string; vgl?: string; klant?: string }): RapportFilters {
  const periode = leesPeriode({ ...sp, vgl: 'geen' }, def.standaardPeriode ?? 'maand');
  const klantId = def.klant && sp.klant && /^[0-9a-f-]{36}$/i.test(sp.klant) ? sp.klant : null;
  return { periode, klantId };
}

/** Een cel als tekst voor CSV en print. Getallen blijven getallen in Excel. */
export function celTekst(waarde: Cel, soort: KolomSoort): string {
  if (waarde === null || waarde === undefined || (typeof waarde === 'number' && Number.isNaN(waarde))) return '';
  if (typeof waarde === 'number') {
    if (soort === 'euro') return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(waarde);
    if (soort === 'pct') return `${(waarde * 100).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}%`;
    return waarde.toLocaleString('nl-NL');
  }
  if (soort === 'datum' && /^\d{4}-\d{2}-\d{2}/.test(waarde)) return datumKort(waarde.slice(0, 10));
  return waarde;
}

/* ==================================================================== */
/* Rapport per klant: één jaaroverzicht om naar de klant te sturen        */
/* ==================================================================== */

export type KlantJaarRapport = {
  klant: { id: string; naam: string; plaats: string | null; klantnummer: string | null; contactpersoon: string | null };
  jaar: number;
  periode: Periode;
  totaal: { gefactureerd: number; gefactureerdVorigJaar: number; orders: number; ordersVorigJaar: number; stuks: number; medewerkers: number };
  maanden: { key: string; label: string; orders: number; stuks: number; gefactureerd: number }[];
  artikelen: { naam: string; stuks: number; waarde: number }[];
  verstrekkingen: RapportTabel;
  budget: RapportTabel;
  heeftBudget: boolean;
};

const MAAND_NAMEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

export async function klantJaarRapport(klantId: string, jaar: number): Promise<KlantJaarRapport | null> {
  const sb = kmsAdmin();
  if (!sb || !/^[0-9a-f-]{36}$/i.test(klantId)) return null;
  const { data: org } = await sb.from('organisaties').select('id, naam, plaats, klantnummer, contactpersoon').eq('id', klantId).maybeSingle();
  if (!org) return null;

  const huidigJaar = Number(leesPeriode({}).vandaag.slice(0, 4));
  const periode = leesPeriode(
    jaar === huidigJaar ? { periode: 'jaar', vgl: 'geen' } : { periode: 'eigen', van: `${jaar}-01-01`, tot: `${jaar}-12-31`, vgl: 'geen' },
  );
  const vorig = { van: `${jaar - 1}-01-01`, tot: `${jaar - 1}-${periode.tot.slice(5)}` };
  const filters: RapportFilters = { periode, klantId };
  const verstrekDef = RAPPORTEN.find((r) => r.key === 'verstrekkingen')!;
  const budgetDef = RAPPORTEN.find((r) => r.key === 'budget-medewerker')!;

  const [facturen, orders, verstrekkingen, budget, medewerkers] = await Promise.all([
    laadFacturen(),
    laadOrders(),
    verstrekDef.bouw(filters),
    budgetDef.bouw(filters),
    laadMedewerkers(),
  ]);
  const vanKlant = orders.filter((o) => o.organisatie_id === klantId && !NIET_VERKOCHT.has(o.status));
  const dezeOrders = vanKlant.filter((o) => binnen(o.datum, periode));
  const regels = await verrijkRegels(await laadRegels(dezeOrders.map((o) => o.id)));
  const stuksPerOrder = new Map<string, number>();
  for (const r of regels) stuksPerOrder.set(r.order_id, (stuksPerOrder.get(r.order_id) ?? 0) + r.stuks);

  const maanden = Array.from({ length: Number(periode.tot.slice(5, 7)) }, (_, i) => {
    const key = `${jaar}-${String(i + 1).padStart(2, '0')}`;
    return { key, label: MAAND_NAMEN[i], orders: 0, stuks: 0, gefactureerd: 0 };
  });
  const maand = (d: string | null) => (d ? maanden[Number(d.slice(5, 7)) - 1] : undefined);
  let gefactureerd = 0, gefactureerdVorig = 0;
  for (const f of facturen) {
    if (f.organisatie_id !== klantId) continue;
    if (binnen(f.factuurdatum, periode)) {
      gefactureerd += Number(f.bedrag_excl) || 0;
      const m = maand(f.factuurdatum);
      if (m) m.gefactureerd += Number(f.bedrag_excl) || 0;
    }
    if (binnen(f.factuurdatum, vorig)) gefactureerdVorig += Number(f.bedrag_excl) || 0;
  }
  for (const o of dezeOrders) {
    const m = maand(o.datum);
    if (!m) continue;
    m.orders += 1;
    m.stuks += stuksPerOrder.get(o.id) ?? 0;
  }
  const perArtikel = new Map<string, { naam: string; stuks: number; waarde: number }>();
  for (const r of regels) {
    const k = r.productId ?? r.productNaam.toLowerCase();
    const a = perArtikel.get(k) ?? { naam: r.productNaam, stuks: 0, waarde: 0 };
    a.stuks += r.stuks;
    a.waarde += r.omzet;
    perArtikel.set(k, a);
  }
  const beleverd = new Set(dezeOrders.map((o) => o.medewerker_id).filter(Boolean));

  return {
    klant: org as KlantJaarRapport['klant'],
    jaar,
    periode,
    totaal: {
      gefactureerd,
      gefactureerdVorigJaar: gefactureerdVorig,
      orders: dezeOrders.length,
      ordersVorigJaar: vanKlant.filter((o) => binnen(o.datum, vorig)).length,
      stuks: regels.reduce((t, r) => t + r.stuks, 0),
      medewerkers: beleverd.size,
    },
    maanden,
    artikelen: [...perArtikel.values()].sort((a, b) => b.stuks - a.stuks).slice(0, 15),
    verstrekkingen,
    budget,
    heeftBudget: medewerkers.some((m) => m.organisatie_id === klantId && (Number(m.budget) || 0) > 0),
  };
}
