import { kmsAdmin } from '@/lib/kms/adminClient';

export type RecenteLead = { id: string; name: string; company: string | null; status: string; created_at: string };
export type Overzicht = {
  nieuweLeads: number;
  openOffertewaarde: number;
  openOrders: number;
  teBestellen: number;
  openFacturenBedrag: number;
  omzetMaand: number;
  // Vergelijkingen: een kaal getal zegt niets zonder de vorige periode ernaast.
  leadsDezeMaand: number;
  leadsVorigeMaand: number;
  omzetVorigeMaand: number;
  ordersLangerDanTweeWeken: number;
  vervallenFacturenBedrag: number;
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

  const maandVan = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const dezeMaand = maandVan(nu);
  const leadsDezeMaand = leads.filter((l) => l.created_at && maandVan(new Date(l.created_at)) === dezeMaand).length;
  const leadsVorigeMaand = leads.filter((l) => l.created_at && maandVan(new Date(l.created_at)) === dezeMaand - 1).length;
  const omzetVorigeMaand = facturen
    .filter((f) => f.status === 'betaald' && f.betaaldatum && maandVan(new Date(f.betaaldatum)) === dezeMaand - 1)
    .reduce((t, f) => t + (Number(f.bedrag_incl) || 0), 0);

  // Twee losse tellingen die de kale getallen hierboven duiding geven.
  const grens = new Date(nu.getTime() - 14 * 86_400_000).toISOString();
  const { data: oudeData } = await sb
    .from('orders').select('id').neq('status', 'afgerond').lt('besteldatum', grens);
  const ordersLangerDanTweeWeken = ((oudeData as { id: string }[]) ?? []).length;
  const vandaagIso = nu.toISOString().slice(0, 10);
  const { data: vervallenData } = await sb
    .from('facturen').select('bedrag_incl').not('status', 'in', '(betaald,concept)').lt('vervaldatum', vandaagIso);
  const vervallenFacturenBedrag = ((vervallenData as { bedrag_incl: number | null }[]) ?? [])
    .reduce((t, f) => t + (Number(f.bedrag_incl) || 0), 0);

  return { nieuweLeads, openOffertewaarde, openOrders, teBestellen, openFacturenBedrag, omzetMaand,
    leadsDezeMaand, leadsVorigeMaand, omzetVorigeMaand, ordersLangerDanTweeWeken, vervallenFacturenBedrag, recenteLeads };
}

export type VandaagSignalen = {
  openTaken: number;
  verlopenTaken: number;
  ordersWachtGoedkeuring: number;
  retourenTeBeoordelen: number;
  vervallenFacturen: number;
  voorraadOnderMinimum: number;
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

  const [takenR, ordersR, retourenR, facturenR, productenR] = await Promise.all([
    sb.from('taken').select('status, vervaldatum').eq('status', 'open'),
    sb.from('orders').select('goedkeuring_status'),
    sb.from('retouren').select('status'),
    sb.from('facturen').select('status, vervaldatum'),
    sb.from('producten').select('id, min_voorraad, product_varianten(voorraad)'),
  ]);

  const taken = (takenR.data as { status: string; vervaldatum: string | null }[]) ?? [];
  const orders = (ordersR.data as { goedkeuring_status: string }[]) ?? [];
  const retouren = (retourenR.data as { status: string }[]) ?? [];
  const facturen = (facturenR.data as { status: string; vervaldatum: string | null }[]) ?? [];
  const producten = (productenR.data as { id: string; min_voorraad: number | null; product_varianten: { voorraad: number | null }[] | null }[]) ?? [];

  const openTaken = taken.length;
  const verlopenTaken = taken.filter((t) => t.vervaldatum && t.vervaldatum < vandaag).length;
  const ordersWachtGoedkeuring = orders.filter((o) => o.goedkeuring_status === 'wacht').length;
  const retourenTeBeoordelen = retouren.filter((r) => r.status === 'aangemeld').length;
  const vervallenFacturen = facturen.filter(
    (f) => f.status !== 'betaald' && f.status !== 'concept' && f.vervaldatum && f.vervaldatum < vandaag,
  ).length;
  const voorraadOnderMinimum = producten.filter((p) => {
    if (p.min_voorraad == null) return false;
    const totaal = (p.product_varianten ?? []).reduce((s, v) => s + (Number(v.voorraad) || 0), 0);
    return totaal < p.min_voorraad;
  }).length;

  return { openTaken, verlopenTaken, ordersWachtGoedkeuring, retourenTeBeoordelen, vervallenFacturen, voorraadOnderMinimum };
}


export type WerklijstRij = {
  id: string;
  ordernummer: number | null;
  klant: string | null;
  status: string;
  goedkeuring_status: string;
  bedrag: number | null;
  besteldatum: string | null;
  dagenOpen: number;
};

/**
 * Wat er nu loopt: alle niet-afgeronde orders, oudste eerst.
 * `dagenOpen` telt vanaf de besteldatum en is het signaal waar het om gaat —
 * een order die twee weken stilstaat is een order waar iemand op wacht.
 */
export async function getWerklijst(limiet = 12): Promise<WerklijstRij[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('orders')
    .select('id, ordernummer, status, goedkeuring_status, bedrag, besteldatum, organisaties(naam)')
    .neq('status', 'afgerond')
    .order('besteldatum', { ascending: true })
    .limit(limiet);
  const rijen = (data as unknown as {
    id: string; ordernummer: number | null; status: string; goedkeuring_status: string;
    bedrag: number | null; besteldatum: string | null; organisaties: { naam: string } | null;
  }[]) ?? [];
  const nu = Date.now();
  return rijen.map((r) => ({
    id: r.id,
    ordernummer: r.ordernummer,
    klant: r.organisaties?.naam ?? null,
    status: r.status,
    goedkeuring_status: r.goedkeuring_status,
    bedrag: r.bedrag,
    besteldatum: r.besteldatum,
    dagenOpen: r.besteldatum ? Math.max(0, Math.floor((nu - new Date(r.besteldatum).getTime()) / 86_400_000)) : 0,
  }));
}
