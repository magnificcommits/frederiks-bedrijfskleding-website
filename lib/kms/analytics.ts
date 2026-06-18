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

export type TopProduct = { naam: string; stuks: number; omzet: number };

/** Best verkochte producten op stuks, uit orderregels van geplaatste orders (geen concept/offerte/geannuleerd). */
export async function topProducten(limit = 8): Promise<TopProduct[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data: ordersData } = await sb.from('orders').select('id, status');
  const geldig = new Set(
    ((ordersData as { id: string; status: string }[]) ?? [])
      .filter((o) => !['concept', 'geannuleerd', 'offerte_verstuurd'].includes(o.status))
      .map((o) => o.id),
  );
  if (geldig.size === 0) return [];
  const { data: regels } = await sb
    .from('orderregels')
    .select('order_id, product_id, item_naam, aantal, stukprijs');
  const perProduct = new Map<string, TopProduct>();
  (
    (regels as {
      order_id: string;
      product_id: string | null;
      item_naam: string | null;
      aantal: number | null;
      stukprijs: number | null;
    }[]) ?? []
  ).forEach((r) => {
    if (!geldig.has(r.order_id)) return;
    const key = r.product_id ?? r.item_naam ?? 'onbekend';
    const huidig = perProduct.get(key) ?? { naam: r.item_naam ?? 'Onbekend', stuks: 0, omzet: 0 };
    huidig.stuks += Number(r.aantal) || 0;
    huidig.omzet += (Number(r.aantal) || 0) * (Number(r.stukprijs) || 0);
    perProduct.set(key, huidig);
  });
  return [...perProduct.values()].sort((a, b) => b.stuks - a.stuks).slice(0, limit);
}

export type TopMerk = { merk: string; stuks: number; omzet: number };

/** Best verkochte merken op stuks, gegroepeerd via het merk van het product (geen concept/offerte/geannuleerd). */
export async function topMerken(limit = 8): Promise<TopMerk[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data: ordersData } = await sb.from('orders').select('id, status');
  const geldig = new Set(
    ((ordersData as { id: string; status: string }[]) ?? [])
      .filter((o) => !['concept', 'geannuleerd', 'offerte_verstuurd'].includes(o.status))
      .map((o) => o.id),
  );
  if (geldig.size === 0) return [];
  const { data: productenData } = await sb.from('producten').select('id, merk');
  const merkPerProduct = new Map<string, string>();
  ((productenData as { id: string; merk: string | null }[]) ?? []).forEach((p) => {
    const merk = p.merk && p.merk.trim() !== '' ? p.merk : 'Onbekend';
    merkPerProduct.set(p.id, merk);
  });
  const { data: regels } = await sb
    .from('orderregels')
    .select('order_id, product_id, aantal, stukprijs');
  const perMerk = new Map<string, TopMerk>();
  (
    (regels as {
      order_id: string;
      product_id: string | null;
      aantal: number | null;
      stukprijs: number | null;
    }[]) ?? []
  ).forEach((r) => {
    if (!geldig.has(r.order_id)) return;
    const merk = (r.product_id ? merkPerProduct.get(r.product_id) : undefined) ?? 'Onbekend';
    const huidig = perMerk.get(merk) ?? { merk, stuks: 0, omzet: 0 };
    huidig.stuks += Number(r.aantal) || 0;
    huidig.omzet += (Number(r.aantal) || 0) * (Number(r.stukprijs) || 0);
    perMerk.set(merk, huidig);
  });
  return [...perMerk.values()].sort((a, b) => b.stuks - a.stuks).slice(0, limit);
}

export type Voorraadwaarde = {
  stuks: number;
  inkoopwaarde: number;
  verkoopwaarde: number;
  margePotentieel: number;
};

/** Voorraadwaarde: voorraad × inkoop- en verkoopprijs over alle varianten, plus potentiële marge. */
export async function voorraadwaarde(): Promise<Voorraadwaarde> {
  const sb = kmsAdmin();
  if (!sb) return { stuks: 0, inkoopwaarde: 0, verkoopwaarde: 0, margePotentieel: 0 };
  const { data } = await sb.from('product_varianten').select('voorraad, inkoopprijs, verkoopprijs');
  let stuks = 0;
  let inkoopwaarde = 0;
  let verkoopwaarde = 0;
  ((data as { voorraad: number | null; inkoopprijs: number | null; verkoopprijs: number | null }[]) ?? []).forEach((v) => {
    const aantal = Number(v.voorraad) || 0;
    if (aantal <= 0) return;
    stuks += aantal;
    inkoopwaarde += aantal * (Number(v.inkoopprijs) || 0);
    verkoopwaarde += aantal * (Number(v.verkoopprijs) || 0);
  });
  return { stuks, inkoopwaarde, verkoopwaarde, margePotentieel: verkoopwaarde - inkoopwaarde };
}

export type LeadConversie = {
  totaal: number;
  nieuw: number;
  offerte: number;
  gewonnen: number;
  verloren: number;
  conversiePct: number | null; // gewonnen / (gewonnen + verloren)
  gewonnenWaarde: number;
};

/** Leadconversie: verdeling over statussen en het conversiepercentage van afgehandelde leads. */
export async function leadConversie(): Promise<LeadConversie> {
  const sb = kmsAdmin();
  if (!sb) return { totaal: 0, nieuw: 0, offerte: 0, gewonnen: 0, verloren: 0, conversiePct: null, gewonnenWaarde: 0 };
  const { data } = await sb.from('leads').select('status, offertewaarde');
  const leads = (data as { status: string; offertewaarde: number | null }[]) ?? [];
  let nieuw = 0;
  let offerte = 0;
  let gewonnen = 0;
  let verloren = 0;
  let gewonnenWaarde = 0;
  leads.forEach((l) => {
    if (l.status === 'nieuw') nieuw += 1;
    else if (l.status === 'offerte') offerte += 1;
    else if (l.status === 'geaccordeerd') {
      gewonnen += 1;
      gewonnenWaarde += Number(l.offertewaarde) || 0;
    } else if (l.status === 'afgewezen') verloren += 1;
  });
  const afgehandeld = gewonnen + verloren;
  return {
    totaal: leads.length,
    nieuw,
    offerte,
    gewonnen,
    verloren,
    conversiePct: afgehandeld > 0 ? (gewonnen / afgehandeld) * 100 : null,
    gewonnenWaarde,
  };
}
