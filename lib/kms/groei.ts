import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Marketing en sales: de actielijst (tabel marketing_acties) en de cijfers
 * waarop die acties sturen. De cijfers worden live gelezen uit de tabellen die
 * er al zijn (leads, reviews, nieuwsbrief, prospects, campagnes, portaal,
 * offertes, facturen). Niets wordt gekopieerd, dus er bestaat maar één bron.
 */

export const CATEGORIEEN = [
  { id: 'fundament', label: 'Fundament', uitleg: 'Live gaan, domein, meten, mail' },
  { id: 'website', label: 'Website en conversie', uitleg: 'Wat bezoekers overhaalt' },
  { id: 'seo', label: 'Vindbaarheid', uitleg: 'Google, Maps, lokale pagina’s, AI-antwoorden' },
  { id: 'bewijs', label: 'Bewijs en reviews', uitleg: 'Reviews, cases, foto’s, video' },
  { id: 'content', label: 'Content', uitleg: 'Kennisbank, nieuwsbrief, posts, pers' },
  { id: 'sales', label: 'Sales en opvolging', uitleg: 'Brieven, bellen, demo’s, grote werkgevers' },
  { id: 'netwerk', label: 'Netwerk en partners', uitleg: 'Verenigingen, parkmanagement, merken' },
  { id: 'klantbinding', label: 'Klantbinding', uitleg: 'Portaal, sparen, reparaties' },
  { id: 'systeem', label: 'Systeem en product', uitleg: 'Wat in het KMS en portaal erbij komt' },
] as const;
export type Categorie = (typeof CATEGORIEEN)[number]['id'];

export const EIGENAARS = [
  { id: 'tim', label: 'Tim' },
  { id: 'jessi', label: 'Jessi' },
  { id: 'claude', label: 'Claude (bouwen)' },
] as const;
export type Eigenaar = (typeof EIGENAARS)[number]['id'];

export const STATUSSEN = [
  { id: 'open', label: 'Open' },
  { id: 'bezig', label: 'Bezig' },
  { id: 'klaar', label: 'Klaar' },
  { id: 'geparkeerd', label: 'Geparkeerd' },
] as const;
export type ActieStatus = (typeof STATUSSEN)[number]['id'];

export const PRIORITEITEN = [
  { id: 1, label: 'Hoog' },
  { id: 2, label: 'Middel' },
  { id: 3, label: 'Laag' },
] as const;

export type MarketingActie = {
  id: string;
  titel: string;
  omschrijving: string | null;
  categorie: Categorie;
  eigenaar: Eigenaar;
  prioriteit: 1 | 2 | 3;
  status: ActieStatus;
  deadline: string | null;
  kpi: KpiId | null;
  notities: string | null;
  bron: string | null;
  volgorde: number;
  afgerond_op: string | null;
};

/** De cijfers. `href` wijst naar het scherm waar het cijfer vandaan komt: daar werk je het bij, niet hier. */
export const KPIS = [
  { id: 'leads_30d', label: 'Nieuwe leads', sub: 'laatste 30 dagen', href: '/dashboard/leads' },
  { id: 'lead_naar_offerte', label: 'Lead naar offerte', sub: 'leads van de laatste 90 dagen', href: '/dashboard/analyse' },
  { id: 'reviews_aantal', label: 'Reviews', sub: 'beantwoord, totaal', href: '/dashboard/reviews' },
  { id: 'reviews_score', label: 'Gemiddelde score', sub: 'van 0 tot 10', href: '/dashboard/reviews' },
  { id: 'nieuwsbrief_abonnees', label: 'Nieuwsbrief', sub: 'inschrijvingen', href: '/dashboard/nieuwsbrief' },
  { id: 'prospects_actief', label: 'Prospects', sub: 'in de lijst', href: '/dashboard/prospects' },
  { id: 'campagnes_actief', label: 'Mailcampagnes', sub: 'actief', href: '/dashboard/campagnes' },
  { id: 'portaal_klanten', label: 'Klanten in portaal', sub: 'met minstens één login', href: '/dashboard/portaalgebruik' },
  { id: 'offerte_waarde_open', label: 'Open offertes', sub: 'nog niet beslist', href: '/dashboard/offertes' },
  { id: 'omzet_30d', label: 'Omzet', sub: 'gefactureerd, 30 dagen, excl. btw', href: '/dashboard/facturen' },
] as const;
export type KpiId = (typeof KPIS)[number]['id'];
export type KpiWaarden = Partial<Record<KpiId, string>>;

const isCategorie = (v: unknown): v is Categorie => CATEGORIEEN.some((c) => c.id === v);
const isEigenaar = (v: unknown): v is Eigenaar => EIGENAARS.some((e) => e.id === v);
const isStatus = (v: unknown): v is ActieStatus => STATUSSEN.some((s) => s.id === v);
const isKpi = (v: unknown): v is KpiId => KPIS.some((k) => k.id === v);
export const leesCategorie = (v: unknown): Categorie => (isCategorie(v) ? v : 'website');
export const leesEigenaar = (v: unknown): Eigenaar => (isEigenaar(v) ? v : 'jessi');
export const leesStatus = (v: unknown): ActieStatus => (isStatus(v) ? v : 'open');
export const leesKpi = (v: unknown): KpiId | null => (isKpi(v) ? v : null);
export const leesPrioriteit = (v: unknown): 1 | 2 | 3 => (v === 1 || v === '1' ? 1 : v === 3 || v === '3' ? 3 : 2);

export type ActieLijst = { acties: MarketingActie[]; tabelOntbreekt: boolean };

export async function listMarketingActies(): Promise<ActieLijst> {
  const sb = kmsAdmin();
  if (!sb) return { acties: [], tabelOntbreekt: false };
  const { data, error } = await sb
    .from('marketing_acties')
    .select('id, titel, omschrijving, categorie, eigenaar, prioriteit, status, deadline, kpi, notities, bron, volgorde, afgerond_op')
    .order('prioriteit', { ascending: true })
    .order('volgorde', { ascending: true });
  if (error) return { acties: [], tabelOntbreekt: /does not exist|schema cache/i.test(error.message) };
  const acties = ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: String(r.id),
    titel: String(r.titel ?? ''),
    omschrijving: (r.omschrijving as string | null) ?? null,
    categorie: leesCategorie(r.categorie),
    eigenaar: leesEigenaar(r.eigenaar),
    prioriteit: leesPrioriteit(r.prioriteit),
    status: leesStatus(r.status),
    deadline: (r.deadline as string | null) ?? null,
    kpi: leesKpi(r.kpi),
    notities: (r.notities as string | null) ?? null,
    bron: (r.bron as string | null) ?? null,
    volgorde: Number(r.volgorde ?? 0),
    afgerond_op: (r.afgerond_op as string | null) ?? null,
  }));
  return { acties, tabelOntbreekt: false };
}

export type ActieInvoer = {
  titel: string;
  omschrijving: string | null;
  categorie: Categorie;
  eigenaar: Eigenaar;
  prioriteit: 1 | 2 | 3;
  status: ActieStatus;
  deadline: string | null;
  kpi: KpiId | null;
  notities: string | null;
};

export async function maakMarketingActie(v: ActieInvoer): Promise<string | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('marketing_acties')
    .insert({ ...v, volgorde: 9999, afgerond_op: v.status === 'klaar' ? new Date().toISOString() : null })
    .select('id')
    .single();
  return error ? null : String((data as { id: string }).id);
}

/** Werkt een of meer velden bij. Bij naar 'klaar' zetten komt de datum erbij, bij heropenen gaat hij weg. */
export async function werkMarketingActieBij(id: string, velden: Partial<ActieInvoer>): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !id) return false;
  const rij: Record<string, unknown> = { ...velden, updated_at: new Date().toISOString() };
  if (velden.status) rij.afgerond_op = velden.status === 'klaar' ? new Date().toISOString() : null;
  const { error } = await sb.from('marketing_acties').update(rij).eq('id', id);
  return !error;
}

export async function verwijderMarketingActie(id: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !id) return false;
  const { error } = await sb.from('marketing_acties').delete().eq('id', id);
  return !error;
}

const getal = (n: number) => n.toLocaleString('nl-NL');
const euro = (n: number) => n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** Telt rijen; geeft null als de tabel of kolom (nog) niet bestaat, zodat één ontbrekende bron de rest niet sloopt. */
async function tel(q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> {
  try {
    const { count, error } = await q;
    return error ? null : count ?? 0;
  } catch {
    return null;
  }
}

export async function kpiWaarden(): Promise<KpiWaarden> {
  const sb = kmsAdmin();
  if (!sb) return {};
  const nu = Date.now();
  const d30 = new Date(nu - 30 * 86_400_000).toISOString();
  const d90 = new Date(nu - 90 * 86_400_000).toISOString();
  const kop = { count: 'exact' as const, head: true };

  const [leads30, leads90, leads90Offerte, reviews, scores, nieuwsbrief, prospects, campagnes, portaal, offertesOpen, facturen] = await Promise.all([
    tel(sb.from('leads').select('id', kop).gte('created_at', d30)),
    tel(sb.from('leads').select('id', kop).gte('created_at', d90)),
    tel(sb.from('leads').select('id', kop).gte('created_at', d90).in('status', ['offerte', 'geaccordeerd'])),
    tel(sb.from('reviews').select('id', kop).not('score', 'is', null)),
    sb.from('reviews').select('score').not('score', 'is', null).limit(2000).then((r) => (r.error ? null : ((r.data as { score: number }[] | null) ?? []))),
    tel(sb.from('nieuwsbrief_inschrijvingen').select('id', kop)),
    tel(sb.from('prospecten').select('id', kop)),
    tel(sb.from('campagnes').select('id', kop).eq('status', 'actief')),
    sb.from('portaal_gebruikers').select('organisatie_id').then((r) => (r.error ? null : ((r.data as { organisatie_id: string | null }[] | null) ?? []))),
    tel(sb.from('offertes').select('id', kop).in('status', ['concept', 'verstuurd'])),
    sb.from('facturen').select('bedrag_excl').gte('factuurdatum', d30.slice(0, 10)).then((r) => (r.error ? null : ((r.data as { bedrag_excl: number | null }[] | null) ?? []))),
  ]);

  // Demo-klant telt niet mee als echte portaalklant.
  let portaalKlanten: number | null = null;
  if (portaal) {
    const ids = [...new Set(portaal.map((p) => p.organisatie_id).filter((v): v is string => Boolean(v)))];
    if (ids.length) {
      const { data } = await sb.from('organisaties').select('id, is_demo').in('id', ids);
      const demo = new Set(((data as { id: string; is_demo: boolean | null }[] | null) ?? []).filter((o) => o.is_demo).map((o) => o.id));
      portaalKlanten = ids.filter((id) => !demo.has(id)).length;
    } else portaalKlanten = 0;
  }

  const uit: KpiWaarden = {};
  if (leads30 != null) uit.leads_30d = getal(leads30);
  if (leads90 != null && leads90Offerte != null) uit.lead_naar_offerte = leads90 ? `${Math.round((leads90Offerte / leads90) * 100)}%` : '–';
  if (reviews != null) uit.reviews_aantal = getal(reviews);
  if (scores) uit.reviews_score = scores.length ? (scores.reduce((s, r) => s + Number(r.score), 0) / scores.length).toLocaleString('nl-NL', { maximumFractionDigits: 1 }) : '–';
  if (nieuwsbrief != null) uit.nieuwsbrief_abonnees = getal(nieuwsbrief);
  if (prospects != null) uit.prospects_actief = getal(prospects);
  if (campagnes != null) uit.campagnes_actief = getal(campagnes);
  if (portaalKlanten != null) uit.portaal_klanten = getal(portaalKlanten);
  if (offertesOpen != null) uit.offerte_waarde_open = getal(offertesOpen);
  if (facturen) uit.omzet_30d = euro(facturen.reduce((s, f) => s + Number(f.bedrag_excl ?? 0), 0));
  return uit;
}
