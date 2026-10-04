import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import StatusChips from '@/components/dashboard/StatusChips';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import EmptyState from '@/components/dashboard/EmptyState';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import { kmsAdmin, dashAuthed, getHuidigeAdmin } from '@/lib/kms/adminClient';
import { listTaakPersonen, standaardPersoon } from '@/lib/kms/taakPersonen';
import {
  bekendeOorzaken,
  getKlachtBerichten,
  getKlachtInstellingen,
  listKlachten,
  listKlantKeuzesService,
  ordersVoorKlant,
  productenVanOrder,
  BRON_LABEL,
  KLACHT_PRIORITEITEN,
  KLACHT_SOORTEN,
  KLACHT_STATUSSEN,
  type KlachtMetLabels,
  type SlaStaat,
} from '@/lib/kms/service';
import NieuweKlachtFormulier from './NieuweKlachtFormulier';
import ProductZoeker from './ProductZoeker';
import UrlKeuze from './UrlKeuze';
import { klachtAnalyse, oplosUren, reactieUren } from './analyse';
import { Kengetal, MaandTrend, Staven, duurTekst } from './grafieken';
import { klachtBericht, sluitKlachtActie, werkKlachtBijActie, wijzigKlachtStatus } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Klachten en vragen', robots: { index: false, follow: false } };

type Zoek = {
  tab?: string;
  status?: string;
  categorie?: string;
  prioriteit?: string;
  wie?: string;
  soort?: string;
  sla?: string;
  periode?: string;
  q?: string;
  id?: string;
  melding?: string;
};

const MELDINGEN: Record<string, { tekst: string; fout?: boolean }> = {
  aangemaakt: { tekst: 'Vastgelegd. Hieronder kun je meteen antwoorden of een notitie maken.' },
  opgeslagen: { tekst: 'Opgeslagen.' },
  status: { tekst: 'Status bijgewerkt.' },
  beantwoord: { tekst: 'Antwoord opgeslagen. De klant ziet het in het portaal.' },
  gemaild: { tekst: 'Antwoord opgeslagen en gemaild. De klant ziet het ook in het portaal.' },
  'niet-gemaild': { tekst: 'Antwoord opgeslagen en zichtbaar in het portaal, maar niet gemaild: mail is nog niet ingesteld of er is geen e-mailadres bekend.', fout: true },
  notitie: { tekst: 'Interne notitie toegevoegd. De klant ziet deze niet.' },
  gesloten: { tekst: 'Afgehandeld.' },
  'gesloten-gemaild': { tekst: 'Afgehandeld en de oplossing is naar de klant gemaild.' },
  'gesloten-niet-gemaild': { tekst: 'Afgehandeld. De oplossing staat in het portaal, maar is niet gemaild (mail nog niet ingesteld of geen adres).', fout: true },
  'gesloten-migratie': { tekst: 'Afgehandeld. Oplossing en oorzaak worden pas bewaard na de databasemigratie.', fout: true },
  migratie: { tekst: 'Dit onderdeel werkt pas helemaal na de databasemigratie van 4 oktober. Status en antwoord zijn wel bewaard.', fout: true },
  leeg: { tekst: 'Typ eerst een bericht.', fout: true },
  'klant-nodig': { tekst: 'Kies een klant en vul een omschrijving in.', fout: true },
  mislukt: { tekst: 'Opslaan is niet gelukt. Probeer het opnieuw.', fout: true },
};

const statusBadge: Record<string, string> = {
  open: 'badge-actie',
  in_behandeling: 'badge-rust',
  afgehandeld: 'badge-klaar',
};

const prioBadge: Record<string, string> = {
  hoog: 'badge bg-red-100 text-red-700',
  normaal: 'badge-rust',
  laag: 'badge bg-white text-warm ring-1 ring-line',
};

const SLA_BADGE: Record<SlaStaat, { tekst: string; klasse: string } | null> = {
  te_laat: { tekst: 'Te laat', klasse: 'badge bg-red-600 text-white' },
  bijna: { tekst: 'Bijna', klasse: 'badge-actie' },
  op_tijd: null,
  gehaald: null,
  te_laat_gereageerd: { tekst: 'Laat beantwoord', klasse: 'badge bg-red-50 text-red-700' },
};

function fmt(d: string | null) {
  if (!d) return '-';
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(d));
}
function moment(d: string) {
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(d));
}
function statusLabel(s: string) {
  return s.replace(/_/g, ' ');
}
function normaal(s: string | null | undefined) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
/** "nog 3 u" of "2 u over tijd". */
function slaTekst(k: KlachtMetLabels): string {
  const verschil = (new Date(k.sla_reactie_voor).getTime() - Date.now()) / 3_600_000;
  if (k.sla === 'te_laat') return `${duurTekst(-verschil)} over de streeftijd`;
  if (k.sla === 'op_tijd' || k.sla === 'bijna') return `reageren binnen ${duurTekst(verschil)}`;
  const r = reactieUren(k);
  return r != null ? `eerste reactie na ${duurTekst(r)}` : 'beantwoord';
}

export default async function KlachtenPage({ searchParams }: { searchParams: Promise<Zoek> }) {
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
  const tab = sp.tab === 'analyse' ? 'analyse' : 'tickets';
  const [alle, inst, klanten, personen, admin] = await Promise.all([
    listKlachten(),
    getKlachtInstellingen(),
    listKlantKeuzesService(),
    listTaakPersonen(),
    getHuidigeAdmin().catch(() => null),
  ]);
  const actievePersonen = personen.filter((p) => p.actief);

  // ---------- filters ----------
  const status = (KLACHT_STATUSSEN as readonly string[]).includes(sp.status ?? '') ? sp.status! : '';
  const periodeDagen = ['30', '90', '365'].includes(sp.periode ?? '') ? Number(sp.periode) : null;
  const q = normaal(sp.q).trim();
  const inPeriode = (k: KlachtMetLabels) => !periodeDagen || Date.now() - new Date(k.created_at).getTime() <= periodeDagen * 86_400_000;
  const basisFilter = (k: KlachtMetLabels) =>
    inPeriode(k) &&
    (!sp.categorie || (sp.categorie === '-' ? !k.categorie : k.categorie === sp.categorie)) &&
    (!sp.prioriteit || k.prioriteit === sp.prioriteit) &&
    (!sp.soort || k.soort === sp.soort) &&
    (!sp.wie || (sp.wie === '-' ? !k.toegewezen_aan : k.toegewezen_aan === sp.wie)) &&
    (sp.sla !== 'te_laat' || k.sla === 'te_laat') &&
    (!q ||
      [k.organisatie_naam, k.omschrijving, k.ordernummer, k.product_naam, k.product_merk, k.contact_naam, k.medewerker_naam, k.categorie]
        .map(normaal)
        .join(' ')
        .includes(q));
  const zonderStatus = alle.filter(basisFilter);
  const lijst = zonderStatus.filter((k) => !status || k.status === status);
  const perStatus: Record<string, number> = {};
  for (const k of zonderStatus) perStatus[k.status] = (perStatus[k.status] ?? 0) + 1;

  const gekozen = sp.id ? alle.find((k) => k.id === sp.id) ?? null : null;

  // ---------- kengetallen (altijd over alles, laatste 90 dagen voor tijden) ----------
  const open = alle.filter((k) => k.status !== 'afgehandeld');
  const teLaat = open.filter((k) => k.sla === 'te_laat');
  const recent = alle.filter((k) => Date.now() - new Date(k.created_at).getTime() <= 90 * 86_400_000);
  const recentAnalyse = klachtAnalyse(recent);

  const huidigeQs = new URLSearchParams(
    Object.entries(sp).filter(([k, v]) => v && k !== 'melding') as [string, string][],
  ).toString();
  const terug = `/dashboard/klachten${huidigeQs ? `?${huidigeQs}` : ''}`;
  const bewaar = { tab: sp.tab, categorie: sp.categorie, prioriteit: sp.prioriteit, wie: sp.wie, soort: sp.soort, sla: sp.sla, periode: sp.periode, q: sp.q };
  const tabUrl = (t: string) => {
    const p = new URLSearchParams();
    if (t === 'analyse') p.set('tab', 'analyse');
    if (sp.periode) p.set('periode', sp.periode);
    const s = p.toString();
    return `/dashboard/klachten${s ? `?${s}` : ''}`;
  };
  const rijUrl = (id: string) => {
    const p = new URLSearchParams(huidigeQs);
    p.set('id', id);
    return `/dashboard/klachten?${p.toString()}`;
  };
  const sluitUrl = (() => {
    const p = new URLSearchParams(huidigeQs);
    p.delete('id');
    const s = p.toString();
    return `/dashboard/klachten${s ? `?${s}` : ''}`;
  })();
  const melding = sp.melding ? MELDINGEN[sp.melding] : null;

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Klachten en vragen</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/instellingen/service" className="knop-tekst">Categorieën en reactietijden</Link>
          <Drawer
            knop="Vraag of klacht vastleggen"
            titel="Vraag of klacht vastleggen"
            beschrijving="Bijvoorbeeld na een telefoontje of een mail. Wat via het portaal binnenkomt, staat er al vanzelf in."
            breedte="sm:max-w-3xl"
          >
            <NieuweKlachtFormulier
              klanten={klanten}
              categorieen={inst.categorieen}
              personen={actievePersonen.map((p) => ({ id: p.id, naam: p.naam }))}
              standaardPersoon={standaardPersoon(actievePersonen, admin?.email ?? null)}
            />
          </Drawer>
        </div>
      </div>

      <p className="mt-3 max-w-3xl text-[13px] text-warm">
        Hier leg je vragen en klachten van klanten vast en handel je ze af, of ze nu via het portaal binnenkomen of telefonisch.
        Elk ticket heeft een streefreactietijd; wat te laat dreigt te worden zie je meteen.
      </p>

      {melding && (
        <p className={`mt-4 rounded-md border px-4 py-2.5 text-[13px] font-semibold ${melding.fout ? 'border-amber-300 bg-amber-50 text-ink-800' : 'border-green-200 bg-green-50 text-green-800'}`} role="status">
          {melding.tekst}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTegel label="Open" waarde={String(open.length)} href="/dashboard/klachten?status=open" sub={<span className="text-warm">{open.filter((k) => !k.toegewezen_aan).length} niet toegewezen</span>} />
        <KpiTegel
          label="Te laat"
          waarde={String(teLaat.length)}
          href="/dashboard/klachten?sla=te_laat"
          sub={<span className={teLaat.length ? 'font-semibold text-red-700' : 'text-warm'}>{teLaat.length ? 'over de streefreactietijd' : 'alles binnen de streeftijd'}</span>}
        />
        <KpiTegel label="Gem. eerste reactie" waarde={duurTekst(recentAnalyse.gemReactieUren)} href="/dashboard/klachten?tab=analyse" sub={<span className="text-warm">laatste 90 dagen{recentAnalyse.slaPct != null ? ` · ${recentAnalyse.slaPct}% op tijd` : ''}</span>} />
        <KpiTegel label="Gem. oplostijd" waarde={duurTekst(recentAnalyse.gemOplosUren)} href="/dashboard/klachten?tab=analyse" sub={<span className="text-warm">van binnenkomst tot afgehandeld</span>} />
      </div>

      <nav className="mt-5 flex gap-1 border-b border-line" aria-label="Weergave">
        {[
          { id: 'tickets', label: 'Tickets', n: open.length },
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
        <Analyse klachten={alle.filter(inPeriode)} periode={sp.periode ?? ''} />
      ) : (
        <>
          <StatusChips basePath="/dashboard/klachten" huidig={status} statussen={KLACHT_STATUSSEN} aantallen={perStatus} bewaar={bewaar} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <LiveZoekveld placeholder="Zoek op klant, artikel, order of tekst" vergeet={['melding', 'ok', 'fout', 'id']} />
            <UrlKeuze param="categorie" waarde={sp.categorie ?? ''} label="Categorie" leegLabel="Alle categorieën" opties={[...inst.categorieen.map((c) => ({ value: c, label: c })), { value: '-', label: 'Niet ingedeeld' }]} />
            <UrlKeuze param="prioriteit" waarde={sp.prioriteit ?? ''} label="Prioriteit" leegLabel="Elke prioriteit" opties={KLACHT_PRIORITEITEN.map((p) => ({ value: p, label: `Prioriteit ${p}` }))} />
            <UrlKeuze param="wie" waarde={sp.wie ?? ''} label="Toegewezen aan" leegLabel="Iedereen" opties={[...actievePersonen.map((p) => ({ value: p.id, label: p.naam })), { value: '-', label: 'Niet toegewezen' }]} />
            <UrlKeuze param="soort" waarde={sp.soort ?? ''} label="Soort" leegLabel="Vragen en klachten" opties={KLACHT_SOORTEN.map((s) => ({ value: s, label: s === 'vraag' ? 'Alleen vragen' : 'Alleen klachten' }))} />
            <UrlKeuze param="periode" waarde={sp.periode ?? ''} label="Periode" leegLabel="Altijd" opties={[{ value: '30', label: 'Laatste 30 dagen' }, { value: '90', label: 'Laatste 90 dagen' }, { value: '365', label: 'Laatste jaar' }]} />
            <UrlKeuze param="sla" waarde={sp.sla ?? ''} label="Reactietijd" leegLabel="Elke reactietijd" opties={[{ value: 'te_laat', label: 'Alleen te laat' }]} />
          </div>

          <div className={`mt-4 grid gap-4 ${gekozen ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]' : ''}`}>
            <div className="min-w-0">
              {lijst.length === 0 ? (
                <EmptyState
                  titel={alle.length === 0 ? 'Nog geen vragen of klachten' : 'Niets gevonden'}
                  tekst={alle.length === 0 ? 'Zodra een klant via het portaal iets meldt of je een telefoontje vastlegt, staat het hier.' : 'Pas de filters aan of wis de zoekterm.'}
                />
              ) : (
                <div className="panel overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Binnen</th>
                        <th>Klant</th>
                        <th>Onderwerp</th>
                        <th>Prio</th>
                        <th>Wie</th>
                        <th>Reactie</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lijst.map((k) => {
                        const sla = SLA_BADGE[k.sla];
                        return (
                          <tr key={k.id} className={gekozen?.id === k.id ? 'bg-amber-50/60' : ''}>
                            <td className="stil whitespace-nowrap">{fmt(k.created_at)}</td>
                            <td className="max-w-[12rem] truncate">
                              <Link href={rijUrl(k.id)} className="rij-link">{k.organisatie_naam ?? 'Onbekende klant'}</Link>
                            </td>
                            <td className="max-w-[22rem]">
                              <Link href={rijUrl(k.id)} className="block truncate text-ink-800 hover:text-ink-900">
                                <span className={`mr-1.5 ${k.soort === 'klacht' ? 'font-semibold text-red-700' : 'text-warm'}`}>{k.soort === 'klacht' ? 'Klacht' : 'Vraag'}</span>
                                {k.categorie && <span className="mr-1.5 text-warm">{k.categorie} ·</span>}
                                {k.omschrijving}
                              </Link>
                            </td>
                            <td><span className={prioBadge[k.prioriteit]}>{k.prioriteit}</span></td>
                            <td className="stil whitespace-nowrap">{k.toegewezen_naam ?? '-'}</td>
                            <td className="whitespace-nowrap">{sla ? <span className={sla.klasse}>{sla.tekst}</span> : <span className="text-[12px] text-ink-400">{k.status === 'afgehandeld' ? '' : 'op tijd'}</span>}</td>
                            <td><span className={statusBadge[k.status] ?? 'badge-rust'}>{statusLabel(k.status)}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {gekozen && (
              <KlachtDetail
                k={gekozen}
                terug={terug}
                sluitUrl={sluitUrl}
                categorieen={inst.categorieen}
                personen={actievePersonen.map((p) => ({ id: p.id, naam: p.naam }))}
                oorzaken={bekendeOorzaken(alle)}
              />
            )}
          </div>
        </>
      )}
    </main>
  );
}

async function KlachtDetail({
  k,
  terug,
  sluitUrl,
  categorieen,
  personen,
  oorzaken,
}: {
  k: KlachtMetLabels;
  terug: string;
  sluitUrl: string;
  categorieen: string[];
  personen: { id: string; naam: string }[];
  oorzaken: string[];
}) {
  const [{ berichten, tabelBestaat }, orders, suggesties] = await Promise.all([
    getKlachtBerichten(k.id),
    k.organisatie_id ? ordersVoorKlant(k.organisatie_id) : Promise.resolve([]),
    k.order_id ? productenVanOrder(k.order_id) : Promise.resolve([]),
  ]);
  const sla = SLA_BADGE[k.sla];
  const catOpties = k.categorie && !categorieen.includes(k.categorie) ? [...categorieen, k.categorie] : categorieen;
  const afgehandeld = k.status === 'afgehandeld';
  const oplos = oplosUren(k);

  return (
    <aside className="panel min-w-0 self-start xl:sticky xl:top-[7rem]" aria-label="Details">
      <div className="flex items-start justify-between gap-3 border-b border-line p-4">
        <div className="min-w-0">
          <p className="text-[12px] text-warm">
            <span className={k.soort === 'klacht' ? 'font-semibold text-red-700' : ''}>{k.soort === 'klacht' ? 'Klacht' : 'Vraag'}</span>
            {' · '}{BRON_LABEL[k.bron] ?? k.bron}{' · '}{moment(k.created_at)}
          </p>
          <h2 className="mt-0.5 truncate font-display text-lg font-bold text-ink-900">
            {k.organisatie_id ? <Link href={`/dashboard/klanten/${k.organisatie_id}`} className="hover:underline">{k.organisatie_naam ?? 'Klant'}</Link> : 'Onbekende klant'}
          </h2>
          <p className="mt-0.5 text-[12px] text-warm">
            {k.contact_naam ?? k.medewerker_naam ?? 'Geen contactpersoon vastgelegd'}
            {k.order_id && k.ordernummer && (
              <> · <Link href={`/dashboard/orders/${k.order_id}`} className="font-semibold text-amber-700 hover:underline">order {k.ordernummer}</Link></>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Link href={sluitUrl} className="knop-tekst text-[12px]" aria-label="Paneel sluiten">Sluiten</Link>
          <span className={statusBadge[k.status] ?? 'badge-rust'}>{statusLabel(k.status)}</span>
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 text-[12px] ${k.sla === 'te_laat' ? 'bg-red-50' : 'bg-mist'}`}>
        {sla && <span className={sla.klasse}>{sla.tekst}</span>}
        <span className="text-ink-700">{slaTekst(k)}</span>
        {afgehandeld && oplos != null && <span className="text-warm">· opgelost in {duurTekst(oplos)}</span>}
      </div>

      {/* Ticketvelden */}
      <form action={werkKlachtBijActie} className="grid gap-3 border-b border-line p-4 sm:grid-cols-2">
        <input type="hidden" name="klachtId" value={k.id} />
        <input type="hidden" name="terug" value={terug} />
        <div>
          <label className="veld-label" htmlFor="kd-cat">Categorie</label>
          <select id="kd-cat" name="categorie" defaultValue={k.categorie ?? ''} className="veld">
            <option value="">Niet ingedeeld</option>
            {catOpties.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="veld-label" htmlFor="kd-prio">Prioriteit</label>
            <select id="kd-prio" name="prioriteit" defaultValue={k.prioriteit} className="veld">
              {KLACHT_PRIORITEITEN.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="veld-label" htmlFor="kd-soort">Soort</label>
            <select id="kd-soort" name="soort" defaultValue={k.soort} className="veld">
              {KLACHT_SOORTEN.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="veld-label" htmlFor="kd-wie">Toegewezen aan</label>
          <select id="kd-wie" name="toegewezen_aan" defaultValue={k.toegewezen_aan ?? ''} className="veld">
            <option value="">Niemand</option>
            {personen.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
          </select>
        </div>
        <div>
          <label className="veld-label" htmlFor="kd-order">Order</label>
          <select id="kd-order" name="order_id" defaultValue={k.order_id ?? ''} className="veld">
            <option value="">Geen order</option>
            {orders.map((o) => <option key={o.id} value={o.id}>Order {o.ordernummer ?? '-'}{o.besteldatum ? ` · ${fmt(o.besteldatum)}` : ''}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <ProductZoeker
            key={k.product_id ?? 'geen'}
            begin={k.product_id && k.product_naam ? { id: k.product_id, naam: k.product_naam, merk: k.product_merk } : null}
            suggesties={suggesties}
          />
        </div>
        <div className="sm:col-span-2">
          <VerzendKnop className="knop-stil" bezigTekst="Opslaan…">Velden opslaan</VerzendKnop>
        </div>
      </form>

      {/* Tijdlijn */}
      <div className="border-b border-line p-4">
        <h3 className="veld-label">Gesprek</h3>
        <ol className="mt-2 space-y-2">
          <li className="mr-8 rounded-md border border-line bg-white px-3 py-2">
            <p className="text-[11px] font-semibold text-warm">{k.contact_naam ?? k.medewerker_naam ?? 'Klant'} · {moment(k.created_at)}</p>
            <p className="mt-1 whitespace-pre-line text-[13px] text-ink-900">{k.omschrijving}</p>
          </li>
          {berichten.map((b) => (
            <li
              key={b.id}
              className={
                b.soort === 'notitie'
                  ? 'rounded-md border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2'
                  : b.soort === 'antwoord'
                    ? 'ml-8 rounded-md bg-ink-900 px-3 py-2 text-white'
                    : 'mr-8 rounded-md border border-line bg-white px-3 py-2'
              }
            >
              <p className={`text-[11px] font-semibold ${b.soort === 'antwoord' ? 'text-ink-200' : 'text-warm'}`}>
                {b.soort === 'notitie' ? 'Interne notitie' : b.soort === 'antwoord' ? 'Antwoord aan klant' : 'Reactie klant'}
                {b.auteur ? ` · ${b.auteur}` : ''} · {moment(b.created_at)}
                {b.soort === 'antwoord' && (b.gemaild_op ? ' · gemaild' : ' · alleen in portaal')}
              </p>
              <p className={`mt-1 whitespace-pre-line text-[13px] ${b.soort === 'antwoord' ? 'text-white' : 'text-ink-900'}`}>{b.tekst}</p>
            </li>
          ))}
          {!tabelBestaat && k.antwoord && (
            <li className="ml-8 rounded-md bg-ink-900 px-3 py-2 text-white">
              <p className="text-[11px] font-semibold text-ink-200">Antwoord aan klant</p>
              <p className="mt-1 whitespace-pre-line text-[13px]">{k.antwoord}</p>
            </li>
          )}
        </ol>

        <form action={klachtBericht} className="mt-3 space-y-2">
          <input type="hidden" name="klachtId" value={k.id} />
          <input type="hidden" name="terug" value={terug} />
          <div className="flex flex-wrap gap-1 rounded-md border border-line bg-mist p-0.5 text-[12px]">
            <label className="flex-1 cursor-pointer">
              <input type="radio" name="soort" value="antwoord" defaultChecked className="peer sr-only" />
              <span className="block rounded px-2 py-1 text-center font-semibold text-warm peer-checked:bg-white peer-checked:text-ink-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300">Antwoord aan klant</span>
            </label>
            <label className={`flex-1 ${tabelBestaat ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`} title={tabelBestaat ? undefined : 'Kan pas na de databasemigratie'}>
              <input type="radio" name="soort" value="notitie" disabled={!tabelBestaat} className="peer sr-only" />
              <span className="block rounded px-2 py-1 text-center font-semibold text-warm peer-checked:bg-white peer-checked:text-ink-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300">Interne notitie</span>
            </label>
          </div>
          <textarea name="tekst" rows={3} required className="veld" placeholder="Een antwoord ziet de klant in het portaal. Een notitie blijft intern." />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[12px] text-ink-700">
              <input type="checkbox" name="mailen" defaultChecked />
              Antwoord ook mailen
            </label>
            <VerzendKnop className="knop-donker" bezigTekst="Versturen…">Plaatsen</VerzendKnop>
          </div>
        </form>
      </div>

      {/* Afhandeling */}
      <div className="p-4">
        {afgehandeld ? (
          <div className="space-y-2 text-[13px]">
            <h3 className="veld-label">Afgehandeld {k.opgelost_op ? `op ${fmt(k.opgelost_op)}` : ''}</h3>
            {k.oplossing && <p><span className="font-semibold text-ink-900">Oplossing:</span> {k.oplossing}</p>}
            {k.oorzaak && <p><span className="font-semibold text-ink-900">Oorzaak:</span> {k.oorzaak}</p>}
            <form action={wijzigKlachtStatus}>
              <input type="hidden" name="klachtId" value={k.id} />
              <input type="hidden" name="terug" value={terug} />
              <input type="hidden" name="status" value="in_behandeling" />
              <button type="submit" className="knop-stil mt-1">Heropenen</button>
            </form>
          </div>
        ) : (
          <form action={sluitKlachtActie} className="space-y-3">
            <input type="hidden" name="klachtId" value={k.id} />
            <input type="hidden" name="terug" value={terug} />
            <h3 className="veld-label">Afhandelen</h3>
            <div>
              <label className="veld-label" htmlFor="kd-opl">Oplossing</label>
              <textarea id="kd-opl" name="oplossing" rows={2} className="veld" placeholder="Wat hebben we gedaan? Bijvoorbeeld: jassen omgeruild naar XL, kosteloos." />
            </div>
            <div>
              <label className="veld-label" htmlFor="kd-oorz">Oorzaak</label>
              <input id="kd-oorz" name="oorzaak" list="kd-oorzaken" className="veld" placeholder="Bijvoorbeeld: verkeerde maat gepickt" />
              <datalist id="kd-oorzaken">
                {oorzaken.map((o) => <option key={o} value={o} />)}
              </datalist>
              <p className="veld-hint">Kies waar het kan een bestaande oorzaak, dan telt hij mee in de top 5.</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-700">
              <label className="flex items-center gap-2"><input type="checkbox" name="naar_klant" defaultChecked /> Oplossing als antwoord naar de klant</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="mailen" defaultChecked /> en mailen</label>
            </div>
            <div className="flex flex-wrap gap-2">
              <VerzendKnop className="knop-primair" bezigTekst="Afhandelen…">Afhandelen</VerzendKnop>
            </div>
          </form>
        )}
        {!afgehandeld && k.status === 'open' && (
          <form action={wijzigKlachtStatus} className="mt-2">
            <input type="hidden" name="klachtId" value={k.id} />
            <input type="hidden" name="terug" value={terug} />
            <input type="hidden" name="status" value="in_behandeling" />
            <button type="submit" className="knop-tekst text-[12px]">Zet op in behandeling zonder te antwoorden</button>
          </form>
        )}
      </div>
    </aside>
  );
}

function Analyse({ klachten, periode }: { klachten: KlachtMetLabels[]; periode: string }) {
  const a = klachtAnalyse(klachten);
  const periodeTekst = periode === '30' ? 'laatste 30 dagen' : periode === '90' ? 'laatste 90 dagen' : periode === '365' ? 'laatste jaar' : 'alles';
  if (a.totaal === 0) {
    return (
      <div className="mt-4">
        <EmptyState titel="Nog niets om te analyseren" tekst="Zodra er vragen en klachten zijn vastgelegd, zie je hier waar ze over gaan, welke artikelen terugkomen en hoe snel jullie reageren." />
      </div>
    );
  }
  const link = (param: string, waarde: string) => `/dashboard/klachten?${new URLSearchParams({ [param]: waarde, ...(periode ? { periode } : {}) }).toString()}`;
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-warm">Over {periodeTekst}: {a.klachten} klachten en {a.vragen} vragen.</p>
        <UrlKeuze param="periode" waarde={periode} label="Periode" leegLabel="Altijd" opties={[{ value: '30', label: 'Laatste 30 dagen' }, { value: '90', label: 'Laatste 90 dagen' }, { value: '365', label: 'Laatste jaar' }]} />
      </div>

      <section className="panel grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
        <Kengetal label="Gem. eerste reactie" waarde={duurTekst(a.gemReactieUren)} />
        <Kengetal label="Op tijd beantwoord" waarde={a.slaPct != null ? `${a.slaPct}%` : '-'} sub="binnen de streefreactietijd" />
        <Kengetal label="Gem. oplostijd" waarde={duurTekst(a.gemOplosUren)} />
        <Kengetal label="Afgehandeld zonder oorzaak" waarde={String(a.zonderOorzaak)} sub={a.zonderOorzaak ? 'vul de oorzaak in voor een betere top 5' : undefined} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Per maand</h2>
          <p className="mb-3 text-[12px] text-warm">Laatste 12 maanden, deze maand in oranje.</p>
          <MaandTrend maanden={a.perMaand} omschrijving="Vragen en klachten per maand" />
        </section>
        <section className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Per categorie</h2>
          <p className="mb-3 text-[12px] text-warm">Klik om de tickets te zien.</p>
          <Staven rijen={a.perCategorie.map((r) => ({ ...r, href: link('categorie', r.label === 'Niet ingedeeld' ? '-' : r.label), nadruk: r.label === a.perCategorie[0]?.label }))} />
        </section>
        <section className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Top 5 terugkerende oorzaken</h2>
          <p className="mb-3 text-[12px] text-warm">Uit het veld Oorzaak bij het afhandelen.</p>
          <Staven rijen={a.topOorzaken.map((r, i) => ({ ...r, nadruk: i === 0 }))} leegTekst="Nog geen oorzaken ingevuld. Vul bij het afhandelen een oorzaak in, dan verschijnt hier de top 5." />
        </section>
        <section className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Per klant</h2>
          <p className="mb-3 text-[12px] text-warm">Top 10.</p>
          <Staven rijen={a.perKlant.map((r) => ({ ...r, href: link('q', r.label) }))} />
        </section>
        <section className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Per artikel</h2>
          <p className="mb-3 text-[12px] text-warm">Alleen tickets met een gekoppeld artikel.</p>
          <Staven rijen={a.perProduct.map((r) => ({ label: r.label, waarde: r.waarde, sub: r.sub, href: link('q', r.label) }))} leegTekst="Nog geen artikelen gekoppeld. Koppel bij een ticket het artikel, dan zie je welke producten vaak terugkomen." />
        </section>
        <section className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Per merk</h2>
          <p className="mb-3 text-[12px] text-warm">Via het gekoppelde artikel.</p>
          <Staven rijen={a.perMerk.map((r) => ({ ...r, href: link('q', r.label) }))} leegTekst="Nog geen artikelen met een merk gekoppeld." />
        </section>
      </div>
    </div>
  );
}
