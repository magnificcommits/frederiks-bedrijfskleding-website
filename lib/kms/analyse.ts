import { kmsAdmin } from '@/lib/kms/adminClient';
import { ORDER_STATUS_LABEL, statusLabel, type MaandPunt } from '@/lib/kms/dashboardStats';
import {
  binnen,
  maandLabel,
  maandLabelLang,
  plusDagen,
  plusMaanden,
  twaalfMaandenTot,
  dagenTussen,
  lijstFilter,
  urlMet,
  type Bereik,
  type Periode,
} from '@/lib/kms/analysePeriode';
import {
  NIET_VERKOCHT,
  VRIJE_REGEL,
  dagenTussenMomenten,
  duurStat,
  inStukken,
  laadFacturen,
  laadKlanten,
  laadMedewerkers,
  laadOrders,
  laadRegels,
  laadStatusHistorie,
  nlDatum,
  normMaat,
  num,
  pagineer,
  vergelijkMaat,
  verrijkRegels,
  type Duur,
  type Order,
  type VerrijkteRegel,
} from '@/lib/kms/analyseData';

/**
 * Analyse: hoe gaat het en waarom. Eén functie per tabblad, zodat de pagina
 * alleen ophaalt wat het open tabblad nodig heeft. Definities gelijk aan de
 * startpagina; zie lib/kms/analyseData.ts.
 */

export type Paar = { nu: number; vorige: number | null };

const paar = (nu: number, vorige: number | null): Paar => ({ nu, vorige });
const somBinnen = <T>(lijst: T[], datum: (x: T) => string | null, waarde: (x: T) => number, b: Bereik | null) =>
  b ? lijst.reduce((t, x) => (binnen(datum(x), b) ? t + waarde(x) : t), 0) : null;

/* ================================================================== */
/* Verkoop                                                             */
/* ================================================================== */

export type KlantOmzet = { id: string | null; naam: string; omzet: number; vorige: number | null; aandeel: number; cumulatief: number; facturen: number };
export type BrancheOmzet = { branche: string; omzet: number; vorige: number | null; klanten: number };

export type VerkoopData = {
  omzet: Paar;
  betaald: number;
  orders: Paar;
  orderwaarde: Paar;
  gemOrder: Paar;
  klanten: Paar;
  nieuweKlanten: Paar;
  maanden: MaandPunt[];
  perKlant: { top: KlantOmzet[]; overig: { aantal: number; omzet: number }; totaalKlanten: number };
  perBranche: BrancheOmzet[];
  nieuwTerug: { nieuw: { klanten: number; omzet: number }; terug: { klanten: number; omzet: number } };
  heeftData: boolean;
};

export async function analyseVerkoop(p: Periode): Promise<VerkoopData> {
  const [facturen, orders, klanten] = await Promise.all([laadFacturen(), laadOrders(), laadKlanten()]);

  // Eerste factuur ooit per klant: daarmee is een klant "nieuw" in de periode.
  const eerste = new Map<string, string>();
  for (const f of facturen) {
    if (!f.organisatie_id || !f.factuurdatum) continue;
    const e = eerste.get(f.organisatie_id);
    if (!e || f.factuurdatum < e) eerste.set(f.organisatie_id, f.factuurdatum);
  }

  const omzetIn = (b: Bereik | null) => somBinnen(facturen, (f) => f.factuurdatum, (f) => num(f.bedrag_excl), b);
  const telOrders = (b: Bereik | null) => (b ? orders.filter((o) => binnen(o.datum, b)).length : null);
  const geplaatst = (b: Bereik) => orders.filter((o) => binnen(o.datum, b) && o.status !== 'concept');
  const waardeIn = (b: Bereik | null) => (b ? geplaatst(b).reduce((t, o) => t + num(o.bedrag), 0) : null);
  const gemIn = (b: Bereik | null) => {
    if (!b) return null;
    const met = geplaatst(b).filter((o) => num(o.bedrag) > 0);
    return met.length ? met.reduce((t, o) => t + num(o.bedrag), 0) / met.length : 0;
  };
  const klantenIn = (b: Bereik | null) =>
    b ? new Set(facturen.filter((f) => binnen(f.factuurdatum, b) && f.organisatie_id).map((f) => f.organisatie_id)).size : null;
  const nieuwIn = (b: Bereik | null) => (b ? [...eerste.values()].filter((d) => binnen(d, b)).length : null);

  /* Maandreeks: twaalf maanden tot het eind van de periode, zelfde opbouw als de startpagina. */
  const keys = twaalfMaandenTot(p.tot);
  const per = new Map<string, MaandPunt>();
  keys.forEach((k, i) =>
    per.set(k, {
      key: k,
      label: maandLabel(k, i === 0 || k.endsWith('-01')),
      labelLang: maandLabelLang(k),
      gefactureerd: 0, betaald: 0, orderwaarde: 0, orders: 0, offertes: 0, leads: 0, openstaand: 0,
    }),
  );
  for (const f of facturen) {
    const m = f.factuurdatum ? per.get(f.factuurdatum.slice(0, 7)) : undefined;
    if (!m) continue;
    m.gefactureerd += num(f.bedrag_excl);
    if (f.status === 'betaald') m.betaald += num(f.bedrag_excl);
  }
  for (const o of orders) {
    const m = o.datum ? per.get(o.datum.slice(0, 7)) : undefined;
    if (!m) continue;
    m.orders += 1;
    if (o.status !== 'concept') m.orderwaarde += num(o.bedrag);
  }

  /* Per klant: top tien en de rest als lange staart. */
  const inPeriode = facturen.filter((f) => binnen(f.factuurdatum, p));
  const perKlant = new Map<string, { id: string | null; omzet: number; vorige: number; facturen: number }>();
  for (const f of inPeriode) {
    const k = f.organisatie_id ?? 'onbekend';
    const r = perKlant.get(k) ?? { id: f.organisatie_id, omzet: 0, vorige: 0, facturen: 0 };
    r.omzet += num(f.bedrag_excl);
    r.facturen += 1;
    perKlant.set(k, r);
  }
  if (p.vgl) {
    for (const f of facturen) {
      if (!binnen(f.factuurdatum, p.vgl)) continue;
      const r = perKlant.get(f.organisatie_id ?? 'onbekend');
      if (r) r.vorige += num(f.bedrag_excl);
    }
  }
  const totaal = omzetIn(p) ?? 0;
  const gesorteerd = [...perKlant.values()].filter((r) => r.omzet !== 0).sort((a, b) => b.omzet - a.omzet);
  let cum = 0;
  const top: KlantOmzet[] = gesorteerd.slice(0, 10).map((r) => {
    cum += r.omzet;
    return {
      id: r.id,
      naam: (r.id && klanten.get(r.id)?.naam) || 'Onbekende klant',
      omzet: r.omzet,
      vorige: p.vgl ? r.vorige : null,
      aandeel: totaal ? r.omzet / totaal : 0,
      cumulatief: totaal ? cum / totaal : 0,
      facturen: r.facturen,
    };
  });
  const rest = gesorteerd.slice(10);

  /* Per branche */
  const perBranche = new Map<string, { omzet: number; vorige: number; klanten: Set<string> }>();
  const brancheVan = (id: string | null) => (id && klanten.get(id)?.branche?.trim()) || 'Geen branche ingevuld';
  for (const f of facturen) {
    const nu = binnen(f.factuurdatum, p);
    const vorig = binnen(f.factuurdatum, p.vgl);
    if (!nu && !vorig) continue;
    const b = brancheVan(f.organisatie_id);
    const r = perBranche.get(b) ?? { omzet: 0, vorige: 0, klanten: new Set<string>() };
    if (nu) { r.omzet += num(f.bedrag_excl); if (f.organisatie_id) r.klanten.add(f.organisatie_id); }
    if (vorig) r.vorige += num(f.bedrag_excl);
    perBranche.set(b, r);
  }

  /* Nieuw versus terugkerend */
  const nieuwTerug = { nieuw: { klanten: 0, omzet: 0 }, terug: { klanten: 0, omzet: 0 } };
  for (const r of perKlant.values()) {
    if (!r.id) continue;
    const isNieuw = binnen(eerste.get(r.id), p);
    const doel = isNieuw ? nieuwTerug.nieuw : nieuwTerug.terug;
    doel.klanten += 1;
    doel.omzet += r.omzet;
  }

  return {
    omzet: paar(totaal, omzetIn(p.vgl)),
    betaald: inPeriode.filter((f) => f.status === 'betaald').reduce((t, f) => t + num(f.bedrag_excl), 0),
    orders: paar(telOrders(p) ?? 0, telOrders(p.vgl)),
    orderwaarde: paar(waardeIn(p) ?? 0, waardeIn(p.vgl)),
    gemOrder: paar(gemIn(p) ?? 0, gemIn(p.vgl)),
    klanten: paar(klantenIn(p) ?? 0, klantenIn(p.vgl)),
    nieuweKlanten: paar(nieuwIn(p) ?? 0, nieuwIn(p.vgl)),
    maanden: keys.map((k) => per.get(k)!),
    perKlant: { top, overig: { aantal: rest.length, omzet: rest.reduce((t, r) => t + r.omzet, 0) }, totaalKlanten: gesorteerd.length },
    perBranche: [...perBranche.entries()]
      .map(([branche, r]) => ({ branche, omzet: r.omzet, vorige: p.vgl ? r.vorige : null, klanten: r.klanten.size }))
      .filter((b) => b.omzet !== 0 || (b.vorige ?? 0) !== 0)
      .sort((a, b) => b.omzet - a.omzet),
    nieuwTerug,
    heeftData: facturen.length > 0 || orders.length > 0,
  };
}

/* ================================================================== */
/* Producten                                                           */
/* ================================================================== */

export type ProductGroep = {
  sleutel: string;
  label: string;
  stuks: number;
  omzet: number;
  /** Marge over de regels waarvan de inkoopprijs bekend is. */
  marge: number | null;
  margePct: number | null;
  /** Deel van de omzet waarvoor een inkoopprijs bekend is (0–1). */
  dekking: number;
  href: string | null;
};

export type ProductenData = {
  stuks: Paar;
  omzet: Paar;
  regels: number;
  vrijeRegels: number;
  marge: { bedrag: number; pct: number | null; dekking: number };
  perCategorie: ProductGroep[];
  perMerk: ProductGroep[];
  perProduct: ProductGroep[];
  perKleur: ProductGroep[];
  perMaat: ProductGroep[];
  maatMatrix: { maten: string[]; rijen: { categorie: string; perMaat: Record<string, number>; totaal: number }[] };
};

function groepeer(
  regels: VerrijkteRegel[],
  sleutelVan: (r: VerrijkteRegel) => string,
  labelVan: (r: VerrijkteRegel) => string,
  hrefVan: (r: VerrijkteRegel) => string | null,
): ProductGroep[] {
  const kaart = new Map<string, ProductGroep & { margeOmzet: number }>();
  for (const r of regels) {
    const k = sleutelVan(r);
    const g = kaart.get(k) ?? { sleutel: k, label: labelVan(r), stuks: 0, omzet: 0, marge: null, margePct: null, dekking: 0, href: hrefVan(r), margeOmzet: 0 };
    g.stuks += r.stuks;
    g.omzet += r.omzet;
    if (r.inkoop !== null) {
      g.marge = (g.marge ?? 0) + (num(r.stukprijs) - r.inkoop) * r.stuks;
      g.margeOmzet += r.omzet;
    }
    kaart.set(k, g);
  }
  return [...kaart.values()]
    .map(({ margeOmzet, ...g }) => ({
      ...g,
      margePct: g.marge !== null && margeOmzet > 0 ? g.marge / margeOmzet : null,
      dekking: g.omzet > 0 ? margeOmzet / g.omzet : 0,
    }))
    .sort((a, b) => b.stuks - a.stuks || b.omzet - a.omzet);
}

export async function analyseProducten(p: Periode, klantId?: string): Promise<ProductenData> {
  const orders = await laadOrders();
  const telt = (o: Order) => !NIET_VERKOCHT.has(o.status) && (!klantId || o.organisatie_id === klantId);
  const nuIds = new Set(orders.filter((o) => telt(o) && binnen(o.datum, p)).map((o) => o.id));
  const vglIds = new Set(p.vgl ? orders.filter((o) => telt(o) && binnen(o.datum, p.vgl)).map((o) => o.id) : []);

  const alle = await laadRegels([...nuIds, ...vglIds]);
  const nuRegels = alle.filter((r) => nuIds.has(r.order_id));
  const vglRegels = alle.filter((r) => vglIds.has(r.order_id));
  const regels = await verrijkRegels(nuRegels);

  const stuks = regels.reduce((t, r) => t + r.stuks, 0);
  const omzet = regels.reduce((t, r) => t + r.omzet, 0);
  const metInkoop = regels.filter((r) => r.inkoop !== null);
  const margeBedrag = metInkoop.reduce((t, r) => t + (num(r.stukprijs) - (r.inkoop ?? 0)) * r.stuks, 0);
  const margeOmzet = metInkoop.reduce((t, r) => t + r.omzet, 0);

  const perMaat = groepeer(regels, (r) => normMaat(r.maat), (r) => normMaat(r.maat), () => null).sort((a, b) => vergelijkMaat(a.sleutel, b.sleutel));

  // Maatverdeling per categorie: voor de inkoop het nuttigste overzicht.
  const maten = perMaat.map((m) => m.sleutel);
  const matrix = new Map<string, { perMaat: Record<string, number>; totaal: number }>();
  for (const r of regels) {
    const rij = matrix.get(r.categorie) ?? { perMaat: {}, totaal: 0 };
    const m = normMaat(r.maat);
    rij.perMaat[m] = (rij.perMaat[m] ?? 0) + r.stuks;
    rij.totaal += r.stuks;
    matrix.set(r.categorie, rij);
  }

  return {
    stuks: paar(stuks, p.vgl ? vglRegels.reduce((t, r) => t + num(r.aantal), 0) : null),
    omzet: paar(omzet, p.vgl ? vglRegels.reduce((t, r) => t + num(r.aantal) * num(r.stukprijs), 0) : null),
    regels: regels.length,
    vrijeRegels: regels.filter((r) => r.vrij).length,
    marge: { bedrag: margeBedrag, pct: margeOmzet > 0 ? margeBedrag / margeOmzet : null, dekking: omzet > 0 ? margeOmzet / omzet : 0 },
    perCategorie: groepeer(regels, (r) => r.categorie, (r) => r.categorie, () => null),
    perMerk: groepeer(regels, (r) => r.merk, (r) => r.merk, (r) => (r.vrij || r.merk === 'Merk niet ingevuld' ? null : `/dashboard/producten?merk=${encodeURIComponent(r.merk)}`)),
    perProduct: groepeer(
      regels,
      (r) => r.productId ?? `vrij:${r.productNaam.toLowerCase()}`,
      (r) => (r.vrij ? `${r.productNaam} (${VRIJE_REGEL.toLowerCase()})` : r.productNaam),
      (r) => (r.productId ? `/dashboard/producten/${r.productId}` : null),
    ),
    perKleur: groepeer(regels, (r) => (r.kleur ?? '').trim().toLowerCase() || '-', (r) => r.kleur?.trim() || 'Geen kleur', () => null),
    perMaat,
    maatMatrix: {
      maten,
      rijen: [...matrix.entries()].map(([categorie, r]) => ({ categorie, ...r })).sort((a, b) => b.totaal - a.totaal),
    },
  };
}

/* ================================================================== */
/* Klanten                                                             */
/* ================================================================== */

export type KlantWaarde = {
  id: string;
  naam: string;
  branche: string | null;
  omzet12: number;
  orders12: number;
  gemOrder: number | null;
  laatste: string | null;
  medewerkers: number;
};
export type SlapendeKlant = { id: string; naam: string; laatste: string; dagen: number; omzetOoit: number; orders: number };
export type Potentieel = { id: string; naam: string; medewerkers: number; omzet12: number; perMedewerker: number; portaal: boolean };
export type PortaalKlant = { id: string; naam: string; gebruikers: number; bestellingen: number; waarde: number; laatste: string | null };

export type KlantenData = {
  venster: Bereik;
  waarde: KlantWaarde[];
  klanten12: number;
  gemKlantwaarde: number;
  slapend: SlapendeKlant[];
  slaapMaanden: number;
  potentieel: Potentieel[];
  portaal: {
    klantenMetPortaal: number;
    gebruikers: number;
    bestellingen: Paar;
    waarde: number;
    aandeelOrders: number | null;
    perKlant: PortaalKlant[];
  };
};

export async function analyseKlanten(p: Periode, slaapMaanden = 6): Promise<KlantenData> {
  const sb = kmsAdmin();
  const [facturen, orders, klanten, medewerkers, gebruikersR, bestellingenR] = await Promise.all([
    laadFacturen(),
    laadOrders(),
    laadKlanten(),
    laadMedewerkers(),
    sb
      ? pagineer<{ organisatie_id: string | null }>((a, b) => sb.from('portaal_gebruikers').select('organisatie_id').order('id').range(a, b))
      : Promise.resolve({ rijen: [], fout: null }),
    sb
      ? pagineer<{ organisatie_id: string | null; created_at: string; waarde: number | null }>((a, b) =>
          sb.from('portaal_bestellingen').select('organisatie_id, created_at, waarde').order('created_at').order('id').range(a, b),
        )
      : Promise.resolve({ rijen: [], fout: null }),
  ]);
  const naam = (id: string) => klanten.get(id)?.naam ?? 'Onbekende klant';

  const venster: Bereik = { van: plusDagen(plusMaanden(p.tot, -12), 1), tot: p.tot, label: '12 maanden' };
  const mwPer = new Map<string, number>();
  for (const m of medewerkers) if (m.organisatie_id && m.actief !== false) mwPer.set(m.organisatie_id, (mwPer.get(m.organisatie_id) ?? 0) + 1);

  /* Klantwaarde over twaalf maanden */
  const waarde = new Map<string, KlantWaarde>();
  const rij = (id: string) => {
    let r = waarde.get(id);
    if (!r) {
      r = { id, naam: naam(id), branche: klanten.get(id)?.branche ?? null, omzet12: 0, orders12: 0, gemOrder: null, laatste: null, medewerkers: mwPer.get(id) ?? 0 };
      waarde.set(id, r);
    }
    return r;
  };
  const laatste = new Map<string, string>();
  const ooit = new Map<string, { omzet: number; orders: number }>();
  const zetLaatste = (id: string | null, d: string | null) => {
    if (!id || !d) return;
    if (!laatste.has(id) || d > laatste.get(id)!) laatste.set(id, d);
  };
  for (const f of facturen) {
    if (!f.organisatie_id) continue;
    zetLaatste(f.organisatie_id, f.factuurdatum);
    const o = ooit.get(f.organisatie_id) ?? { omzet: 0, orders: 0 };
    o.omzet += num(f.bedrag_excl);
    ooit.set(f.organisatie_id, o);
    if (binnen(f.factuurdatum, venster)) rij(f.organisatie_id).omzet12 += num(f.bedrag_excl);
  }
  const orderWaarde12 = new Map<string, number>();
  for (const o of orders) {
    if (!o.organisatie_id || o.status === 'concept') continue;
    zetLaatste(o.organisatie_id, o.datum);
    const t = ooit.get(o.organisatie_id) ?? { omzet: 0, orders: 0 };
    t.orders += 1;
    ooit.set(o.organisatie_id, t);
    if (binnen(o.datum, venster)) {
      rij(o.organisatie_id).orders12 += 1;
      orderWaarde12.set(o.organisatie_id, (orderWaarde12.get(o.organisatie_id) ?? 0) + num(o.bedrag));
    }
  }
  for (const b of bestellingenR.rijen) zetLaatste(b.organisatie_id, nlDatum(b.created_at));
  for (const r of waarde.values()) {
    r.laatste = laatste.get(r.id) ?? null;
    r.gemOrder = r.orders12 ? (orderWaarde12.get(r.id) ?? 0) / r.orders12 : null;
  }
  const lijst = [...waarde.values()].filter((r) => r.omzet12 !== 0 || r.orders12 > 0).sort((a, b) => b.omzet12 - a.omzet12 || b.orders12 - a.orders12);
  const metOmzet = lijst.filter((r) => r.omzet12 > 0);

  /* Slapend: wel ooit iets afgenomen, maar niets sinds x maanden. */
  const grens = plusMaanden(p.vandaag, -slaapMaanden);
  const slapend: SlapendeKlant[] = [...laatste.entries()]
    .filter(([, d]) => d < grens)
    .map(([id, d]) => ({ id, naam: naam(id), laatste: d, dagen: dagenTussen(d, p.vandaag), omzetOoit: ooit.get(id)?.omzet ?? 0, orders: ooit.get(id)?.orders ?? 0 }))
    .sort((a, b) => b.omzetOoit - a.omzetOoit || b.orders - a.orders)
    .slice(0, 25);

  /* Groeipotentieel: veel medewerkers in het systeem, weinig omzet. */
  const portaalOrgs = new Set(gebruikersR.rijen.map((g) => g.organisatie_id).filter(Boolean) as string[]);
  const potentieel: Potentieel[] = [...mwPer.entries()]
    .filter(([, n]) => n >= 2)
    .map(([id, n]) => {
      const omzet12 = waarde.get(id)?.omzet12 ?? 0;
      return { id, naam: naam(id), medewerkers: n, omzet12, perMedewerker: omzet12 / n, portaal: portaalOrgs.has(id) };
    })
    .sort((a, b) => a.perMedewerker - b.perMedewerker || b.medewerkers - a.medewerkers)
    .slice(0, 15);

  /* Portaalgebruik */
  const gebruikersPer = new Map<string, number>();
  for (const g of gebruikersR.rijen) if (g.organisatie_id) gebruikersPer.set(g.organisatie_id, (gebruikersPer.get(g.organisatie_id) ?? 0) + 1);
  const portaalPer = new Map<string, PortaalKlant>();
  const pk = (id: string) => {
    let r = portaalPer.get(id);
    if (!r) { r = { id, naam: naam(id), gebruikers: gebruikersPer.get(id) ?? 0, bestellingen: 0, waarde: 0, laatste: null }; portaalPer.set(id, r); }
    return r;
  };
  for (const id of gebruikersPer.keys()) pk(id);
  let bestNu = 0, bestVorig = 0, waardeNu = 0;
  for (const b of bestellingenR.rijen) {
    const d = nlDatum(b.created_at);
    if (binnen(d, p.vgl)) bestVorig += 1;
    if (!b.organisatie_id) continue;
    const r = pk(b.organisatie_id);
    if (!r.laatste || (d && d > r.laatste)) r.laatste = d;
    if (binnen(d, p)) { r.bestellingen += 1; r.waarde += num(b.waarde); bestNu += 1; waardeNu += num(b.waarde); }
  }
  const ordersNu = orders.filter((o) => binnen(o.datum, p) && o.status !== 'concept').length;

  return {
    venster,
    waarde: lijst.slice(0, 25),
    klanten12: metOmzet.length,
    gemKlantwaarde: metOmzet.length ? metOmzet.reduce((t, r) => t + r.omzet12, 0) / metOmzet.length : 0,
    slapend,
    slaapMaanden,
    potentieel,
    portaal: {
      klantenMetPortaal: gebruikersPer.size,
      gebruikers: gebruikersR.rijen.length,
      bestellingen: paar(bestNu, p.vgl ? bestVorig : null),
      waarde: waardeNu,
      aandeelOrders: ordersNu + bestNu > 0 ? bestNu / (ordersNu + bestNu) : null,
      perKlant: [...portaalPer.values()].sort((a, b) => b.bestellingen - a.bestellingen || b.gebruikers - a.gebruikers).slice(0, 25),
    },
  };
}

/* ================================================================== */
/* Funnel: lead → offerte → order                                       */
/* ================================================================== */

export type BronRij = { bron: string; leads: number; offerte: number; gewonnen: number; verloren: number; waarde: number };

export type FunnelData = {
  leads: Paar;
  leadStatus: { nieuw: number; inBehandeling: number; offerte: number; gewonnen: number; verloren: number };
  leadConversie: number | null;
  gewonnenWaarde: number;
  perBron: BronRij[];
  offertes: {
    aangemaakt: Paar;
    verstuurd: number;
    geaccepteerd: number;
    afgewezen: number;
    open: number;
    conversie: number | null;
    waardeGeaccepteerd: number;
    waardeOpen: number;
  };
  orders: Paar;
  stappen: { label: string; aantal: number; href: string; uitleg: string }[];
  doorloop: {
    historie: boolean;
    leadNaarOfferte: Duur | null;
    offerteNaarAkkoord: Duur | null;
    orderNaarGeleverd: Duur | null;
  };
};

/** Een order is bij de klant zodra hij voor het eerst een van deze statussen krijgt. */
export const GELEVERD_STATUSSEN = new Set(['verzonden', 'factureren', 'afgerond']);

type LeadRij = { id: string; status: string; bron: string | null; created_at: string; offertewaarde: number | null };
type OfferteRij = {
  id: string; status: string; created_at: string; lead_id: string | null;
  offerteregels?: { aantal: number | null; stukprijs: number | null; korting_pct: number | null }[] | null;
};

export async function analyseFunnel(p: Periode): Promise<FunnelData> {
  const sb = kmsAdmin();
  const vroegste = p.vgl && p.vgl.van < p.van ? p.vgl.van : p.van;
  // Een dag speling: timestamps zijn UTC, de grens is Nederlandse tijd.
  const vanafTs = `${plusDagen(vroegste, -1)}T00:00:00Z`;

  const [leadsR, offertesR, orders, historie] = await Promise.all([
    sb
      ? pagineer<LeadRij>((a, b) =>
          sb.from('leads').select('id, status, bron, created_at, offertewaarde').gte('created_at', vanafTs).order('created_at').order('id').range(a, b),
        )
      : Promise.resolve({ rijen: [] as LeadRij[], fout: null }),
    sb
      ? pagineer<OfferteRij>((a, b) =>
          sb.from('offertes')
            .select('id, status, created_at, lead_id, offerteregels(aantal, stukprijs, korting_pct)')
            .gte('created_at', vanafTs)
            .order('created_at')
            .range(a, b),
        ).then(async (r) =>
          r.fout
            ? pagineer<OfferteRij>((a, b) =>
                sb.from('offertes').select('id, status, created_at, lead_id').gte('created_at', vanafTs).order('created_at').order('id').range(a, b),
              )
            : r,
        )
      : Promise.resolve({ rijen: [] as OfferteRij[], fout: null }),
    laadOrders(),
    laadStatusHistorie(`${plusDagen(p.van, -400)}T00:00:00Z`),
  ]);

  const leads = leadsR.rijen.map((l) => ({ ...l, datum: nlDatum(l.created_at) }));
  const offertes = offertesR.rijen.map((o) => ({ ...o, datum: nlDatum(o.created_at) }));
  const leadsNu = leads.filter((l) => binnen(l.datum, p));
  const offNu = offertes.filter((o) => binnen(o.datum, p));
  const waarde = (o: OfferteRij) =>
    (o.offerteregels ?? []).reduce((t, r) => t + num(r.aantal) * num(r.stukprijs) * (1 - num(r.korting_pct) / 100), 0);

  /* Leads */
  const st = { nieuw: 0, inBehandeling: 0, offerte: 0, gewonnen: 0, verloren: 0 };
  const perBron = new Map<string, BronRij>();
  for (const l of leadsNu) {
    const b = l.bron?.trim() || 'Onbekend';
    const r = perBron.get(b) ?? { bron: b, leads: 0, offerte: 0, gewonnen: 0, verloren: 0, waarde: 0 };
    r.leads += 1;
    if (l.status === 'nieuw') st.nieuw += 1;
    else if (l.status === 'contact' || l.status === 'afspraak') st.inBehandeling += 1;
    else if (l.status === 'offerte') { st.offerte += 1; r.offerte += 1; }
    else if (l.status === 'geaccordeerd') { st.gewonnen += 1; r.gewonnen += 1; r.offerte += 1; r.waarde += num(l.offertewaarde); }
    else if (l.status === 'afgewezen') { st.verloren += 1; r.verloren += 1; }
    perBron.set(b, r);
  }

  /* Offertes */
  const verstuurdSet = new Set(['verstuurd', 'geaccepteerd', 'afgewezen']);
  const offStat = {
    verstuurd: offNu.filter((o) => verstuurdSet.has(o.status)).length,
    geaccepteerd: offNu.filter((o) => o.status === 'geaccepteerd').length,
    afgewezen: offNu.filter((o) => o.status === 'afgewezen').length,
    open: offNu.filter((o) => o.status === 'concept' || o.status === 'verstuurd').length,
  };
  const ordersIn = (b: Bereik | null) => (b ? orders.filter((o) => binnen(o.datum, b) && o.status !== 'concept').length : null);
  const ordersNu = ordersIn(p) ?? 0;

  /* Doorlooptijden */
  // Lead → offerte kan altijd: de offerte verwijst naar de lead.
  const leadIds = offNu.map((o) => o.lead_id).filter((x): x is string => !!x);
  const bekend = new Map(leads.map((l) => [l.id, l.created_at]));
  const ontbrekend = leadIds.filter((id) => !bekend.has(id));
  if (sb && ontbrekend.length) {
    const extra = await inStukken<{ id: string; created_at: string }>(ontbrekend, (s) => sb.from('leads').select('id, created_at').in('id', s).limit(1000));
    for (const l of extra) bekend.set(l.id, l.created_at);
  }
  const leadNaarOfferte = duurStat(
    offNu.filter((o) => o.lead_id && bekend.has(o.lead_id)).map((o) => dagenTussenMomenten(bekend.get(o.lead_id!)!, o.created_at)),
  );

  let offerteNaarAkkoord: Duur | null = null;
  let orderNaarGeleverd: Duur | null = null;
  if (historie) {
    const perOfferte = new Map<string, { verstuurd?: string; akkoord?: string }>();
    const eersteGeleverd = new Map<string, string>();
    for (const e of historie) {
      if (e.entiteit === 'offerte') {
        const r = perOfferte.get(e.entiteit_id) ?? {};
        if (e.naar_status === 'verstuurd' && !r.verstuurd) r.verstuurd = e.moment;
        if (e.naar_status === 'geaccepteerd' && !r.akkoord) r.akkoord = e.moment;
        perOfferte.set(e.entiteit_id, r);
      } else if (e.entiteit === 'order' && GELEVERD_STATUSSEN.has(e.naar_status) && !eersteGeleverd.has(e.entiteit_id)) {
        eersteGeleverd.set(e.entiteit_id, e.moment);
      }
    }
    offerteNaarAkkoord = duurStat(
      [...perOfferte.values()]
        .filter((r) => r.verstuurd && r.akkoord && r.akkoord > r.verstuurd && binnen(nlDatum(r.akkoord), p))
        .map((r) => dagenTussenMomenten(r.verstuurd!, r.akkoord!)),
    );
    const orderPer = new Map(orders.map((o) => [o.id, o]));
    orderNaarGeleverd = duurStat(
      [...eersteGeleverd.entries()]
        .filter(([, m]) => binnen(nlDatum(m), p))
        .map(([id, m]) => {
          const o = orderPer.get(id);
          return o ? dagenTussenMomenten(o.besteldatum ?? o.created_at, m) : -1;
        }),
    );
  }

  return {
    leads: paar(leadsNu.length, p.vgl ? leads.filter((l) => binnen(l.datum, p.vgl)).length : null),
    leadStatus: st,
    leadConversie: st.gewonnen + st.verloren > 0 ? st.gewonnen / (st.gewonnen + st.verloren) : null,
    gewonnenWaarde: leadsNu.filter((l) => l.status === 'geaccordeerd').reduce((t, l) => t + num(l.offertewaarde), 0),
    perBron: [...perBron.values()].sort((a, b) => b.leads - a.leads || b.gewonnen - a.gewonnen),
    offertes: {
      aangemaakt: paar(offNu.length, p.vgl ? offertes.filter((o) => binnen(o.datum, p.vgl)).length : null),
      ...offStat,
      conversie: offStat.geaccepteerd + offStat.afgewezen > 0 ? offStat.geaccepteerd / (offStat.geaccepteerd + offStat.afgewezen) : null,
      waardeGeaccepteerd: offNu.filter((o) => o.status === 'geaccepteerd').reduce((t, o) => t + waarde(o), 0),
      waardeOpen: offNu.filter((o) => o.status === 'concept' || o.status === 'verstuurd').reduce((t, o) => t + waarde(o), 0),
    },
    orders: paar(ordersNu, ordersIn(p.vgl)),
    stappen: [
      { label: 'Leads', aantal: leadsNu.length, href: '/dashboard/leads', uitleg: 'binnengekomen aanvragen' },
      { label: 'Offertes', aantal: offNu.length, href: urlMet('/dashboard/offertes', lijstFilter(p)), uitleg: 'aangemaakt' },
      { label: 'Verstuurd', aantal: offStat.verstuurd, href: urlMet('/dashboard/offertes', lijstFilter(p), { status: 'verstuurd' }), uitleg: 'offertes bij de klant' },
      { label: 'Geaccepteerd', aantal: offStat.geaccepteerd, href: urlMet('/dashboard/offertes', lijstFilter(p), { status: 'geaccepteerd' }), uitleg: 'offertes akkoord' },
      { label: 'Orders', aantal: ordersNu, href: urlMet('/dashboard/orders', lijstFilter(p)), uitleg: 'geplaatst (geen concept)' },
    ],
    doorloop: { historie: historie !== null, leadNaarOfferte, offerteNaarAkkoord, orderNaarGeleverd },
  };
}

/* ================================================================== */
/* Operatie                                                            */
/* ================================================================== */

export type OpenStatus = { status: string; label: string; aantal: number; gemDagen: number; maxDagen: number; bedrag: number; href: string };
export type TeLaat = { id: string; ordernummer: number | null; klant: string; status: string; dagen: number };
export type Telling = { sleutel: string; label: string; aantal: number; href: string | null };

export type OperatieData = {
  norm: number;
  open: OpenStatus[];
  openTotaal: number;
  teLaat: TeLaat[];
  historie: boolean;
  tijdPerStatus: { status: string; label: string; gemDagen: number; n: number }[];
  geleverd: { aantal: number; opTijd: number; teLaat: number; doorloop: Duur | null } | null;
  retouren: { aantal: Paar; perReden: Telling[]; perStatus: Telling[]; pct: number | null; tabel: boolean };
  klachten: { aantal: Paar; perSoort: Telling[]; perStatus: Telling[]; open: number; tabel: boolean };
};

const STATUS_VOLGORDE = Object.keys(ORDER_STATUS_LABEL);

function tel<T>(lijst: T[], sleutel: (x: T) => string, href: (k: string) => string | null): Telling[] {
  const m = new Map<string, number>();
  for (const x of lijst) m.set(sleutel(x), (m.get(sleutel(x)) ?? 0) + 1);
  return [...m.entries()]
    .map(([k, aantal]) => ({ sleutel: k, label: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '), aantal, href: href(k) }))
    .sort((a, b) => b.aantal - a.aantal);
}

export async function analyseOperatie(p: Periode, norm = 14): Promise<OperatieData> {
  const sb = kmsAdmin();
  const vroegste = p.vgl && p.vgl.van < p.van ? p.vgl.van : p.van;
  const vanafTs = `${plusDagen(vroegste, -1)}T00:00:00Z`;
  type RetourRij = { id: string; reden: string | null; status: string; created_at: string };
  type KlachtRij = { id: string; soort: string | null; status: string; created_at: string };

  const [orders, klanten, historie, retourenR, klachtenR, openKlachtenR] = await Promise.all([
    laadOrders(),
    laadKlanten(),
    laadStatusHistorie(`${plusDagen(p.van, -400)}T00:00:00Z`),
    sb
      ? pagineer<RetourRij>((a, b) => sb.from('retouren').select('id, reden, status, created_at').gte('created_at', vanafTs).order('created_at').order('id').range(a, b))
      : Promise.resolve({ rijen: [] as RetourRij[], fout: null }),
    sb
      ? pagineer<KlachtRij>((a, b) => sb.from('klachten').select('id, soort, status, created_at').gte('created_at', vanafTs).order('created_at').order('id').range(a, b))
      : Promise.resolve({ rijen: [] as KlachtRij[], fout: null }),
    sb
      ? sb.from('klachten').select('id', { count: 'exact', head: true }).neq('status', 'afgehandeld')
      : Promise.resolve({ count: 0, error: null }),
  ]);

  /* Open orders per status, op dit moment */
  const open = orders.filter((o) => o.status !== 'afgerond' && o.status !== 'geannuleerd');
  const dagenOpen = (o: Order) => (o.datum ? Math.max(0, dagenTussen(o.datum, p.vandaag)) : 0);
  const perStatus = new Map<string, OpenStatus>();
  for (const o of open) {
    const r = perStatus.get(o.status) ?? { status: o.status, label: statusLabel(o.status), aantal: 0, gemDagen: 0, maxDagen: 0, bedrag: 0, href: `/dashboard/orders?status=${o.status}` };
    const d = dagenOpen(o);
    r.gemDagen = (r.gemDagen * r.aantal + d) / (r.aantal + 1);
    r.aantal += 1;
    r.maxDagen = Math.max(r.maxDagen, d);
    r.bedrag += num(o.bedrag);
    perStatus.set(o.status, r);
  }
  const volgorde = (s: string) => (STATUS_VOLGORDE.indexOf(s) + 1 || 99);

  // Te laat: in behandeling (geen concept of offerte meer) en langer open dan de norm.
  const inBehandeling = (o: Order) => o.status !== 'concept' && o.status !== 'offerte_verstuurd' && !GELEVERD_STATUSSEN.has(o.status);
  const teLaat: TeLaat[] = open
    .filter((o) => inBehandeling(o) && dagenOpen(o) > norm)
    .map((o) => ({
      id: o.id,
      ordernummer: o.ordernummer,
      klant: (o.organisatie_id && klanten.get(o.organisatie_id)?.naam) || 'Onbekende klant',
      status: statusLabel(o.status),
      dagen: dagenOpen(o),
    }))
    .sort((a, b) => b.dagen - a.dagen);

  /* Met statushistorie: tijd per status en levertijd */
  const tijdPerStatus: OperatieData['tijdPerStatus'] = [];
  let geleverd: OperatieData['geleverd'] = null;
  if (historie) {
    const orderPer = new Map(orders.map((o) => [o.id, o]));
    const perOrder = new Map<string, typeof historie>();
    for (const e of historie) {
      if (e.entiteit !== 'order') continue;
      const l = perOrder.get(e.entiteit_id) ?? [];
      l.push(e);
      perOrder.set(e.entiteit_id, l);
    }
    const duren = new Map<string, number[]>();
    const levertijden: number[] = [];
    for (const [id, events] of perOrder) {
      const o = orderPer.get(id);
      // De tijd in een status loopt tot de volgende wijziging. Telt mee als die wijziging in de periode valt.
      events.forEach((e, i) => {
        const begin = i === 0 ? (e.van_status && o ? o.besteldatum ?? o.created_at : null) : events[i - 1].moment;
        const status = i === 0 ? e.van_status : events[i - 1].naar_status;
        if (!begin || !status || !binnen(nlDatum(e.moment), p)) return;
        const l = duren.get(status) ?? [];
        l.push(dagenTussenMomenten(begin, e.moment));
        duren.set(status, l);
      });
      const eerste = events.find((e) => GELEVERD_STATUSSEN.has(e.naar_status));
      if (o && eerste && binnen(nlDatum(eerste.moment), p)) levertijden.push(dagenTussenMomenten(o.besteldatum ?? o.created_at, eerste.moment));
    }
    for (const [status, l] of duren) {
      const geldig = l.filter((d) => d >= 0);
      if (geldig.length) tijdPerStatus.push({ status, label: statusLabel(status), gemDagen: geldig.reduce((t, d) => t + d, 0) / geldig.length, n: geldig.length });
    }
    tijdPerStatus.sort((a, b) => volgorde(a.status) - volgorde(b.status));
    geleverd = {
      aantal: levertijden.length,
      opTijd: levertijden.filter((d) => d <= norm).length,
      teLaat: levertijden.filter((d) => d > norm).length,
      doorloop: duurStat(levertijden),
    };
  }

  /* Retouren en klachten */
  const retouren = retourenR.rijen.map((r) => ({ ...r, datum: nlDatum(r.created_at) }));
  const klachten = klachtenR.rijen.map((k) => ({ ...k, datum: nlDatum(k.created_at) }));
  const retNu = retouren.filter((r) => binnen(r.datum, p));
  const klNu = klachten.filter((k) => binnen(k.datum, p));
  const ordersNu = orders.filter((o) => binnen(o.datum, p) && o.status !== 'concept').length;

  return {
    norm,
    open: [...perStatus.values()].sort((a, b) => volgorde(a.status) - volgorde(b.status)),
    openTotaal: open.length,
    teLaat,
    historie: historie !== null,
    tijdPerStatus,
    geleverd,
    retouren: {
      aantal: paar(retNu.length, p.vgl ? retouren.filter((r) => binnen(r.datum, p.vgl)).length : null),
      perReden: tel(retNu, (r) => r.reden?.trim() || 'geen reden opgegeven', () => '/dashboard/retouren'),
      perStatus: tel(retNu, (r) => r.status, (s) => `/dashboard/retouren?status=${s}`),
      pct: ordersNu > 0 ? retNu.length / ordersNu : null,
      tabel: !retourenR.fout,
    },
    klachten: {
      aantal: paar(klNu.length, p.vgl ? klachten.filter((k) => binnen(k.datum, p.vgl)).length : null),
      perSoort: tel(klNu, (k) => k.soort?.trim() || 'onbekend', () => '/dashboard/klachten'),
      perStatus: tel(klNu, (k) => k.status, (s) => `/dashboard/klachten?status=${s}`),
      open: ('count' in openKlachtenR ? openKlachtenR.count : 0) ?? 0,
      tabel: !klachtenR.fout,
    },
  };
}

/* ================================================================== */
/* Voor de AI-samenvatting: de kern van alle tabbladen                  */
/* ================================================================== */

export async function analyseKernCijfers(p: Periode): Promise<Record<string, unknown>> {
  const [v, pr, k, f, o] = await Promise.all([
    analyseVerkoop(p),
    analyseProducten(p),
    analyseKlanten(p),
    analyseFunnel(p),
    analyseOperatie(p),
  ]);
  const r = (n: number | null | undefined, d = 0) => (n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d);
  return {
    periode: p.label,
    vergelijking: p.vgl ? p.vgl.label : 'geen',
    verkoop: {
      omzetExclBtw: r(v.omzet.nu), omzetVergelijking: r(v.omzet.vorige),
      orders: v.orders.nu, ordersVergelijking: v.orders.vorige,
      gemiddeldeOrderwaarde: r(v.gemOrder.nu), klantenMetFactuur: v.klanten.nu, nieuweKlanten: v.nieuweKlanten.nu,
      topKlanten: v.perKlant.top.slice(0, 3).map((t) => ({ naam: t.naam, omzet: r(t.omzet), aandeelPct: r(t.aandeel * 100) })),
      topBranches: v.perBranche.slice(0, 3).map((b) => ({ branche: b.branche, omzet: r(b.omzet) })),
    },
    producten: {
      stuks: pr.stuks.nu, stuksVergelijking: pr.stuks.vorige,
      vrijeRegels: pr.vrijeRegels, regels: pr.regels,
      margePct: pr.marge.pct === null ? null : r(pr.marge.pct * 100, 1), margeDekkingPct: r(pr.marge.dekking * 100),
      topCategorieen: pr.perCategorie.slice(0, 3).map((c) => ({ categorie: c.label, stuks: c.stuks })),
      topMerken: pr.perMerk.slice(0, 3).map((m) => ({ merk: m.label, stuks: m.stuks })),
      meestVerkochteMaten: [...pr.perMaat].sort((a, b) => b.stuks - a.stuks).slice(0, 4).map((m) => `${m.label}: ${m.stuks}`),
    },
    klanten: {
      klantenMetOmzet12m: k.klanten12, gemiddeldeKlantwaarde12m: r(k.gemKlantwaarde),
      slapendeKlanten: k.slapend.length, slapendSindsMaanden: k.slaapMaanden,
      groeipotentieel: k.potentieel.slice(0, 3).map((x) => ({ naam: x.naam, medewerkers: x.medewerkers, omzet12m: r(x.omzet12) })),
      portaalKlanten: k.portaal.klantenMetPortaal, portaalBestellingen: k.portaal.bestellingen.nu,
    },
    funnel: {
      leads: f.leads.nu, leadsVergelijking: f.leads.vorige, leadConversiePct: f.leadConversie === null ? null : r(f.leadConversie * 100),
      besteBronnen: f.perBron.slice(0, 3).map((b) => ({ bron: b.bron, leads: b.leads, gewonnen: b.gewonnen })),
      offertesAangemaakt: f.offertes.aangemaakt.nu, offertesGeaccepteerd: f.offertes.geaccepteerd,
      offerteConversiePct: f.offertes.conversie === null ? null : r(f.offertes.conversie * 100), openOffertewaarde: r(f.offertes.waardeOpen),
    },
    operatie: {
      openOrders: o.openTotaal, ordersLangerDanNorm: o.teLaat.length, normDagen: o.norm,
      retouren: o.retouren.aantal.nu, klachten: o.klachten.aantal.nu, openKlachten: o.klachten.open,
    },
  };
}
