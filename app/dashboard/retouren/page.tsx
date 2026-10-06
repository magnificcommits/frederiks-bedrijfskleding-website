import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import StatusChips from '@/components/dashboard/StatusChips';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import EmptyState from '@/components/dashboard/EmptyState';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';
import { kmsAdmin, dashAuthed, getHuidigeAdmin } from '@/lib/kms/adminClient';
import { listTaakPersonen, standaardPersoon } from '@/lib/kms/taakPersonen';
import {
  getRetourbeleid,
  listKlantKeuzesService,
  listRetouren,
  verkochtPerProduct,
  BESLISSING_LABEL,
  BRON_LABEL,
  ONDERDEEL_LABEL,
  REPARATIE_STATUSSEN,
  REPARATIE_STATUS_LABEL,
  RETOUR_BESLISSINGEN,
  RETOUR_SOORTEN,
  RETOUR_STATUSSEN,
  SOORT_LABEL,
  type Retourbeleid,
  type RetourMetLabels,
} from '@/lib/kms/service';
import UrlKeuze from '../klachten/UrlKeuze';
import { Kengetal, Legenda, MaandTrend, Staven, VerdelingBalk, type Deel } from '../klachten/grafieken';
import { perMaand } from '../klachten/analyse';
import { doorloopDagen, productSleutel, retourAnalyse } from './analyse';
import NieuwRetourFormulier from './NieuwRetourFormulier';
import { reparatieFactuur, reparatieKosten, reparatieStap, retourBeslissing, retourCreditfactuur, retourTaak, retourVervangendeOrder, wijzigRetourStatus } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Retouren', robots: { index: false, follow: false } };

type Zoek = {
  tab?: string;
  status?: string;
  reden?: string;
  beslissing?: string;
  soort?: string;
  klant?: string;
  product?: string;
  periode?: string;
  q?: string;
  id?: string;
  melding?: string;
  nieuw?: string;
};

const MELDINGEN: Record<string, { tekst: string; fout?: boolean }> = {
  aangemaakt: { tekst: 'Retour aangemeld.' },
  status: { tekst: 'Status bijgewerkt.' },
  beslissing: { tekst: 'Beslissing opgeslagen. De klant ziet hem in het portaal.' },
  'beslissing-gemaild': { tekst: 'Beslissing opgeslagen en naar de klant gemaild.' },
  'beslissing-niet-gemaild': { tekst: 'Beslissing opgeslagen, maar niet gemaild: mail is nog niet ingesteld of er is geen e-mailadres bekend.', fout: true },
  'beslissing-migratie': { tekst: 'Status opgeslagen. De beslissing zelf staat voorlopig in de instructie, tot de databasemigratie is gedraaid.', fout: true },
  order: { tekst: 'Vervangende conceptorder aangemaakt, regels op nul euro. Controleer maat en kleur op de order.' },
  'order-mislukt': { tekst: 'De vervangende order kon niet worden gemaakt. Is er een klant gekoppeld?', fout: true },
  credit: { tekst: 'Creditfactuur als concept klaargezet. Kijk hem na voordat je hem verstuurt.' },
  'credit-mislukt': { tekst: 'De creditfactuur kon niet worden gemaakt. Heeft de retour een klant en artikelregels?', fout: true },
  taak: { tekst: 'Taak aangemaakt. Je vindt hem onder Taken.' },
  'taak-mislukt': { tekst: 'De taak kon niet worden aangemaakt.', fout: true },
  kies: { tekst: 'Kies eerst een beslissing.', fout: true },
  'klant-nodig': { tekst: 'Kies een klant om de retour aan te koppelen.', fout: true },
  'reparatie-stap': { tekst: 'Reparatiestap bijgewerkt. De klant ziet de voortgang in het portaal.' },
  kosten: { tekst: 'Reparatiekosten opgeslagen.' },
  'kosten-ongeldig': { tekst: 'Vul een geldig bedrag in, bijvoorbeeld 12,50.', fout: true },
  'reparatie-factuur': { tekst: 'Factuur voor de reparatie als concept klaargezet.' },
  'reparatie-factuur-mislukt': { tekst: 'De factuur kon niet worden gemaakt. Zijn er kosten ingevuld en is er een klant gekoppeld?', fout: true },
  mislukt: { tekst: 'Opslaan is niet gelukt. Probeer het opnieuw.', fout: true },
};
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);

const statusBadge: Record<string, string> = {
  aangemeld: 'badge-actie',
  goedgekeurd: 'badge-rust',
  afgewezen: 'badge bg-red-100 text-red-700',
  verwerkt: 'badge-klaar',
};

function fmt(d: string | null) {
  if (!d) return '-';
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(d));
}
function dagenTekst(d: number | null) {
  if (d == null || !Number.isFinite(d)) return '-';
  if (d < 1) return 'binnen een dag';
  const n = d < 10 ? d.toFixed(1).replace('.', ',') : String(Math.round(d));
  return `${n} ${n === '1,0' ? 'dag' : 'dagen'}`;
}
function normaal(s: string | null | undefined) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
const pctTekst = (p: number | null) => (p == null ? '-' : `${String(p).replace('.', ',')}%`);
const retourNaam = (r: RetourMetLabels) => r.retournummer ?? (r.ordernummer ? `Order ${r.ordernummer}` : 'Zonder order');

const VERDELING: Pick<Deel, 'label' | 'toon'>[] = [
  { label: 'Te klein', toon: 'amber' },
  { label: 'Te groot', toon: 'donker' },
  { label: 'Andere reden', toon: 'licht' },
];
function verdeling(t: { klein: number; groot: number; overig: number }): Deel[] {
  return [
    { label: 'Te klein', waarde: t.klein, toon: 'amber' },
    { label: 'Te groot', waarde: t.groot, toon: 'donker' },
    { label: 'Andere reden', waarde: t.overig, toon: 'licht' },
  ];
}

export default async function RetourenPage({ searchParams }: { searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sb = kmsAdmin();
  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl panel p-8">
          <h1 className="dash-h1">Database nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen.</p>
          <Link href="/dashboard" className="mt-5 inline-block knop-stil">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const tab = sp.tab === 'analyse' ? 'analyse' : 'lijst';
  const periodeDagen = ['30', '90', '365'].includes(sp.periode ?? '') ? Number(sp.periode) : null;
  const jaar = new Date(Date.now() - 365 * 86_400_000);
  const [alle, beleid, klanten, verkochtJaar] = await Promise.all([
    listRetouren(),
    getRetourbeleid(),
    listKlantKeuzesService(),
    verkochtPerProduct(jaar),
  ]);

  // ---------- kengetallen (altijd over alles) ----------
  const open = alle.filter((r) => r.status === 'aangemeld' || r.status === 'goedgekeurd');
  const teBeoordelen = alle.filter((r) => r.status === 'aangemeld');
  const oudste = teBeoordelen.reduce<number | null>((m, r) => {
    const d = (Date.now() - new Date(r.created_at).getTime()) / 86_400_000;
    return m == null || d > m ? d : m;
  }, null);
  const doorloop = alle
    .filter((r) => Date.now() - new Date(r.created_at).getTime() <= 90 * 86_400_000)
    .map(doorloopDagen)
    .filter((d): d is number => d != null);
  const gemDoorloop = doorloop.length ? doorloop.reduce((a, b) => a + b, 0) / doorloop.length : null;
  // Reparaties tellen niet mee in het retourpercentage: daar gaat geen kleding terug in de voorraad.
  const zonderReparaties = alle.filter((r) => r.soort !== 'reparatie');
  const jaarAnalyse = retourAnalyse(zonderReparaties.filter((r) => new Date(r.created_at) >= jaar), verkochtJaar);
  const reparatiesOpen = alle.filter((r) => r.soort === 'reparatie' && r.status !== 'verwerkt' && r.status !== 'afgewezen');
  const reparatiesBijOns = reparatiesOpen.filter((r) => r.reparatie_status === 'ontvangen' || r.reparatie_status === 'in_reparatie');
  const hoogste = jaarAnalyse.producten.filter((p) => p.pct != null && p.verkocht >= 5).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];

  // ---------- filters ----------
  const status = (RETOUR_STATUSSEN as readonly string[]).includes(sp.status ?? '') ? sp.status! : '';
  const q = normaal(sp.q).trim();
  const inPeriode = (r: RetourMetLabels) => !periodeDagen || Date.now() - new Date(r.created_at).getTime() <= periodeDagen * 86_400_000;
  const basisFilter = (r: RetourMetLabels) =>
    inPeriode(r) &&
    (!sp.reden || r.redenLabel === sp.reden || r.regels.some((rg) => rg.reden === sp.reden)) &&
    (!sp.beslissing || (sp.beslissing === '-' ? !r.beslissing : r.beslissing === sp.beslissing)) &&
    (!sp.soort || r.soort === sp.soort) &&
    (!sp.klant || r.organisatie_id === sp.klant) &&
    (!sp.product || r.regels.some((rg) => productSleutel(rg) === sp.product)) &&
    (!q ||
      [r.organisatie_naam, r.retournummer, r.ordernummer, r.reden, r.contact_email, ...r.regels.map((rg) => `${rg.item_naam} ${rg.merk ?? ''} ${rg.maat ?? ''}`)]
        .map(normaal)
        .join(' ')
        .includes(q));
  const zonderStatus = alle.filter(basisFilter);
  const lijst = zonderStatus.filter((r) => !status || r.status === status);
  const perStatus: Record<string, number> = {};
  for (const r of zonderStatus) perStatus[r.status] = (perStatus[r.status] ?? 0) + 1;

  const gekozen = sp.id ? alle.find((r) => r.id === sp.id) ?? null : null;
  const huidigeQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== 'melding' && k !== 'nieuw') as [string, string][]).toString();
  const terug = `/dashboard/retouren${huidigeQs ? `?${huidigeQs}` : ''}`;
  const bewaar = { tab: sp.tab, reden: sp.reden, beslissing: sp.beslissing, soort: sp.soort, klant: sp.klant, product: sp.product, periode: sp.periode, q: sp.q };
  const metParam = (wijzig: Record<string, string | null>) => {
    const p = new URLSearchParams(huidigeQs);
    for (const [k, v] of Object.entries(wijzig)) (v ? p.set(k, v) : p.delete(k));
    const s = p.toString();
    return `/dashboard/retouren${s ? `?${s}` : ''}`;
  };
  const tabUrl = (t: string) => `/dashboard/retouren${t === 'analyse' ? `?tab=analyse${sp.periode ? `&periode=${sp.periode}` : ''}` : sp.periode ? `?periode=${sp.periode}` : ''}`;
  const melding = sp.melding ? MELDINGEN[sp.melding] : null;
  const klantNaam = sp.klant ? klanten.find((k) => k.id === sp.klant)?.naam ?? 'klant' : null;
  const productNaam = sp.product ? alle.flatMap((r) => r.regels).find((rg) => productSleutel(rg) === sp.product)?.item_naam ?? 'artikel' : null;
  const afwijkend = Object.keys(beleid.termijnPerKlant).length;

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Retouren</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/instellingen/service" className="knop-tekst">Retourbeleid</Link>
          <Drawer knop="Retour aanmelden" titel="Retour aanmelden" beschrijving="Voor een retour die aan de balie of telefonisch binnenkomt. Klanten melden zelf aan via het portaal of het retourformulier op de site.">
            <NieuwRetourFormulier klanten={klanten} redenen={beleid.redenen} />
          </Drawer>
        </div>
      </div>

      <p className="mt-3 max-w-3xl text-[13px] text-warm">
        Beoordeel aangemelde retouren, kies wat ermee gebeurt en zet de vervolgstap in gang.
        Retourtermijn: <span className="font-semibold text-ink-800">{beleid.termijnDagen} dagen</span>
        {afwijkend > 0 && <>, {afwijkend} {afwijkend === 1 ? 'klant' : 'klanten'} met een eigen termijn</>}.{' '}
        <Link href="/dashboard/instellingen/service" className="font-semibold text-amber-700 hover:underline">Beleid wijzigen</Link>
      </p>

      {melding && (
        <p className={`mt-4 rounded-md border px-4 py-2.5 text-[13px] font-semibold ${melding.fout ? 'border-amber-300 bg-amber-50 text-ink-800' : 'border-green-200 bg-green-50 text-green-800'}`} role="status">
          {melding.tekst}
          {sp.melding === 'order' && sp.nieuw && <> <Link href={`/dashboard/orders/${sp.nieuw}`} className="underline">Naar de order</Link></>}
          {sp.melding === 'credit' && sp.nieuw && <> <Link href={`/dashboard/facturen/${sp.nieuw}`} className="underline">Naar de creditfactuur</Link></>}
          {sp.melding === 'reparatie-factuur' && sp.nieuw && <> <Link href={`/dashboard/facturen/${sp.nieuw}`} className="underline">Naar de factuur</Link></>}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTegel label="Open" waarde={String(open.length)} href="/dashboard/retouren" sub={<span className="text-warm">aangemeld of goedgekeurd, nog niet verwerkt</span>} />
        <KpiTegel
          label="Te beoordelen"
          waarde={String(teBeoordelen.length)}
          href="/dashboard/retouren?status=aangemeld"
          sub={<span className={oudste != null && oudste > 2 ? 'font-semibold text-red-700' : 'text-warm'}>{oudste != null ? `oudste wacht ${dagenTekst(oudste)}` : 'niets te beoordelen'}</span>}
        />
        <KpiTegel label="Gem. doorlooptijd" waarde={dagenTekst(gemDoorloop)} href="/dashboard/retouren?tab=analyse" sub={<span className="text-warm">aanmelding tot afgehandeld, laatste 90 dagen</span>} />
        <KpiTegel
          label="Retourpercentage"
          waarde={pctTekst(jaarAnalyse.pct)}
          href="/dashboard/retouren?tab=analyse&periode=365"
          sub={<span className="text-warm">{hoogste ? `hoogst: ${hoogste.naam} ${pctTekst(hoogste.pct)}` : 'geretourneerde stuks t.o.v. verkocht, 12 mnd'}</span>}
        />
        <KpiTegel
          label="Reparaties open"
          waarde={String(reparatiesOpen.length)}
          href="/dashboard/retouren?soort=reparatie"
          sub={<span className="text-warm">{reparatiesBijOns.length ? `${reparatiesBijOns.length} bij ons in huis` : 'nog niet terug bij de klant'}</span>}
        />
      </div>

      <nav className="mt-5 flex gap-1 border-b border-line" aria-label="Weergave">
        {[
          { id: 'lijst', label: 'Retouren', n: open.length },
          { id: 'analyse', label: 'Analyse', n: null },
        ].map((t) => (
          <Link
            key={t.id}
            href={tabUrl(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-[13px] font-semibold ${tab === t.id ? 'border-amber-600 text-ink-900' : 'border-transparent text-warm hover:text-ink-800'}`}
          >
            {t.label}
            {t.n != null && <span className="chip-tel">{t.n}</span>}
          </Link>
        ))}
      </nav>

      {tab === 'analyse' ? (
        <AnalyseRetouren retouren={zonderReparaties.filter(inPeriode)} periodeDagen={periodeDagen} periode={sp.periode ?? ''} />
      ) : (
        <>
          <StatusChips basePath="/dashboard/retouren" huidig={status} statussen={RETOUR_STATUSSEN} aantallen={perStatus} bewaar={bewaar} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <LiveZoekveld placeholder="Zoek op klant, retournummer, order of artikel" vergeet={['melding', 'ok', 'fout', 'id', 'nieuw']} />
            <UrlKeuze param="soort" waarde={sp.soort ?? ''} label="Soort" leegLabel="Elke soort" opties={RETOUR_SOORTEN.map((x) => ({ value: x, label: SOORT_LABEL[x] }))} />
            <UrlKeuze param="reden" waarde={sp.reden ?? ''} label="Reden" leegLabel="Elke reden" opties={[...beleid.redenen, 'Niet opgegeven'].map((r) => ({ value: r, label: r }))} />
            <UrlKeuze param="beslissing" waarde={sp.beslissing ?? ''} label="Beslissing" leegLabel="Elke beslissing" opties={[...RETOUR_BESLISSINGEN.map((b) => ({ value: b, label: BESLISSING_LABEL[b] })), { value: '-', label: 'Nog geen beslissing' }]} />
            <UrlKeuze param="periode" waarde={sp.periode ?? ''} label="Periode" leegLabel="Altijd" opties={[{ value: '30', label: 'Laatste 30 dagen' }, { value: '90', label: 'Laatste 90 dagen' }, { value: '365', label: 'Laatste jaar' }]} />
            {klantNaam && <Link href={metParam({ klant: null, id: null })} className="chip chip-aan">Klant: {klantNaam} <span aria-hidden>×</span><span className="sr-only">filter wissen</span></Link>}
            {productNaam && <Link href={metParam({ product: null, id: null })} className="chip chip-aan">Artikel: {productNaam} <span aria-hidden>×</span><span className="sr-only">filter wissen</span></Link>}
          </div>

          <div className={`mt-4 grid gap-4 ${gekozen ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]' : ''}`}>
            <div className="min-w-0">
              {lijst.length === 0 ? (
                <EmptyState
                  titel={alle.length === 0 ? 'Nog geen retouren' : 'Niets gevonden'}
                  tekst={alle.length === 0 ? 'Retouren die klanten via het portaal of het retourformulier aanmelden, verschijnen hier vanzelf.' : 'Pas de filters aan of wis de zoekterm.'}
                />
              ) : (
                <div className="panel overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Aangemeld</th>
                        <th>Retour</th>
                        <th>Klant</th>
                        <th>Artikelen</th>
                        <th>Reden</th>
                        <th>Beslissing</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lijst.map((r) => (
                        <tr key={r.id} className={gekozen?.id === r.id ? 'bg-amber-50/60' : ''}>
                          <td className="stil whitespace-nowrap">{fmt(r.created_at)}</td>
                          <td className="whitespace-nowrap">
                            <Link href={metParam({ id: r.id })} className="rij-link">{retourNaam(r)}</Link>
                            {r.soort !== 'retour' && <span className={`ml-2 ${r.soort === 'reparatie' ? 'badge-actie' : 'badge-rust'}`}>{SOORT_LABEL[r.soort]}</span>}
                          </td>
                          <td className="max-w-[12rem] truncate">{r.organisatie_naam ?? 'Onbekende klant'}</td>
                          <td className="max-w-[16rem] truncate">
                            {r.regels.length ? (
                              <>
                                <span className="font-semibold tabular-nums">{r.aantalStuks}×</span> {r.regels[0].item_naam}
                                {r.regels.length > 1 && <span className="text-warm"> +{r.regels.length - 1}</span>}
                              </>
                            ) : (
                              <span className="text-warm">geen regels</span>
                            )}
                          </td>
                          <td className="max-w-[12rem] truncate stil">{r.redenLabel}</td>
                          <td className="whitespace-nowrap">
                            {r.soort === 'reparatie'
                              ? REPARATIE_STATUS_LABEL[r.reparatie_status ?? 'aangemeld']
                              : r.beslissing ? BESLISSING_LABEL[r.beslissing] : <span className="text-ink-400">-</span>}
                          </td>
                          <td><span className={statusBadge[r.status] ?? 'badge-rust'}>{r.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {gekozen && <RetourDetail r={gekozen} beleid={beleid} terug={terug} sluitUrl={metParam({ id: null })} />}
          </div>
        </>
      )}
    </main>
  );
}

async function RetourDetail({ r, beleid, terug, sluitUrl }: { r: RetourMetLabels; beleid: Retourbeleid; terug: string; sluitUrl: string }) {
  const [personen, admin] = await Promise.all([listTaakPersonen(), getHuidigeAdmin().catch(() => null)]);
  const actief = personen.filter((p) => p.actief);
  const beslissingStandaard = r.beslissing ?? 'goedkeuren';
  const afgerond = r.status === 'verwerkt' || r.status === 'afgewezen';
  const verborgen = (
    <>
      <input type="hidden" name="retourId" value={r.id} />
      <input type="hidden" name="terug" value={terug} />
    </>
  );

  return (
    <aside className="panel min-w-0 self-start xl:sticky xl:top-[7rem]" aria-label="Retour">
      <div className="flex items-start justify-between gap-3 border-b border-line p-4">
        <div className="min-w-0">
          <p className="text-[12px] text-warm">
            {SOORT_LABEL[r.soort]} {retourNaam(r)} · {BRON_LABEL[r.bron ?? ''] ?? 'Portaal'} · aangemeld {fmt(r.created_at)}
          </p>
          <h2 className="mt-0.5 truncate font-display text-lg font-bold text-ink-900">
            {r.organisatie_id ? <Link href={`/dashboard/klanten/${r.organisatie_id}`} className="hover:underline">{r.organisatie_naam ?? 'Klant'}</Link> : 'Onbekende klant'}
          </h2>
          <p className="mt-0.5 text-[12px] text-warm">
            {r.order_id && r.ordernummer ? <Link href={`/dashboard/orders/${r.order_id}`} className="font-semibold text-amber-700 hover:underline">Order {r.ordernummer}</Link> : 'Geen order gekoppeld'}
            {r.contact_email && <> · {r.contact_email}</>}
            {r.methode && <> · voorkeur: {r.methode}</>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Link href={sluitUrl} className="knop-tekst text-[12px]">Sluiten</Link>
          <span className={statusBadge[r.status] ?? 'badge-rust'}>{r.soort === 'reparatie' ? REPARATIE_STATUS_LABEL[r.reparatie_status ?? 'aangemeld'] : r.status}</span>
        </div>
      </div>

      <div className="border-b border-line p-4">
        <h3 className="veld-label">Artikelen</h3>
        {r.regels.length ? (
          <table className="tbl mt-1">
            <thead>
              <tr><th>Artikel</th><th>Maat</th><th className="num">Aantal</th><th>Reden</th></tr>
            </thead>
            <tbody>
              {r.regels.map((rg, i) => (
                <tr key={`${rg.orderregel_id}-${i}`}>
                  <td>
                    <span className="font-semibold text-ink-900">{rg.item_naam}</span>
                    {(rg.merk || rg.kleur) && <span className="block text-[12px] text-warm">{[rg.merk, rg.kleur].filter(Boolean).join(' · ')}</span>}
                  </td>
                  <td className="stil">{rg.maat ?? '-'}</td>
                  <td className="num">{rg.aantal}</td>
                  <td className="stil">{rg.reden ?? r.redenLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-1 text-[13px] text-warm">Geen artikelregels; zie de reden hieronder.</p>
        )}
        {r.reden && <p className="mt-3 whitespace-pre-line text-[13px] text-ink-800"><span className="font-semibold">Toelichting klant:</span> {r.reden}</p>}
        {r.fotos.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {r.fotos.map((f) => (
              <a key={f} href={f} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f} alt="Foto bij de retour" className="aspect-square w-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>

      {r.soort === 'reparatie' ? (
        <ReparatieDetail r={r} verborgen={verborgen} actief={actief} standaard={standaardPersoon(actief, admin?.email ?? null) ?? ''} />
      ) : (
      <>
      {/* Beslissing */}
      <form action={retourBeslissing} className="space-y-3 border-b border-line p-4">
        {verborgen}
        <h3 className="veld-label">Beslissing</h3>
        <div className="grid grid-cols-2 gap-1 rounded-md border border-line bg-mist p-0.5 sm:grid-cols-4">
          {RETOUR_BESLISSINGEN.map((b) => (
            <label key={b} className="cursor-pointer">
              <input type="radio" name="beslissing" value={b} defaultChecked={beslissingStandaard === b} className="peer sr-only" />
              <span className="block rounded px-2 py-1.5 text-center text-[12px] font-semibold text-warm peer-checked:bg-white peer-checked:text-ink-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300">
                {b === 'goedkeuren' ? 'Goedkeuren' : b === 'afkeuren' ? 'Afkeuren' : b === 'omruilen' ? 'Omruilen' : 'Creditnota'}
              </span>
            </label>
          ))}
        </div>
        <div>
          <label className="veld-label" htmlFor="rd-not">Toelichting voor de klant</label>
          <textarea id="rd-not" name="notitie" rows={2} defaultValue={r.beslissing_notitie ?? ''} className="veld" placeholder="Bijvoorbeeld: we sturen dezelfde broek in maat 54. Of: bedrukte artikelen kunnen we niet terugnemen." />
        </div>
        <div>
          <label className="veld-label" htmlFor="rd-adres">Retouradres</label>
          <input id="rd-adres" name="retouradres" defaultValue={r.retouradres ?? beleid.retouradres} className="veld" />
        </div>
        <div>
          <label className="veld-label" htmlFor="rd-instr">Instructie</label>
          <textarea id="rd-instr" name="instructie" rows={2} defaultValue={r.instructie ?? beleid.instructie} className="veld" />
          <p className="veld-hint">Adres en instructie komen uit het retourbeleid; pas ze hier aan voor deze ene retour.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-[12px] text-ink-700">
            <input type="checkbox" name="mailen" defaultChecked={!r.beslissing} />
            Klant mailen
          </label>
          <VerzendKnop className="knop-donker" bezigTekst="Opslaan…">{r.beslissing ? 'Beslissing bijwerken' : 'Beslissing opslaan'}</VerzendKnop>
        </div>
      </form>

      {/* Vervolg */}
      <div className="space-y-3 p-4">
        <h3 className="veld-label">Vervolg</h3>
        <div className="flex flex-wrap gap-2">
          {r.vervolg_order_id ? (
            <Link href={`/dashboard/orders/${r.vervolg_order_id}`} className="knop-stil">Vervangende order bekijken</Link>
          ) : (
            (r.beslissing === 'omruilen' || !r.beslissing) && r.regels.length > 0 && (
              <form action={retourVervangendeOrder}>
                {verborgen}
                <VerzendKnop className={r.beslissing === 'omruilen' ? 'knop-primair' : 'knop-stil'} bezigTekst="Order maken…">Vervangende order maken</VerzendKnop>
              </form>
            )
          )}
          {r.creditfactuur_id ? (
            <Link href={`/dashboard/facturen/${r.creditfactuur_id}`} className="knop-stil">Creditfactuur bekijken</Link>
          ) : (
            (r.beslissing === 'creditnota' || !r.beslissing) && r.regels.length > 0 && (
              <form action={retourCreditfactuur}>
                {verborgen}
                <VerzendKnop className={r.beslissing === 'creditnota' ? 'knop-primair' : 'knop-stil'} bezigTekst="Klaarzetten…">Creditfactuur klaarzetten</VerzendKnop>
              </form>
            )
          )}
        </div>

        {r.taak_id ? (
          <p className="text-[13px] text-warm">Er hangt een taak aan deze retour. <Link href="/dashboard/taken" className="font-semibold text-amber-700 hover:underline">Naar Taken</Link></p>
        ) : (
          <form action={retourTaak} className="flex flex-wrap items-end gap-2">
            {verborgen}
            <div>
              <label className="veld-label" htmlFor="rd-persoon">Taak voor</label>
              <select id="rd-persoon" name="persoon_id" defaultValue={standaardPersoon(actief, admin?.email ?? null) ?? ''} className="veld w-auto">
                <option value="">Niemand</option>
                {actief.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
              </select>
            </div>
            <VerzendKnop className="knop-stil" bezigTekst="Aanmaken…">Taak aanmaken</VerzendKnop>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {!afgerond && r.status === 'goedgekeurd' && (
            <form action={wijzigRetourStatus}>
              {verborgen}
              <input type="hidden" name="status" value="verwerkt" />
              <VerzendKnop className="knop-donker" bezigTekst="Bezig…">Ontvangen en verwerkt</VerzendKnop>
            </form>
          )}
          <form action={wijzigRetourStatus} className="ml-auto flex items-center gap-2">
            {verborgen}
            <label className="text-[12px] text-warm" htmlFor="rd-status">Status</label>
            <AutoSubmitSelect
              name="status"
              defaultValue={r.status}
              aria-label="Status"
              className="veld w-auto py-1 text-[12px]"
              options={RETOUR_STATUSSEN.map((s) => ({ value: s, label: s }))}
            />
          </form>
        </div>
        {r.afgehandeld_op && <p className="text-[12px] text-warm">Afgehandeld op {fmt(r.afgehandeld_op)} ({dagenTekst(doorloopDagen(r))} na aanmelding).</p>}
      </div>
      </>
      )}
    </aside>
  );
}

/** Reparatie: geen beslissing of terugbetaling, wel stappen, kosten en een taak. */
function ReparatieDetail({
  r,
  verborgen,
  actief,
  standaard,
}: {
  r: RetourMetLabels;
  verborgen: React.ReactNode;
  actief: { id: string; naam: string }[];
  standaard: string;
}) {
  const huidig = r.reparatie_status ?? 'aangemeld';
  const index = REPARATIE_STATUSSEN.indexOf(huidig);
  const volgende = index >= 0 && index < 3 ? REPARATIE_STATUSSEN[index + 1] : null;
  const klaarOfVerder = huidig === 'klaar' || huidig === 'teruggestuurd' || huidig === 'opgehaald';
  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="veld-label">Wat is er kapot</h3>
        <p className="text-[13px] font-semibold text-ink-900">{r.reparatie_onderdeel ? ONDERDEEL_LABEL[r.reparatie_onderdeel] : 'Niet opgegeven'}</p>
      </div>

      <div>
        <h3 className="veld-label">Voortgang</h3>
        <ol className="mt-1 flex flex-wrap gap-1.5" aria-label="Stappen">
          {REPARATIE_STATUSSEN.map((s, i) => (
            <li key={s} aria-current={s === huidig ? 'step' : undefined}>
              <form action={reparatieStap}>
                {verborgen}
                <input type="hidden" name="stap" value={s} />
                <button
                  type="submit"
                  className={`chip ${s === huidig ? 'chip-aan' : i < index ? 'bg-green-50 text-green-800' : ''}`}
                  title={`Zet op ${REPARATIE_STATUS_LABEL[s].toLowerCase()}`}
                >
                  {REPARATIE_STATUS_LABEL[s]}
                </button>
              </form>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          {volgende && (
            <form action={reparatieStap}>
              {verborgen}
              <input type="hidden" name="stap" value={volgende} />
              <VerzendKnop className="knop-donker" bezigTekst="Bezig…">Naar: {REPARATIE_STATUS_LABEL[volgende]}</VerzendKnop>
            </form>
          )}
          {huidig === 'klaar' && (
            <>
              <form action={reparatieStap}>
                {verborgen}
                <input type="hidden" name="stap" value="teruggestuurd" />
                <VerzendKnop className="knop-donker" bezigTekst="Bezig…">Teruggestuurd</VerzendKnop>
              </form>
              <form action={reparatieStap}>
                {verborgen}
                <input type="hidden" name="stap" value="opgehaald" />
                <VerzendKnop className="knop-stil" bezigTekst="Bezig…">Opgehaald door klant</VerzendKnop>
              </form>
            </>
          )}
        </div>
        {r.afgehandeld_op && <p className="mt-2 text-[12px] text-warm">Terug bij de klant op {fmt(r.afgehandeld_op)} ({dagenTekst(doorloopDagen(r))} na aanmelding).</p>}
      </div>

      <div className="border-t border-line pt-3">
        <h3 className="veld-label">Kosten</h3>
        <form action={reparatieKosten} className="flex flex-wrap items-end gap-2">
          {verborgen}
          <div>
            <label htmlFor="rp-kosten" className="sr-only">Reparatiekosten excl. btw</label>
            <div className="flex items-center gap-1">
              <span className="text-[13px] text-warm">€</span>
              <input
                id="rp-kosten"
                name="kosten"
                inputMode="decimal"
                defaultValue={r.reparatie_kosten != null ? String(r.reparatie_kosten).replace('.', ',') : ''}
                placeholder="0,00"
                className="veld w-28"
              />
              <span className="text-[12px] text-warm">excl. btw</span>
            </div>
          </div>
          <VerzendKnop className="knop-stil" bezigTekst="Opslaan…">Opslaan</VerzendKnop>
        </form>
        <p className="veld-hint">Leeg laten als het gratis is (garantie of onze fout).</p>
        <div className="mt-2">
          {r.reparatie_factuur_id ? (
            <Link href={`/dashboard/facturen/${r.reparatie_factuur_id}`} className="knop-stil">Factuur bekijken</Link>
          ) : (
            r.reparatie_kosten != null && r.reparatie_kosten > 0 && (
              <form action={reparatieFactuur}>
                {verborgen}
                <VerzendKnop className={klaarOfVerder ? 'knop-primair' : 'knop-stil'} bezigTekst="Klaarzetten…">
                  Factuur klaarzetten ({euro(r.reparatie_kosten)})
                </VerzendKnop>
              </form>
            )
          )}
        </div>
      </div>

      <div className="border-t border-line pt-3">
        {r.taak_id ? (
          <p className="text-[13px] text-warm">Er hangt een taak aan deze reparatie. <Link href="/dashboard/taken" className="font-semibold text-amber-700 hover:underline">Naar Taken</Link></p>
        ) : (
          <form action={retourTaak} className="flex flex-wrap items-end gap-2">
            {verborgen}
            <div>
              <label className="veld-label" htmlFor="rp-persoon">Taak voor</label>
              <select id="rp-persoon" name="persoon_id" defaultValue={standaard} className="veld w-auto">
                <option value="">Niemand</option>
                {actief.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
              </select>
            </div>
            <VerzendKnop className="knop-stil" bezigTekst="Aanmaken…">Taak aanmaken</VerzendKnop>
          </form>
        )}
      </div>
    </div>
  );
}

async function AnalyseRetouren({ retouren, periodeDagen, periode }: { retouren: RetourMetLabels[]; periodeDagen: number | null; periode: string }) {
  const sinds = new Date(Date.now() - (periodeDagen ?? 365 * 5) * 86_400_000);
  const verkocht = await verkochtPerProduct(sinds);
  const a = retourAnalyse(retouren, verkocht);
  const periodeTekst = periode === '30' ? 'laatste 30 dagen' : periode === '90' ? 'laatste 90 dagen' : periode === '365' ? 'laatste jaar' : 'alles';
  const filterUrl = (k: string, v: string) => `/dashboard/retouren?${new URLSearchParams({ [k]: v, ...(periode ? { periode } : {}) }).toString()}`;
  const adviezen = [
    ...a.merken.filter((m) => m.advies && m.merk !== 'Onbekend merk').map((m) => ({ wat: m.merk, soort: 'merk', advies: m.advies!, n: m.klein + m.groot })),
    ...a.producten.filter((p) => p.advies).map((p) => ({ wat: p.naam, soort: 'artikel', advies: p.advies!, n: p.klein + p.groot })),
  ];

  if (retouren.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState titel="Nog niets om te analyseren" tekst="Zodra er retouren zijn, zie je hier per artikel, merk en maat waarom er iets terugkomt, en welke merken klein of groot vallen." />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-warm">Over {periodeTekst}: {retouren.length} retouren, {a.stuks} stuks.</p>
        <UrlKeuze param="periode" waarde={periode} label="Periode" leegLabel="Altijd" opties={[{ value: '30', label: 'Laatste 30 dagen' }, { value: '90', label: 'Laatste 90 dagen' }, { value: '365', label: 'Laatste jaar' }]} />
      </div>

      <section className="panel grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
        <Kengetal label="Geretourneerd" waarde={`${a.stuks} st.`} />
        <Kengetal label="Verkocht in dezelfde periode" waarde={`${a.totaalVerkocht} st.`} />
        <Kengetal label="Retourpercentage" waarde={pctTekst(a.pct)} sub="stuks terug t.o.v. verkocht" />
        <Kengetal label="Maatgerelateerd" waarde={a.stuks ? `${Math.round(((a.merken.reduce((n, m) => n + m.klein + m.groot, 0)) / a.stuks) * 100)}%` : '-'} sub="te klein of te groot" />
      </section>

      {adviezen.length > 0 && (
        <section className="panel border-amber-300 p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Maatadvies</h2>
          <p className="mb-2 text-[12px] text-warm">Gebaseerd op minstens 3 maatretouren die duidelijk één kant op vallen. Handig bij passen en bij advies aan de telefoon.</p>
          <ul className="space-y-1 text-[13px]">
            {adviezen.slice(0, 8).map((x) => (
              <li key={`${x.soort}-${x.wat}`}>
                <span className="font-semibold text-ink-900">{x.wat}</span> {x.advies}
                <span className="text-warm"> ({x.n} maatretouren{x.soort === 'merk' ? '' : ', dit artikel'}): adviseer een maat {x.advies === 'valt klein' ? 'groter' : 'kleiner'}.</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Redenen</h2>
          <p className="mb-3 text-[12px] text-warm">In stuks. Klik om de retouren te zien.</p>
          <Staven rijen={a.perReden.map((r, i) => ({ ...r, href: filterUrl('reden', r.label), nadruk: i === 0 }))} />
        </section>
        <section className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Per maand</h2>
          <p className="mb-3 text-[12px] text-warm">Geretourneerde stuks, laatste 12 maanden.</p>
          <MaandTrend maanden={perMaand(retouren, 12, (r) => r.aantalStuks || 1)} omschrijving="Geretourneerde stuks per maand" />
        </section>
      </div>

      <section className="panel overflow-x-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 p-4 pb-2">
          <div>
            <h2 className="font-display text-base font-bold text-ink-900">Per artikel</h2>
            <p className="text-[12px] text-warm">Retourpercentage = geretourneerde stuks gedeeld door verkochte stuks in dezelfde periode.</p>
          </div>
          <Legenda delen={VERDELING} />
        </div>
        <table className="tbl">
          <thead>
            <tr><th>Artikel</th><th>Merk</th><th className="num">Terug</th><th className="num">Verkocht</th><th className="num">%</th><th className="w-40">Waarom</th><th>Meest genoemd</th></tr>
          </thead>
          <tbody>
            {a.producten.slice(0, 25).map((p) => (
              <tr key={p.sleutel}>
                <td className="max-w-[16rem] truncate"><Link href={filterUrl('product', p.sleutel)} className="rij-link">{p.naam}</Link>{p.advies && <span className="badge-actie ml-2">{p.advies}</span>}</td>
                <td className="stil">{p.merk ?? '-'}</td>
                <td className="num">{p.stuks}</td>
                <td className="num stil">{p.verkocht || '-'}</td>
                <td className={`num ${p.pct != null && p.pct >= 10 ? 'font-semibold text-red-700' : ''}`}>{pctTekst(p.pct)}</td>
                <td><VerdelingBalk delen={verdeling(p)} /></td>
                <td className="stil max-w-[12rem] truncate">{p.topReden ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="panel overflow-x-auto">
          <div className="p-4 pb-2">
            <h2 className="font-display text-base font-bold text-ink-900">Per merk</h2>
            <p className="text-[12px] text-warm">Valt een merk steeds klein of groot, dan zie je dat hier.</p>
          </div>
          <table className="tbl">
            <thead><tr><th>Merk</th><th className="num">Terug</th><th className="w-40">Waarom</th><th>Advies</th></tr></thead>
            <tbody>
              {a.merken.map((m) => (
                <tr key={m.merk}>
                  <td className="font-semibold text-ink-900">{m.merk}</td>
                  <td className="num">{m.stuks}</td>
                  <td><VerdelingBalk delen={verdeling(m)} /></td>
                  <td>{m.advies ? <span className="badge-actie">{m.advies}</span> : <span className="text-ink-400">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel overflow-x-auto">
          <div className="p-4 pb-2">
            <h2 className="font-display text-base font-bold text-ink-900">Per maat</h2>
            <p className="text-[12px] text-warm">Welke maten komen het vaakst terug, en waarom.</p>
          </div>
          {a.maten.length ? (
            <table className="tbl">
              <thead><tr><th>Maat</th><th className="num">Terug</th><th className="w-40">Waarom</th><th className="num">Te klein</th><th className="num">Te groot</th></tr></thead>
              <tbody>
                {a.maten.map((m) => (
                  <tr key={m.maat}>
                    <td className="font-semibold text-ink-900">{m.maat}</td>
                    <td className="num">{m.stuks}</td>
                    <td><VerdelingBalk delen={verdeling(m)} /></td>
                    <td className="num stil">{m.klein || '-'}</td>
                    <td className="num stil">{m.groot || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 pb-4 text-[13px] text-warm">Nog geen retouren met een maat.</p>
          )}
        </section>
      </div>
    </div>
  );
}
