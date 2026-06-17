import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor het management-/analytics-dashboard.
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed(). Aggregatie gebeurt in-memory met Map, net als rapportages.ts.
 */

export type MedewerkersPerBedrijf = {
  organisatie: string;
  aantal: number;
};

export type MaandStuks = {
  maand: string; // 'YYYY-MM'
  label: string; // 'jun 2026'
  stuks: number;
};

export type MaandOmzet = {
  maand: string; // 'YYYY-MM'
  label: string; // 'jun 2026'
  omzet: number;
};

/** Eén vergelijking: huidige waarde t.o.v. een eerdere periode, met absolute en procentuele groei. */
export type Vergelijking = {
  huidig: number;
  vorig: number;
  verschil: number; // huidig - vorig
  groeiPct: number | null; // null als vorige periode 0 was (geen zinnige %)
};

/** Kerncijfers van een maand-reeks: huidige maand met MoM- en YoY-vergelijking. */
export type GroeiCijfers = {
  huidigLabel: string; // label van de huidige (laatste) maand
  huidig: number;
  vorigeMaand: Vergelijking; // huidig vs. vorige maand
  vorigJaar: Vergelijking; // huidig vs. zelfde maand vorig jaar
};

export type KerncijfersAnalyse = {
  totaalMedewerkers: number;
  totaalBedrijven: number;
  stuks: GroeiCijfers;
  omzet: GroeiCijfers;
};

const MAAND_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** 'YYYY-MM' uit een datum-string of Date. Geeft '' bij ongeldige invoer. */
function maandKey(d: string | Date | null | undefined): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

/** 'jun 2026' label uit een 'YYYY-MM'-key. */
function maandLabel(key: string): string {
  const [jaar, maand] = key.split('-');
  const idx = Number(maand) - 1;
  const naam = MAAND_KORT[idx] ?? maand;
  return `${naam} ${jaar}`;
}

/** Bouwt een chronologische reeks van de laatste N maanden, eindigend op de huidige maand. */
function laatsteMaanden(maanden: number): string[] {
  const reeks: string[] = [];
  const nu = new Date();
  for (let i = maanden - 1; i >= 0; i--) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
    reeks.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return reeks;
}

/** Orderstatussen die NIET meetellen voor verkochte stuks (concept/geannuleerd). */
const NIET_VERKOCHT = new Set(['concept', 'geannuleerd', 'offerte_verstuurd']);

export async function medewerkersPerBedrijf(): Promise<{ lijst: MedewerkersPerBedrijf[]; totaal: number }> {
  const sb = kmsAdmin();
  if (!sb) return { lijst: [], totaal: 0 };
  const { data } = await sb.from('medewerkers').select('id, organisaties(naam)');
  const rows = (data as unknown as { id: string; organisaties: { naam: string } | null }[]) ?? [];
  const perBedrijf = new Map<string, number>();
  for (const r of rows) {
    const naam = r.organisaties?.naam ?? 'Onbekend bedrijf';
    perBedrijf.set(naam, (perBedrijf.get(naam) ?? 0) + 1);
  }
  const lijst = [...perBedrijf.entries()]
    .map(([organisatie, aantal]) => ({ organisatie, aantal }))
    .sort((a, b) => b.aantal - a.aantal);
  const totaal = rows.length;
  return { lijst, totaal };
}

export async function stuksPerMaand(maanden = 12): Promise<MaandStuks[]> {
  const sb = kmsAdmin();
  const reeks = laatsteMaanden(maanden);
  const leeg = (): MaandStuks[] => reeks.map((m) => ({ maand: m, label: maandLabel(m), stuks: 0 }));
  if (!sb) return leeg();

  const [ordersR, regelsR] = await Promise.all([
    sb.from('orders').select('id, besteldatum, created_at, status'),
    sb.from('orderregels').select('order_id, aantal'),
  ]);
  const orders = (ordersR.data as { id: string; besteldatum: string | null; created_at: string | null; status: string }[]) ?? [];
  const regels = (regelsR.data as { order_id: string; aantal: number | null }[]) ?? [];

  // Koppel elke meetellende order aan zijn maand-key.
  const orderMaand = new Map<string, string>();
  for (const o of orders) {
    if (NIET_VERKOCHT.has(o.status)) continue;
    const key = maandKey(o.besteldatum ?? o.created_at);
    if (key) orderMaand.set(o.id, key);
  }

  const perMaand = new Map<string, number>();
  for (const r of regels) {
    const key = orderMaand.get(r.order_id);
    if (!key) continue;
    perMaand.set(key, (perMaand.get(key) ?? 0) + (Number(r.aantal) || 0));
  }

  return reeks.map((m) => ({ maand: m, label: maandLabel(m), stuks: perMaand.get(m) ?? 0 }));
}

export async function omzetPerMaand(maanden = 12): Promise<MaandOmzet[]> {
  const sb = kmsAdmin();
  const reeks = laatsteMaanden(maanden);
  const leeg = (): MaandOmzet[] => reeks.map((m) => ({ maand: m, label: maandLabel(m), omzet: 0 }));
  if (!sb) return leeg();

  // Omzet = som van betaalde facturen, gedateerd op betaaldatum (zelfde aanpak als rapportages.ts).
  const { data } = await sb.from('facturen').select('status, bedrag_incl, betaaldatum');
  const facturen = (data as { status: string; bedrag_incl: number | null; betaaldatum: string | null }[]) ?? [];

  const perMaand = new Map<string, number>();
  for (const f of facturen) {
    if (f.status !== 'betaald' || !f.betaaldatum) continue;
    const key = maandKey(f.betaaldatum);
    if (!key) continue;
    perMaand.set(key, (perMaand.get(key) ?? 0) + (Number(f.bedrag_incl) || 0));
  }

  return reeks.map((m) => ({ maand: m, label: maandLabel(m), omzet: perMaand.get(m) ?? 0 }));
}

/** Berekent een procentuele groei; null als de basis 0 is (geen zinnige %). */
function groeiPercentage(huidig: number, vorig: number): number | null {
  if (vorig === 0) return null;
  return Math.round(((huidig - vorig) / Math.abs(vorig)) * 1000) / 10;
}

function vergelijk(huidig: number, vorig: number): Vergelijking {
  return {
    huidig,
    vorig,
    verschil: huidig - vorig,
    groeiPct: groeiPercentage(huidig, vorig),
  };
}

/**
 * Berekent groei-kerncijfers uit een maand-reeks (chronologisch, laatste = huidig):
 * huidige maand vs. vorige maand (MoM) en vs. zelfde maand vorig jaar (YoY).
 */
export function berekenGroei(reeks: { maand: string; label: string }[], waarden: number[]): GroeiCijfers {
  const n = reeks.length;
  const leeg: GroeiCijfers = {
    huidigLabel: '',
    huidig: 0,
    vorigeMaand: vergelijk(0, 0),
    vorigJaar: vergelijk(0, 0),
  };
  if (n === 0) return leeg;

  const huidigIdx = n - 1;
  const huidig = waarden[huidigIdx] ?? 0;
  const vorigeMaandWaarde = huidigIdx - 1 >= 0 ? waarden[huidigIdx - 1] ?? 0 : 0;

  // Zelfde maand vorig jaar: zoek de key in de reeks op (index huidig - 12).
  const vorigJaarIdx = huidigIdx - 12;
  const vorigJaarWaarde = vorigJaarIdx >= 0 ? waarden[vorigJaarIdx] ?? 0 : 0;

  return {
    huidigLabel: reeks[huidigIdx]?.label ?? '',
    huidig,
    vorigeMaand: vergelijk(huidig, vorigeMaandWaarde),
    vorigJaar: vergelijk(huidig, vorigJaarWaarde),
  };
}

export async function kerncijfersAnalyse(): Promise<KerncijfersAnalyse> {
  const sb = kmsAdmin();

  // YoY heeft 13 maanden nodig zodat de zelfde maand vorig jaar in de reeks zit.
  const [perBedrijf, stuks13, omzet13] = await Promise.all([
    medewerkersPerBedrijf(),
    stuksPerMaand(13),
    omzetPerMaand(13),
  ]);

  let totaalBedrijven = 0;
  if (sb) {
    const { data } = await sb.from('organisaties').select('id');
    totaalBedrijven = ((data as { id: string }[]) ?? []).length;
  }

  const stuksGroei = berekenGroei(stuks13, stuks13.map((m) => m.stuks));
  const omzetGroei = berekenGroei(omzet13, omzet13.map((m) => m.omzet));

  return {
    totaalMedewerkers: perBedrijf.totaal,
    totaalBedrijven,
    stuks: stuksGroei,
    omzet: omzetGroei,
  };
}
