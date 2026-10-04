import { kmsAdmin } from '@/lib/kms/adminClient';
import { listTaken } from '@/lib/kms/taken';
import { nlDelen, plusDagen, vandaagNl, MAANDEN_KORT } from '@/app/dashboard/taken/tijd';

/**
 * Cijfers voor de startpagina van het dashboard.
 *
 * Eén ronde parallelle queries (Promise.all), elk met alleen de kolommen die
 * nodig zijn en maximaal 1000 rijen. Alles daarna gebeurt in het geheugen:
 * maandreeksen, vergelijkingen, pijplijn en activiteit. Geen N+1: de klantnaam
 * komt via een join mee, offerteregels als geneste selectie.
 *
 * Alleen server-side gebruiken, achter dashAuthed() (kmsAdmin = service role).
 *
 * Omzet = gefactureerd excl. btw op factuurdatum (alles behalve concept). Dat is
 * wat een boekhoudpakket als omzet toont. "Betaald" is het deel daarvan waar al
 * een betaaldatum op staat.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type MaandPunt = {
  /** 'yyyy-mm' */
  key: string;
  /** 'okt', of 'okt 25' als het jaar wisselt */
  label: string;
  labelLang: string;
  gefactureerd: number;
  betaald: number;
  orderwaarde: number;
  orders: number;
  offertes: number;
  leads: number;
  /** Openstaand factuurbedrag (incl. btw) aan het eind van de maand; de lopende maand: nu. */
  openstaand: number;
};

export type PijplijnStatus = { status: string; label: string; aantal: number; bedrag: number };
export type PijplijnFase = { fase: string; statussen: PijplijnStatus[]; aantal: number; bedrag: number };

export type LangOpenOrder = {
  id: string;
  ordernummer: number | null;
  klant: string | null;
  status: string;
  statusLabel: string;
  dagenOpen: number;
  bedrag: number | null;
};

export type AgendaItem = {
  id: string;
  soort: 'taak' | 'afspraak' | 'passessie';
  datum: string;
  tijd: string | null;
  eindTijd: string | null;
  titel: string;
  klant: string | null;
  locatie: string | null;
  klaar: boolean;
  hoog: boolean;
  href: string;
};

export type ActiviteitItem = {
  id: string;
  soort: 'order' | 'offerte' | 'lead' | 'portaal' | 'factuur';
  titel: string;
  detail: string | null;
  moment: string;
  href: string;
};

export type BijnaVerlopenOfferte = { id: string; nummer: number | null; klant: string | null; dagen: number };

export type TopKlant = { id: string | null; naam: string; bedrag: number; aandeel: number };

export type DashboardStats = {
  vandaag: string;
  nuTijd: string;
  /** Bijvoorbeeld '1–3 okt' en '1–3 sep': de vergelijking loopt over dezelfde dagen. */
  periode: { huidig: string; vorige: string; vorigeMaandEinde: string };
  maanden: MaandPunt[];
  omzet: { mtd: number; vorigeMtd: number; betaaldMtd: number; totaal12m: number; gemiddeld12m: number };
  orders: {
    open: number;
    oud14: number;
    nieuwMtd: number;
    nieuwVorigeMtd: number;
    wachtGoedkeuring: number;
    openWaarde: number;
    pijplijn: PijplijnFase[];
    langst: LangOpenOrder[];
  };
  offertes: {
    openWaarde: number;
    verstuurd: number;
    concept: number;
    geaccepteerd12m: number;
    afgewezen12m: number;
    nieuwMtd: number;
    nieuwVorigeMtd: number;
    bijnaVerlopen: BijnaVerlopenOfferte[];
  };
  facturen: {
    open: number;
    openAantal: number;
    vervallenBedrag: number;
    vervallenAantal: number;
    openEindVorigeMaand: number;
    concepten: number;
  };
  leads: { mtd: number; vorigeMtd: number; wachten: number; opvolgen: number; eersteWachtend: string | null };
  passessiesOpenVerleden: number;
  teBestellen: number;
  agenda: AgendaItem[];
  topKlanten: TopKlant[];
  activiteit: ActiviteitItem[];
};

/* ------------------------------------------------------------------ */
/* Orderstatussen en fases                                             */
/* ------------------------------------------------------------------ */

export const ORDER_STATUS_LABEL: Record<string, string> = {
  concept: 'Concept',
  offerte_verstuurd: 'Offerte verstuurd',
  offerte_goedgekeurd: 'Offerte goedgekeurd',
  nog_bestellen: 'Nog bestellen',
  besteld: 'Besteld',
  deellevering: 'Deellevering',
  compleet_geleverd: 'Compleet geleverd',
  bedrukken: 'Bedrukken',
  borduren: 'Borduren',
  verpakken: 'Verpakken',
  bezorgen: 'Bezorgen',
  verzonden: 'Verzonden',
  factureren: 'Factureren',
  afgerond: 'Afgerond',
};

/** Dertien statussen naast elkaar is onleesbaar. Vijf fases, zoals het werk ook loopt. */
const FASES: { fase: string; statussen: string[] }[] = [
  { fase: 'Voorbereiden', statussen: ['concept', 'offerte_verstuurd', 'offerte_goedgekeurd'] },
  { fase: 'Inkoop', statussen: ['nog_bestellen', 'besteld', 'deellevering', 'compleet_geleverd'] },
  { fase: 'Productie', statussen: ['bedrukken', 'borduren', 'verpakken'] },
  { fase: 'Levering', statussen: ['bezorgen', 'verzonden'] },
  { fase: 'Factureren', statussen: ['factureren'] },
];

export function statusLabel(s: string): string {
  return ORDER_STATUS_LABEL[s] ?? s.replace(/_/g, ' ');
}

/* ------------------------------------------------------------------ */
/* Hulpjes                                                             */
/* ------------------------------------------------------------------ */

const num = (v: unknown) => Number(v) || 0;

/** 'yyyy-mm-dd' in Nederlandse tijd voor een timestamp of datum. */
function nlDatum(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : nlDelen(d).datum;
}

function maandKey(jaar: number, maand0: number): string {
  const d = new Date(Date.UTC(jaar, maand0, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function dagenTussen(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function laatsteDagVan(key: string): string {
  const [j, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(j, m, 0));
  return d.toISOString().slice(0, 10);
}

type Org = { naam: string | null } | null;
const orgNaam = (o: Org | Org[] | undefined): string | null => {
  const r = Array.isArray(o) ? o[0] : o;
  return r?.naam ?? null;
};

/* ------------------------------------------------------------------ */
/* Ophalen                                                             */
/* ------------------------------------------------------------------ */

type FactuurRij = {
  id: string; factuurnummer: string | null; organisatie_id: string | null; factuurdatum: string | null;
  vervaldatum: string | null; bedrag_excl: number | null; bedrag_incl: number | null; status: string;
  betaaldatum: string | null; created_at: string; organisaties: Org;
};
type OrderRij = {
  id: string; ordernummer: number | null; status: string; goedkeuring_status: string | null; bedrag: number | null;
  besteldatum: string | null; created_at: string; organisaties: Org;
};
type OfferteRij = {
  id: string; offertenummer: number | null; status: string; geldig_tot: string | null; created_at: string;
  organisaties: Org; offerteregels?: { aantal: number | null; stukprijs: number | null; korting_pct: number | null }[] | null;
};
type LeadRij = { id: string; name: string; company: string | null; status: string; created_at: string; opvolgdatum: string | null };
type PortaalRij = { id: string; organisatie_id: string | null; status: string; waarde: number | null; created_at: string; medewerker_naam: string | null; organisaties: Org };
type PassessieRij = { id: string; datum: string | null; locatie: string | null; status: string; organisaties: Org };

export async function getDashboardStats(): Promise<DashboardStats | null> {
  const sb = kmsAdmin();
  if (!sb) return null;

  const vandaag = vandaagNl();
  const nu = nlDelen();
  const [jaar, maand] = vandaag.split('-').map(Number);
  const dag = Number(vandaag.slice(8, 10));

  // Twaalf maanden, de lopende maand als laatste.
  const keys = Array.from({ length: 12 }, (_, i) => maandKey(jaar, maand - 1 - (11 - i)));
  const startVenster = `${keys[0]}-01`;
  const huidigeKey = keys[11];
  const vorigeKey = keys[10];
  const vorigeDagMax = Math.min(dag, Number(laatsteDagVan(vorigeKey).slice(8, 10)));
  const inHuidig = (d: string | null) => !!d && d.startsWith(huidigeKey);
  const inVorigeTotNu = (d: string | null) => !!d && d.startsWith(vorigeKey) && Number(d.slice(8, 10)) <= vorigeDagMax;
  const weekEind = plusDagen(vandaag, 6);
  const binnenWeek = plusDagen(vandaag, 7);

  const [facturenR, ordersR, offertesR, leadsR, portaalR, passessiesR, inkoopR, agendaTaken] = await Promise.all([
    sb.from('facturen')
      .select('id, factuurnummer, organisatie_id, factuurdatum, vervaldatum, bedrag_excl, bedrag_incl, status, betaaldatum, created_at, organisaties(naam)')
      .or(`factuurdatum.gte.${startVenster},betaaldatum.gte.${startVenster},status.neq.betaald`)
      .order('factuurdatum', { ascending: false })
      .limit(1000),
    sb.from('orders')
      .select('id, ordernummer, status, goedkeuring_status, bedrag, besteldatum, created_at, organisaties(naam)')
      .or(`besteldatum.gte.${startVenster},created_at.gte.${startVenster},status.neq.afgerond`)
      .order('created_at', { ascending: false })
      .limit(1000),
    // Offerteregels als geneste selectie: één verzoek, geen query per offerte.
    sb.from('offertes')
      .select('id, offertenummer, status, geldig_tot, created_at, organisaties(naam), offerteregels(aantal, stukprijs, korting_pct)')
      .or(`created_at.gte.${startVenster},status.in.(concept,verstuurd)`)
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(async (r) =>
        r.error
          ? await sb.from('offertes')
              .select('id, offertenummer, status, geldig_tot, created_at, organisaties(naam)')
              .or(`created_at.gte.${startVenster},status.in.(concept,verstuurd)`)
              .order('created_at', { ascending: false })
              .limit(1000)
          : r,
      ),
    sb.from('leads')
      .select('id, name, company, status, created_at, opvolgdatum')
      .or(`created_at.gte.${startVenster},status.in.(nieuw,contact,afspraak,offerte)`)
      .order('created_at', { ascending: false })
      .limit(1000),
    sb.from('portaal_bestellingen')
      .select('id, organisatie_id, status, waarde, created_at, medewerker_naam, organisaties(naam)')
      .order('created_at', { ascending: false })
      .limit(8),
    sb.from('passessies')
      .select('id, datum, locatie, status, organisaties(naam)')
      .eq('status', 'open')
      .lte('datum', weekEind)
      .order('datum', { ascending: true })
      .limit(200),
    sb.from('inkoopregels').select('id', { count: 'exact', head: true }).eq('status', 'te_bestellen'),
    listTaken('agenda', { van: vandaag, tot: weekEind }).catch(() => []),
  ]);

  const facturen = (facturenR.data as unknown as FactuurRij[]) ?? [];
  const orders = (ordersR.data as unknown as OrderRij[]) ?? [];
  const offertes = (offertesR.data as unknown as OfferteRij[]) ?? [];
  const leads = (leadsR.data as unknown as LeadRij[]) ?? [];
  const portaal = (portaalR.data as unknown as PortaalRij[]) ?? [];
  const passessies = (passessiesR.data as unknown as PassessieRij[]) ?? [];

  /* ---- Maandreeksen ---------------------------------------------- */
  const per = new Map<string, MaandPunt>();
  keys.forEach((k, i) => {
    const [j, m] = k.split('-').map(Number);
    const jaarWissel = i === 0 || m === 1;
    per.set(k, {
      key: k,
      label: jaarWissel ? `${MAANDEN_KORT[m - 1]} ${String(j).slice(2)}` : MAANDEN_KORT[m - 1],
      labelLang: new Date(Date.UTC(j, m - 1, 1)).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      gefactureerd: 0, betaald: 0, orderwaarde: 0, orders: 0, offertes: 0, leads: 0, openstaand: 0,
    });
  });

  // Facturen
  const echteFacturen = facturen.filter((f) => f.status !== 'concept');
  let omzetMtd = 0, omzetVorigeMtd = 0, betaaldMtd = 0;
  const perKlant = new Map<string, { id: string | null; naam: string; bedrag: number }>();
  for (const f of echteFacturen) {
    const d = f.factuurdatum;
    const p = d ? per.get(d.slice(0, 7)) : undefined;
    const excl = num(f.bedrag_excl);
    if (p) {
      p.gefactureerd += excl;
      if (f.status === 'betaald') p.betaald += excl;
      const sleutel = f.organisatie_id ?? 'onbekend';
      const k = perKlant.get(sleutel) ?? { id: f.organisatie_id, naam: orgNaam(f.organisaties) ?? 'Onbekende klant', bedrag: 0 };
      k.bedrag += excl;
      perKlant.set(sleutel, k);
    }
    if (inHuidig(d)) { omzetMtd += excl; if (f.status === 'betaald') betaaldMtd += excl; }
    if (inVorigeTotNu(d)) omzetVorigeMtd += excl;
  }
  // Openstaand aan het eind van elke maand: gefactureerd vóór die dag, toen nog niet betaald.
  const openOp = (grens: string) =>
    echteFacturen
      .filter((f) => f.factuurdatum && f.factuurdatum <= grens && (f.status !== 'betaald' || (f.betaaldatum ?? '') > grens))
      .reduce((t, f) => t + num(f.bedrag_incl), 0);
  for (const k of keys) per.get(k)!.openstaand = openOp(k === huidigeKey ? vandaag : laatsteDagVan(k));
  const openFacturen = echteFacturen.filter((f) => f.status !== 'betaald');
  const vervallen = openFacturen.filter((f) => f.vervaldatum && f.vervaldatum < vandaag);

  // Orders
  let nieuwMtd = 0, nieuwVorigeMtd = 0;
  for (const o of orders) {
    const d = nlDatum(o.besteldatum ?? o.created_at);
    const p = d ? per.get(d.slice(0, 7)) : undefined;
    if (p) { p.orders += 1; if (o.status !== 'concept') p.orderwaarde += num(o.bedrag); }
    if (inHuidig(d)) nieuwMtd += 1;
    if (inVorigeTotNu(d)) nieuwVorigeMtd += 1;
  }
  const openOrders = orders.filter((o) => o.status !== 'afgerond');
  const dagenOpen = (o: OrderRij) => {
    const d = nlDatum(o.besteldatum ?? o.created_at);
    return d ? Math.max(0, dagenTussen(d, vandaag)) : 0;
  };
  const statusTelling = new Map<string, { aantal: number; bedrag: number }>();
  for (const o of openOrders) {
    const t = statusTelling.get(o.status) ?? { aantal: 0, bedrag: 0 };
    t.aantal += 1; t.bedrag += num(o.bedrag);
    statusTelling.set(o.status, t);
  }
  const bekend = new Set(FASES.flatMap((f) => f.statussen));
  const overig = [...statusTelling.keys()].filter((s) => !bekend.has(s));
  const pijplijn: PijplijnFase[] = [...FASES, ...(overig.length ? [{ fase: 'Overig', statussen: overig }] : [])].map((f) => {
    const statussen = f.statussen.map((s) => ({ status: s, label: statusLabel(s), aantal: statusTelling.get(s)?.aantal ?? 0, bedrag: statusTelling.get(s)?.bedrag ?? 0 }));
    return { fase: f.fase, statussen, aantal: statussen.reduce((t, s) => t + s.aantal, 0), bedrag: statussen.reduce((t, s) => t + s.bedrag, 0) };
  });
  const langst: LangOpenOrder[] = openOrders
    .map((o) => ({ o, dagen: dagenOpen(o) }))
    .sort((a, b) => b.dagen - a.dagen)
    .slice(0, 5)
    .map(({ o, dagen }) => ({
      id: o.id, ordernummer: o.ordernummer, klant: orgNaam(o.organisaties), status: o.status,
      statusLabel: statusLabel(o.status), dagenOpen: dagen, bedrag: o.bedrag,
    }));

  // Offertes (waarde excl. btw, net als de omzet)
  const offerteWaarde = (o: OfferteRij) =>
    (o.offerteregels ?? []).reduce((t, r) => t + num(r.aantal) * num(r.stukprijs) * (1 - num(r.korting_pct) / 100), 0);
  const openOffertes = offertes.filter((o) => o.status === 'concept' || o.status === 'verstuurd');
  let offNieuwMtd = 0, offNieuwVorige = 0, geaccepteerd12m = 0, afgewezen12m = 0;
  for (const o of offertes) {
    const d = nlDatum(o.created_at);
    const p = d ? per.get(d.slice(0, 7)) : undefined;
    if (p) {
      p.offertes += 1;
      if (o.status === 'geaccepteerd') geaccepteerd12m += 1;
      if (o.status === 'afgewezen') afgewezen12m += 1;
    }
    if (inHuidig(d)) offNieuwMtd += 1;
    if (inVorigeTotNu(d)) offNieuwVorige += 1;
  }
  const bijnaVerlopen: BijnaVerlopenOfferte[] = openOffertes
    .filter((o) => o.status === 'verstuurd' && o.geldig_tot && o.geldig_tot >= vandaag && o.geldig_tot <= binnenWeek)
    .sort((a, b) => (a.geldig_tot! < b.geldig_tot! ? -1 : 1))
    .map((o) => ({ id: o.id, nummer: o.offertenummer, klant: orgNaam(o.organisaties), dagen: dagenTussen(vandaag, o.geldig_tot!) }));

  // Leads
  let leadsMtd = 0, leadsVorige = 0;
  for (const l of leads) {
    const d = nlDatum(l.created_at);
    const p = d ? per.get(d.slice(0, 7)) : undefined;
    if (p) p.leads += 1;
    if (inHuidig(d)) leadsMtd += 1;
    if (inVorigeTotNu(d)) leadsVorige += 1;
  }
  const wachtend = leads.filter((l) => l.status === 'nieuw');
  const opvolgen = leads.filter((l) => ['nieuw', 'contact', 'afspraak', 'offerte'].includes(l.status ?? '') && l.opvolgdatum && l.opvolgdatum <= vandaag).length;
  const oudsteWachtend = wachtend.reduce<LeadRij | null>((oud, l) => (!oud || l.created_at < oud.created_at ? l : oud), null);

  /* ---- Agenda: taken, afspraken en passessies van vandaag t/m +6 --- */
  const agenda: AgendaItem[] = [
    ...agendaTaken
      .filter((t) => t.vervaldatum)
      .map((t) => ({
        id: t.id,
        soort: t.soort === 'afspraak' ? ('afspraak' as const) : ('taak' as const),
        datum: t.vervaldatum!,
        tijd: t.tijd,
        eindTijd: t.eind_tijd,
        titel: t.titel || 'Zonder titel',
        klant: t.organisatie_naam ?? null,
        locatie: t.locatie,
        klaar: t.status !== 'open',
        hoog: t.prioriteit === 'hoog',
        href: `/dashboard/taken?taak=${t.id}`,
      })),
    ...passessies
      .filter((p) => p.datum && p.datum >= vandaag)
      .map((p) => ({
        id: p.id,
        soort: 'passessie' as const,
        datum: p.datum!,
        tijd: null,
        eindTijd: null,
        titel: 'Passessie',
        klant: orgNaam(p.organisaties),
        locatie: p.locatie,
        klaar: false,
        hoog: false,
        href: `/dashboard/passessie/${p.id}`,
      })),
  ].sort((a, b) => {
    if (a.datum !== b.datum) return a.datum < b.datum ? -1 : 1;
    if (a.tijd !== b.tijd) return !a.tijd ? -1 : !b.tijd ? 1 : a.tijd < b.tijd ? -1 : 1;
    return 0;
  });

  /* ---- Top klanten (12 maanden gefactureerd) ----------------------- */
  const totaal12m = keys.reduce((t, k) => t + per.get(k)!.gefactureerd, 0);
  const topKlanten: TopKlant[] = [...perKlant.values()]
    .filter((k) => k.bedrag > 0)
    .sort((a, b) => b.bedrag - a.bedrag)
    .slice(0, 5)
    .map((k) => ({ ...k, aandeel: totaal12m > 0 ? k.bedrag / totaal12m : 0 }));
  const maandenMetOmzet = keys.filter((k) => per.get(k)!.gefactureerd > 0).length;

  /* ---- Recente activiteit ----------------------------------------- */
  const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const activiteit: ActiviteitItem[] = [
    ...orders.slice(0, 8).map((o) => ({
      id: `o-${o.id}`, soort: 'order' as const,
      titel: `Order #${o.ordernummer ?? '—'}`,
      detail: [orgNaam(o.organisaties), statusLabel(o.status).toLowerCase(), o.bedrag ? euro(num(o.bedrag)) : null].filter(Boolean).join(' · '),
      moment: o.created_at, href: `/dashboard/orders/${o.id}`,
    })),
    ...offertes.slice(0, 8).map((o) => ({
      id: `q-${o.id}`, soort: 'offerte' as const,
      titel: `Offerte #${o.offertenummer ?? '—'}`,
      detail: [orgNaam(o.organisaties), o.status, offerteWaarde(o) > 0 ? euro(offerteWaarde(o)) : null].filter(Boolean).join(' · '),
      moment: o.created_at, href: `/dashboard/offertes/${o.id}`,
    })),
    ...leads.slice(0, 8).map((l) => ({
      id: `l-${l.id}`, soort: 'lead' as const,
      titel: `Lead: ${l.name}`,
      detail: [l.company, l.status].filter(Boolean).join(' · '),
      moment: l.created_at, href: '/dashboard/leads',
    })),
    ...portaal.map((p) => ({
      id: `p-${p.id}`, soort: 'portaal' as const,
      titel: `Portaalbestelling${p.medewerker_naam ? ` van ${p.medewerker_naam}` : ''}`,
      detail: [orgNaam(p.organisaties), p.status, p.waarde ? euro(num(p.waarde)) : null].filter(Boolean).join(' · '),
      moment: p.created_at, href: p.organisatie_id ? `/dashboard/klanten/${p.organisatie_id}` : '/dashboard/klanten',
    })),
    ...facturen
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 8)
      .map((f) => ({
        id: `f-${f.id}`, soort: 'factuur' as const,
        titel: f.status === 'concept' ? `Conceptfactuur${f.factuurnummer ? ` ${f.factuurnummer}` : ''}` : `Factuur ${f.factuurnummer ?? ''}`.trim(),
        detail: [orgNaam(f.organisaties), f.status === 'concept' ? null : f.status, f.bedrag_excl ? euro(num(f.bedrag_excl)) : null].filter(Boolean).join(' · '),
        moment: f.created_at, href: `/dashboard/facturen/${f.id}`,
      })),
  ]
    .filter((a) => a.moment)
    .sort((a, b) => (a.moment < b.moment ? 1 : -1))
    .slice(0, 10);

  const vorigeMaandNaam = MAANDEN_KORT[Number(vorigeKey.slice(5, 7)) - 1];
  const huidigeMaandNaam = MAANDEN_KORT[maand - 1];

  return {
    vandaag,
    nuTijd: nu.tijd,
    periode: {
      huidig: dag === 1 ? `1 ${huidigeMaandNaam}` : `1–${dag} ${huidigeMaandNaam}`,
      vorige: vorigeDagMax === 1 ? `1 ${vorigeMaandNaam}` : `1–${vorigeDagMax} ${vorigeMaandNaam}`,
      vorigeMaandEinde: `eind ${vorigeMaandNaam}`,
    },
    maanden: keys.map((k) => per.get(k)!),
    omzet: {
      mtd: omzetMtd,
      vorigeMtd: omzetVorigeMtd,
      betaaldMtd,
      totaal12m,
      gemiddeld12m: maandenMetOmzet > 0 ? totaal12m / 12 : 0,
    },
    orders: {
      open: openOrders.length,
      oud14: openOrders.filter((o) => dagenOpen(o) > 14).length,
      nieuwMtd,
      nieuwVorigeMtd,
      wachtGoedkeuring: openOrders.filter((o) => o.goedkeuring_status === 'wacht').length,
      openWaarde: openOrders.reduce((t, o) => t + num(o.bedrag), 0),
      pijplijn,
      langst,
    },
    offertes: {
      openWaarde: openOffertes.reduce((t, o) => t + offerteWaarde(o), 0),
      verstuurd: openOffertes.filter((o) => o.status === 'verstuurd').length,
      concept: openOffertes.filter((o) => o.status === 'concept').length,
      geaccepteerd12m,
      afgewezen12m,
      nieuwMtd: offNieuwMtd,
      nieuwVorigeMtd: offNieuwVorige,
      bijnaVerlopen,
    },
    facturen: {
      open: openFacturen.reduce((t, f) => t + num(f.bedrag_incl), 0),
      openAantal: openFacturen.length,
      vervallenBedrag: vervallen.reduce((t, f) => t + num(f.bedrag_incl), 0),
      vervallenAantal: vervallen.length,
      openEindVorigeMaand: per.get(vorigeKey)!.openstaand,
      concepten: facturen.filter((f) => f.status === 'concept').length,
    },
    leads: {
      mtd: leadsMtd,
      vorigeMtd: leadsVorige,
      wachten: wachtend.length,
      opvolgen,
      eersteWachtend: oudsteWachtend ? oudsteWachtend.name : null,
    },
    passessiesOpenVerleden: passessies.filter((p) => p.datum && p.datum < vandaag).length,
    teBestellen: inkoopR.count ?? 0,
    agenda,
    topKlanten,
    activiteit,
  };
}
