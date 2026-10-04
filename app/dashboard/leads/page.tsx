import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isLeadsDbConfigured } from '@/lib/env';
import { dashAuthed, getHuidigeAdmin } from '@/lib/kms/adminClient';
import { listTaakPersonen, standaardPersoon } from '@/lib/kms/taakPersonen';
import { berekenKpis, herkomstAnalyse, listLeadKaarten, migratieStand, type LeadKaart } from '@/lib/kms/leads';
import {
  GEWONNEN,
  LEAD_STATUSSEN,
  VERLOREN,
  euro,
  isOpen,
  statusLabel,
  vandaagNl,
} from '@/lib/kms/leadsModel';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import Drawer from '@/components/dashboard/Drawer';
import EmptyState from '@/components/dashboard/EmptyState';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import Pijplijn, { type PijplijnKaart } from './Pijplijn';
import Lijst from './Lijst';
import Herkomst from './Herkomst';
import LeadFilters from './LeadFilters';
import NieuweLeadForm from './NieuweLeadForm';
import LeadMelding from './LeadMelding';

export const metadata: Metadata = { title: 'Leads', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type SP = {
  weergave?: string;
  status?: string;
  bron?: string;
  branche?: string;
  periode?: string;
  eigenaar?: string;
  score?: string;
  vandaag?: string;
  signaal?: string;
  q?: string;
  sort?: string;
  dir?: string;
};

const DAG = 86_400_000;
const SIGNALEN = ['verlopen', 'wacht', 'zonderstap', 'dubbel'] as const;

function periodeStart(p: string | undefined, nu: Date): number | null {
  if (p === '7d') return nu.getTime() - 7 * DAG;
  if (p === '30d') return nu.getTime() - 30 * DAG;
  if (p === '90d') return nu.getTime() - 90 * DAG;
  if (p === 'maand') return new Date(nu.getFullYear(), nu.getMonth(), 1).getTime();
  if (p === 'jaar') return new Date(nu.getFullYear(), 0, 1).getTime();
  return null;
}

function reactieTekst(uren: number | null): string {
  if (uren == null) return 'Nog niet gemeten';
  if (uren < 1) return `${Math.max(1, Math.round(uren * 60))} min`;
  if (uren < 36) return `${Math.round(uren)} uur`;
  return `${(uren / 24).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} dag`;
}

/** Standaardvolgorde: eerst wat aandacht vraagt (verlopen, wacht te lang, vandaag), dan de hoogste score. */
function aandachtGewicht(l: LeadKaart): number {
  if (!isOpen(l.status)) return 9;
  if (l.opvolg === 'verlopen') return 0;
  if ((l.wachtUren ?? 0) >= 24) return 1;
  if (l.opvolg === 'vandaag') return 2;
  if (l.wachtUren != null) return 3;
  if (l.opvolg === 'geen') return 4;
  return 5;
}

function sorteer(leads: LeadKaart[], sort: string | undefined, dir: string | undefined): LeadKaart[] {
  const r = dir === 'asc' ? 1 : -1;
  const lijst = [...leads];
  const naam = (l: LeadKaart) => (l.company || l.name).toLowerCase();
  switch (sort) {
    case 'score':
      return lijst.sort((a, b) => r * (a.scoreWaarde - b.scoreWaarde) || naam(a).localeCompare(naam(b), 'nl'));
    case 'waarde':
      return lijst.sort((a, b) => r * (a.waarde - b.waarde));
    case 'binnen':
      return lijst.sort((a, b) => r * a.created_at.localeCompare(b.created_at));
    case 'naam':
      return lijst.sort((a, b) => r * naam(a).localeCompare(naam(b), 'nl'));
    case 'status':
      return lijst.sort(
        (a, b) => r * (LEAD_STATUSSEN.indexOf(a.status as never) - LEAD_STATUSSEN.indexOf(b.status as never)) || b.scoreWaarde - a.scoreWaarde,
      );
    case 'opvolg': {
      // Zonder datum altijd achteraan, ongeacht de richting.
      return lijst.sort((a, b) => {
        if (!a.opvolgdatum && !b.opvolgdatum) return b.scoreWaarde - a.scoreWaarde;
        if (!a.opvolgdatum) return 1;
        if (!b.opvolgdatum) return -1;
        return r * a.opvolgdatum.localeCompare(b.opvolgdatum);
      });
    }
    default:
      return lijst.sort((a, b) => aandachtGewicht(a) - aandachtGewicht(b) || b.scoreWaarde - a.scoreWaarde || b.created_at.localeCompare(a.created_at));
  }
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  if (!(await dashAuthed())) redirect('/dashboard');
  if (!isLeadsDbConfigured) redirect('/dashboard');

  const nu = new Date();
  const vandaag = vandaagNl(nu);
  const [alle, personen, admin, migratie] = await Promise.all([
    listLeadKaarten(),
    listTaakPersonen(),
    getHuidigeAdmin().catch(() => null),
    migratieStand(),
  ]);
  const actievePersonen = personen.filter((p) => p.actief);
  const mijnPersoon = standaardPersoon(personen, admin?.email ?? null);
  const persoonNaam = new Map(personen.map((p) => [p.id, p.naam]));

  const weergave = sp.weergave === 'lijst' ? 'lijst' : 'pijplijn';
  const signaal = (SIGNALEN as readonly string[]).includes(sp.signaal ?? '') ? sp.signaal : undefined;
  const q = (sp.q ?? '').toLowerCase().trim();
  const woorden = q.split(/\s+/).filter(Boolean);
  const start = periodeStart(sp.periode, nu);

  // Filters zonder status: de pijplijn toont altijd alle kolommen.
  const basis = alle.filter((l) => {
    if (start != null && new Date(l.created_at).getTime() < start) return false;
    if (sp.bron && l.kanaal !== sp.bron) return false;
    if (sp.branche && (l.branche ?? '') !== sp.branche) return false;
    if (sp.eigenaar === 'geen' && l.eigenaar_id) return false;
    if (sp.eigenaar && sp.eigenaar !== 'geen' && l.eigenaar_id !== sp.eigenaar) return false;
    if (sp.score === 'laag' && l.scoreWaarde >= 40) return false;
    if (sp.score && sp.score !== 'laag' && l.scoreWaarde < Number(sp.score)) return false;
    if (sp.vandaag === '1') {
      if (!isOpen(l.status) || !l.opvolgdatum || l.opvolgdatum.slice(0, 10) > vandaag) return false;
      if (migratie.kolommen && mijnPersoon && l.eigenaar_id && l.eigenaar_id !== mijnPersoon) return false;
    }
    if (signaal === 'verlopen' && l.opvolg !== 'verlopen') return false;
    if (signaal === 'wacht' && (l.wachtUren ?? 0) < 24) return false;
    if (signaal === 'zonderstap' && !(isOpen(l.status) && l.opvolg === 'geen' && l.wachtUren == null)) return false;
    if (signaal === 'dubbel' && !l.dubbelVan.length) return false;
    if (woorden.length) {
      const hooiberg = `${l.name} ${l.company ?? ''} ${l.email ?? ''} ${l.phone ?? ''} ${l.branche ?? ''} ${l.notitie ?? ''}`.toLowerCase();
      if (!woorden.every((w) => hooiberg.includes(w))) return false;
    }
    return true;
  });

  const kpi = berekenKpis(alle, nu);
  const telSignaal = {
    verlopen: alle.filter((l) => l.opvolg === 'verlopen').length,
    wacht: alle.filter((l) => (l.wachtUren ?? 0) >= 24).length,
    zonderstap: alle.filter((l) => isOpen(l.status) && l.opvolg === 'geen' && l.wachtUren == null).length,
    dubbel: alle.filter((l) => l.dubbelVan.length > 0).length,
  };

  // URL-hulp: huidige parameters met een of meer wijzigingen.
  const huidig: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string' && v && k !== 'ok' && k !== 'fout') huidig[k] = v;
  const url = (wijzig: Record<string, string | null>) => {
    const p = new URLSearchParams(huidig);
    for (const [k, v] of Object.entries(wijzig)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return s ? `/dashboard/leads?${s}` : '/dashboard/leads';
  };
  const terug = url({});
  const filterActief = ['status', 'bron', 'branche', 'periode', 'eigenaar', 'score', 'vandaag', 'signaal', 'q'].some((k) => huidig[k]);

  // Keuzes voor de filters.
  const telPer = (sleutel: (l: LeadKaart) => string | null) => {
    const m = new Map<string, number>();
    for (const l of alle) {
      const k = sleutel(l);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, n]) => ({ value, label: `${value} (${n})` }));
  };
  const bronOpties = telPer((l) => l.kanaal);
  const brancheOpties = telPer((l) => l.branche);

  // Pijplijn: gesloten leads ouder dan 60 dagen verbergen, tenzij er een periode gekozen is.
  const verborgen: Record<string, number> = {};
  const grens = nu.getTime() - 60 * DAG;
  const opBord = basis.filter((l) => {
    if (start != null || (l.status !== GEWONNEN && l.status !== VERLOREN)) return true;
    const t = new Date(l.status_gewijzigd_op ?? l.created_at).getTime();
    if (t >= grens) return true;
    verborgen[l.status] = (verborgen[l.status] ?? 0) + 1;
    return false;
  });
  const kaarten: PijplijnKaart[] = opBord.map((l) => ({
    id: l.id,
    naam: l.name,
    bedrijf: l.company,
    status: l.status,
    score: l.scoreWaarde,
    wachtUren: l.wachtUren,
    opvolg: l.opvolg,
    opvolgdatum: l.opvolgdatum,
    volgendeStap: l.volgende_stap ?? null,
    waarde: l.waarde,
    geschat: l.waardeGeschat,
    kans: l.kansPct,
    kanaal: l.kanaal,
    branche: l.branche,
    aantal: l.aantal,
    dubbel: l.dubbelVan.length > 0,
    eigenaar: (l.eigenaar_id && persoonNaam.get(l.eigenaar_id)) || l.eigenaar || null,
  }));

  // Lijst: met statusfilter en sortering.
  const lijst = sorteer(sp.status ? basis.filter((l) => l.status === sp.status) : basis, sp.sort, sp.dir);
  const statusTelling = Object.fromEntries(LEAD_STATUSSEN.map((s) => [s, basis.filter((l) => l.status === s).length]));

  // Herkomst over de gekozen periode (los van de andere filters, anders zie je na een klik maar één balk).
  const herkomst = herkomstAnalyse(start == null ? alle : alle.filter((l) => new Date(l.created_at).getTime() >= start));
  const redenen = new Map<string, number>();
  for (const l of alle) {
    if (l.status !== VERLOREN) continue;
    const r = (l.verloren_reden ?? '').split(':')[0].trim() || 'Geen reden vastgelegd';
    redenen.set(r, (redenen.get(r) ?? 0) + 1);
  }
  const redenLijst = [...redenen.entries()].sort((a, b) => b[1] - a[1]);

  const reactieUrenRond = kpi.reactieUren == null ? null : Math.round(kpi.reactieUren);

  return (
    <main className="container-app py-6">
      <LeadMelding />
      <div className="dash-kop justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="dash-h1">Leads</h1>
          <span className="hidden text-[13px] text-warm sm:inline">{kpi.openAantal} open</span>
        </div>
        <div className="flex items-center gap-2">
          <nav aria-label="Weergave" className="inline-flex rounded-md border border-line bg-white p-0.5">
            {(['pijplijn', 'lijst'] as const).map((w) => (
              <Link
                key={w}
                href={url({ weergave: w === 'pijplijn' ? null : 'lijst' })}
                aria-current={weergave === w ? 'page' : undefined}
                className={`rounded px-2.5 py-1 text-[13px] font-semibold ${weergave === w ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-mist'}`}
              >
                {w === 'pijplijn' ? 'Pijplijn' : 'Lijst'}
              </Link>
            ))}
          </nav>
          <Drawer knop="+ Lead" titel="Lead toevoegen" beschrijving="Voor een aanvraag die niet via de website kwam: aan de telefoon, op een beurs of in de winkel.">
            <NieuweLeadForm personen={actievePersonen.map((p) => ({ id: p.id, naam: p.naam }))} mijnPersoon={mijnPersoon} />
          </Drawer>
        </div>
      </div>

      {!migratie.kolommen || !migratie.tijdlijn ? (
        <p className="mt-4 rounded-md border border-line bg-mist px-3 py-2 text-[12px] text-warm">
          De database mist nog de leads-migratie van 4 oktober. Alles werkt, maar eigenaar, kans en verloren-reden worden pas opgeslagen
          als die gedraaid is{migratie.tijdlijn ? '' : ', en de tijdlijn staat tot dan in het auditlog'}.
        </p>
      ) : null}

      {/* Kerncijfers */}
      <section aria-label="Kerncijfers" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTegel
          label="Nieuwe leads deze maand"
          waarde={String(kpi.nieuwDezeMaand)}
          href="/dashboard/leads?weergave=lijst&periode=maand&sort=binnen&dir=desc"
          delta={{ nu: kpi.nieuwDezeMaand, vorige: kpi.nieuwVorigeMaandTotNu, richting: 'hoger-beter', vergelijk: 'zelfde dagen vorige maand' }}
          spark={{ waarden: kpi.perMaand.map((m) => m.aantal), labels: kpi.perMaand.map((m) => m.label), omschrijving: 'Leads per maand' }}
        />
        <KpiTegel
          label="Gemiddelde reactietijd (90 dagen)"
          waarde={reactieTekst(kpi.reactieUren)}
          href="/dashboard/leads?signaal=wacht"
          delta={
            reactieUrenRond != null && kpi.reactieUrenVorige != null
              ? { nu: reactieUrenRond, vorige: Math.round(kpi.reactieUrenVorige), richting: 'lager-beter', vergelijk: 'de 90 dagen ervoor' }
              : undefined
          }
          sub={
            kpi.wachtNuTeLang > 0 ? (
              <span className="font-semibold text-red-700">{kpi.wachtNuTeLang} {kpi.wachtNuTeLang === 1 ? 'wacht' : 'wachten'} nu langer dan 24 uur</span>
            ) : kpi.reactieGemeten === 0 ? (
              <span className="text-warm">Leg belletjes en mails vast op de tijdlijn, dan meet het dashboard dit.</span>
            ) : (
              <span className="text-warm">Niemand wacht langer dan 24 uur.</span>
            )
          }
        />
        <KpiTegel
          label="Conversie (12 maanden)"
          waarde={kpi.conversiePct == null ? 'Nog niets gesloten' : `${Math.round(kpi.conversiePct)}%`}
          href="/dashboard/leads?weergave=lijst&status=geaccordeerd"
          delta={
            kpi.conversiePct != null && kpi.conversieVorigePct != null
              ? { nu: Math.round(kpi.conversiePct), vorige: Math.round(kpi.conversieVorigePct), richting: 'hoger-beter', vergelijk: 'jaar ervoor' }
              : undefined
          }
          sub={<span className="text-warm">{kpi.gewonnen} gewonnen, {kpi.verloren} verloren</span>}
        />
        <KpiTegel
          label="Openstaande waarde"
          waarde={euro(kpi.openWaarde)}
          href="/dashboard/leads"
          sub={
            <span className="text-warm">
              {kpi.openWaardeGeschat > 0 ? <>plus ≈ {euro(kpi.openWaardeGeschat)} geschat zonder bedrag. </> : null}
              Gewogen naar kans: <span className="font-semibold text-ink-800">{euro(kpi.gewogenWaarde)}</span>
            </span>
          }
        />
      </section>

      {/* Signalen: wat vraagt nu aandacht */}
      {(telSignaal.verlopen || telSignaal.wacht || telSignaal.zonderstap || telSignaal.dubbel || signaal) ? (
        <nav aria-label="Aandacht" className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12px] font-semibold uppercase tracking-wide text-warm">Aandacht</span>
          {([
            ['verlopen', 'Opvolging verlopen', telSignaal.verlopen, 'text-red-700'],
            ['wacht', 'Wacht langer dan 24 uur', telSignaal.wacht, 'text-red-700'],
            ['zonderstap', 'Geen volgende stap', telSignaal.zonderstap, 'text-amber-700'],
            ['dubbel', 'Mogelijk dubbel', telSignaal.dubbel, 'text-ink-700'],
          ] as const).map(([sleutel, label, n, kleur]) =>
            n > 0 || signaal === sleutel ? (
              <Link key={sleutel} href={url({ signaal: signaal === sleutel ? null : sleutel })} className={`chip ${signaal === sleutel ? 'chip-aan' : ''}`} aria-pressed={signaal === sleutel}>
                <span className={signaal === sleutel ? '' : kleur}>{label}</span>
                <span className="chip-tel">{n}</span>
              </Link>
            ) : null,
          )}
        </nav>
      ) : null}

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-end gap-3 border-y border-line py-3">
        <LiveZoekveld param="q" label="Zoeken" placeholder="Naam, bedrijf, e-mail of telefoon" breedte="w-full sm:w-64" className="py-1" />
        <LeadFilters
          bronnen={bronOpties}
          branches={brancheOpties}
          personen={migratie.kolommen ? actievePersonen.map((p) => ({ value: p.id, label: p.naam })) : []}
          mijnPersoon={migratie.kolommen ? mijnPersoon : null}
        />
        {filterActief && (
          <Link href={weergave === 'lijst' ? '/dashboard/leads?weergave=lijst' : '/dashboard/leads'} className="knop-tekst">Wis filters</Link>
        )}
      </div>

      <div className="mt-4">
        {alle.length === 0 ? (
          <EmptyState
            titel="Nog geen leads"
            tekst="Aanvragen via het adviesformulier en de pakketconfigurator komen hier vanzelf binnen. Een telefonische aanvraag voeg je toe met + Lead."
          />
        ) : weergave === 'pijplijn' ? (
          basis.length === 0 ? (
            <EmptyState tekst="Geen leads binnen deze filters." actieHref="/dashboard/leads" actieLabel="Wis filters" />
          ) : (
            <Pijplijn kaarten={kaarten} verborgen={verborgen} />
          )
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <Link href={url({ status: null })} className={`chip ${sp.status ? '' : 'chip-aan'}`}>
                Alle <span className="chip-tel">{basis.length}</span>
              </Link>
              {LEAD_STATUSSEN.map((s) => (
                <Link key={s} href={url({ status: s })} className={`chip ${sp.status === s ? 'chip-aan' : ''}`}>
                  {statusLabel(s)} <span className="chip-tel">{statusTelling[s] ?? 0}</span>
                </Link>
              ))}
            </div>
            {lijst.length === 0 ? (
              <EmptyState tekst="Geen leads binnen deze filters." actieHref="/dashboard/leads?weergave=lijst" actieLabel="Wis filters" />
            ) : (
              <Lijst leads={lijst} terug={terug} personen={persoonNaam} />
            )}
          </>
        )}
      </div>

      {/* Analyse */}
      {alle.length > 0 && (
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <section className="panel p-4 lg:col-span-2" aria-labelledby="herkomst-kop">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="herkomst-kop" className="font-display text-base font-bold text-ink-900">Waar komen leads vandaan</h2>
              <span className="text-[12px] text-warm">
                {start == null ? 'Alle leads' : 'Binnen de gekozen periode'}
              </span>
            </div>
            <div className="mt-4">
              <Herkomst rijen={herkomst} hrefVoor={(k) => url({ bron: k })} />
            </div>
          </section>
          <section className="panel p-4" aria-labelledby="verloren-kop">
            <h2 id="verloren-kop" className="font-display text-base font-bold text-ink-900">Waarom verloren</h2>
            {redenLijst.length === 0 ? (
              <p className="mt-3 text-[13px] text-warm">Nog niets verloren. Mooi zo.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1.5 text-[13px]">
                {redenLijst.map(([r, n]) => (
                  <li key={r} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5 last:border-0">
                    <span className={r === 'Geen reden vastgelegd' ? 'text-warm' : 'text-ink-800'}>{r}</span>
                    <span className="tabular-nums font-semibold text-ink-900">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
