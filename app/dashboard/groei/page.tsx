import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import PaginaKop from '@/components/dashboard/ui/PaginaKop';
import Drawer from '@/components/dashboard/Drawer';
import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import {
  CATEGORIEEN,
  EIGENAARS,
  KPIS,
  PRIORITEITEN,
  STATUSSEN,
  kpiWaarden,
  listMarketingActies,
  type KpiWaarden,
  type MarketingActie,
} from '@/lib/kms/groei';
import { nieuweActieActie, bewaarActieActie, snelActieActie, verwijderActieActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marketing en sales', robots: { index: false, follow: false } };

type Zoek = { status?: string; eigenaar?: string; categorie?: string; melding?: string };

const STATUS_KLEUR: Record<string, string> = {
  open: 'border-line bg-white text-ink-800',
  bezig: 'border-amber-300 bg-amber-50 text-amber-900',
  klaar: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  geparkeerd: 'border-line bg-mist text-warm',
};
const PRIO_KLEUR: Record<number, string> = { 1: 'bg-ink-900 text-white', 2: 'bg-mist text-ink-800', 3: 'bg-white text-warm border border-line' };

const vandaag = () => new Date().toISOString().slice(0, 10);
const fmtDatum = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });

/**
 * Marketing en sales: alle acties uit het project op één checklist, met eigenaar,
 * prioriteit, deadline, notities en het cijfer waar de actie op stuurt. De cijfers
 * worden live gelezen uit de schermen die er al zijn; elk cijfer linkt daarheen.
 */
export default async function GroeiPagina({ searchParams }: { searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const zp = await searchParams;
  const [{ acties, tabelOntbreekt }, kpi] = await Promise.all([listMarketingActies(), kpiWaarden()]);

  const statusFilter = zp.status === 'klaar' || zp.status === 'alle' || zp.status === 'geparkeerd' ? zp.status : 'open';
  const eigenaarFilter = EIGENAARS.some((e) => e.id === zp.eigenaar) ? zp.eigenaar : undefined;
  const categorieFilter = CATEGORIEEN.some((c) => c.id === zp.categorie) ? zp.categorie : undefined;

  const zichtbaar = acties.filter(
    (a) =>
      (statusFilter === 'alle' ||
        (statusFilter === 'open' ? a.status === 'open' || a.status === 'bezig' : a.status === statusFilter)) &&
      (!eigenaarFilter || a.eigenaar === eigenaarFilter) &&
      (!categorieFilter || a.categorie === categorieFilter),
  );

  const meetelt = acties.filter((a) => a.status !== 'geparkeerd');
  const klaar = meetelt.filter((a) => a.status === 'klaar').length;
  const pct = meetelt.length ? Math.round((klaar / meetelt.length) * 100) : 0;
  const teLaat = acties.filter((a) => a.deadline && a.deadline < vandaag() && a.status !== 'klaar' && a.status !== 'geparkeerd').length;

  const query = (wijzig: Partial<Zoek>) => {
    const p = new URLSearchParams();
    const v = { status: statusFilter === 'open' ? undefined : statusFilter, eigenaar: eigenaarFilter, categorie: categorieFilter, ...wijzig };
    for (const [k, w] of Object.entries(v)) if (w) p.set(k, w);
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  const terug = query({});

  return (
    <main className="container-app pb-16">
      <PaginaKop
        titel="Marketing en sales"
        sub="Alle acties op één plek. De cijfers komen live uit Leads, Reviews, Nieuwsbrief en de andere schermen; klik erop om daar verder te werken."
        acties={
          <Drawer knop="Actie toevoegen" titel="Nieuwe actie">
            <ActieFormulier terug={terug} />
          </Drawer>
        }
      />

      {zp.melding && <p className="mt-4 rounded-lg border border-line bg-mist px-4 py-2.5 text-[13px] font-semibold text-ink-800" role="status">{zp.melding}</p>}

      {tabelOntbreekt && (
        <div className="mt-5 rounded-xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-[14px] text-ink-900" role="status">
          <p className="font-bold">De actielijst staat nog niet in de database</p>
          <p className="mt-1">Draai <span className="font-mono">supabase/migrations/20261010_marketing_acties.sql</span> in de SQL Editor van Supabase. Daarmee komen ook alle 71 acties uit het project erin.</p>
        </div>
      )}

      {/* Cijfers: alleen lezen, elk tegeltje opent het scherm waar het cijfer vandaan komt. */}
      <section aria-label="Cijfers" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {KPIS.map((k) => (
          <Link key={k.id} href={k.href} className="panel group min-w-0 p-3 transition hover:border-ink-300">
            <p className="font-display text-xl font-extrabold tabular-nums text-ink-900">{kpi[k.id] ?? '–'}</p>
            <p className="truncate text-[12px] font-semibold text-ink-800">{k.label}</p>
            <p className="truncate text-[11px] text-warm">{k.sub}</p>
          </Link>
        ))}
      </section>

      {/* Voortgang en verdeling */}
      <section className="panel mt-4 p-4" aria-label="Voortgang">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[14px] font-semibold text-ink-900">
            {klaar} van {meetelt.length} acties klaar <span className="text-warm">({pct}%)</span>
          </p>
          {teLaat > 0 && <p className="text-[13px] font-semibold text-red-700">{teLaat} over de deadline</p>}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-mist" aria-hidden="true">
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
          {EIGENAARS.map((e) => {
            const open = acties.filter((a) => a.eigenaar === e.id && (a.status === 'open' || a.status === 'bezig')).length;
            const aan = eigenaarFilter === e.id;
            return (
              <Link key={e.id} href={`/dashboard/groei${query({ eigenaar: aan ? undefined : e.id })}`} className={`chip ${aan ? 'chip-aan' : ''}`} aria-current={aan ? 'true' : undefined}>
                {e.label}: {open} open
              </Link>
            );
          })}
        </div>
      </section>

      {/* Filters */}
      <nav aria-label="Filter" className="mt-4 flex flex-wrap items-center gap-2">
        {[
          { id: 'open', label: 'Te doen' },
          { id: 'klaar', label: 'Klaar' },
          { id: 'geparkeerd', label: 'Geparkeerd' },
          { id: 'alle', label: 'Alles' },
        ].map((s) => (
          <Link key={s.id} href={`/dashboard/groei${query({ status: s.id === 'open' ? undefined : s.id })}`} className={`chip ${statusFilter === s.id ? 'chip-aan' : ''}`} aria-current={statusFilter === s.id ? 'true' : undefined}>
            {s.label}
          </Link>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
        <form method="get" action="/dashboard/groei" className="flex items-center gap-2">
          {statusFilter !== 'open' && <input type="hidden" name="status" value={statusFilter} />}
          {eigenaarFilter && <input type="hidden" name="eigenaar" value={eigenaarFilter} />}
          <AutoSubmitSelect
            name="categorie"
            defaultValue={categorieFilter ?? ''}
            aria-label="Onderdeel"
            className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px]"
            options={[{ value: '', label: 'Alle onderdelen' }, ...CATEGORIEEN.map((c) => ({ value: c.id, label: c.label }))]}
          />
        </form>
      </nav>

      {/* De lijst, per onderdeel */}
      <div className="mt-5 space-y-6">
        {zichtbaar.length === 0 && !tabelOntbreekt && (
          <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Niets in deze selectie.</p>
        )}
        {CATEGORIEEN.map((c) => {
          const rijen = zichtbaar.filter((a) => a.categorie === c.id);
          if (!rijen.length) return null;
          const alleInCat = acties.filter((a) => a.categorie === c.id && a.status !== 'geparkeerd');
          const klaarInCat = alleInCat.filter((a) => a.status === 'klaar').length;
          return (
            <section key={c.id} aria-labelledby={`cat-${c.id}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-1.5">
                <h2 id={`cat-${c.id}`} className="font-display text-base font-bold text-ink-900">
                  {c.label} <span className="ml-1 text-[12px] font-normal text-warm">{c.uitleg}</span>
                </h2>
                <span className="text-[12px] tabular-nums text-warm">{klaarInCat}/{alleInCat.length} klaar</span>
              </div>
              <ul className="divide-y divide-line">
                {rijen.map((a) => (
                  <ActieRij key={a.id} a={a} kpi={kpi} terug={terug} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function ActieRij({ a, kpi, terug }: { a: MarketingActie; kpi: KpiWaarden; terug: string }) {
  const k = a.kpi ? KPIS.find((x) => x.id === a.kpi) : null;
  const telaat = a.deadline && a.deadline < vandaag() && a.status !== 'klaar' && a.status !== 'geparkeerd';
  const prio = PRIORITEITEN.find((p) => p.id === a.prioriteit);
  return (
    <li className={`grid grid-cols-1 gap-2 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] sm:items-start sm:gap-4 ${a.status === 'klaar' ? 'opacity-70' : ''}`}>
      <form action={snelActieActie}>
        <input type="hidden" name="id" value={a.id} />
        <input type="hidden" name="terug" value={terug} />
        <AutoSubmitSelect
          name="status"
          defaultValue={a.status}
          aria-label={`Status van ${a.titel}`}
          className={`w-full rounded-md border px-2 py-1.5 text-[13px] font-semibold ${STATUS_KLEUR[a.status]}`}
          options={STATUSSEN.map((s) => ({ value: s.id, label: s.label }))}
        />
      </form>
      <div className="min-w-0">
        <p className={`font-semibold text-ink-900 ${a.status === 'klaar' ? 'line-through decoration-ink-300' : ''}`}>{a.titel}</p>
        {a.omschrijving && <p className="mt-0.5 text-[13px] leading-snug text-warm max-sm:line-clamp-3">{a.omschrijving}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
          {prio && <span className={`rounded px-1.5 py-0.5 font-semibold ${PRIO_KLEUR[a.prioriteit]}`}>{prio.label}</span>}
          {a.deadline && (
            <span className={`rounded border px-1.5 py-0.5 ${telaat ? 'border-red-300 bg-red-50 font-semibold text-red-800' : 'border-line text-ink-700'}`}>
              {telaat ? 'Te laat: ' : 'Voor '}
              {fmtDatum(a.deadline)}
            </span>
          )}
          {k && (
            <Link href={k.href} className="rounded border border-line px-1.5 py-0.5 text-ink-700 hover:border-ink-300">
              {k.label}: <span className="font-semibold tabular-nums text-ink-900">{kpi[k.id] ?? '–'}</span>
            </Link>
          )}
          {a.notities && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-900" title={a.notities}>Notitie</span>}
          {a.status === 'klaar' && a.afgerond_op && <span className="text-warm">klaar op {new Date(a.afgerond_op).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>}
        </div>
        {a.notities && <p className="mt-1.5 rounded-md bg-mist px-2.5 py-1.5 text-[12px] text-ink-800 max-sm:line-clamp-2">{a.notities}</p>}
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <form action={snelActieActie}>
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="terug" value={terug} />
          <AutoSubmitSelect
            name="eigenaar"
            defaultValue={a.eigenaar}
            aria-label={`Eigenaar van ${a.titel}`}
            className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px]"
            options={EIGENAARS.map((e) => ({ value: e.id, label: e.label }))}
          />
        </form>
        <Drawer knop="Bewerken" titel={a.titel} knopKlasse="knop-stil">
          <ActieFormulier a={a} terug={terug} />
          <form action={verwijderActieActie} className="mt-6 border-t border-line pt-4">
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="titel" value={a.titel} />
            <input type="hidden" name="terug" value={terug} />
            <ConfirmSubmit message={`"${a.titel}" verwijderen? Parkeren kan ook: dan blijft hij bewaard.`} className="text-[13px] font-semibold text-red-700 hover:underline">
              Actie verwijderen
            </ConfirmSubmit>
          </form>
        </Drawer>
      </div>
    </li>
  );
}

function ActieFormulier({ a, terug }: { a?: MarketingActie; terug: string }) {
  const id = a?.id ?? 'nieuw';
  return (
    <form action={a ? bewaarActieActie : nieuweActieActie} className="mt-2 flex flex-col gap-4">
      {a && <input type="hidden" name="id" value={a.id} />}
      <input type="hidden" name="terug" value={terug} />
      <div>
        <label className="veld-label" htmlFor={`ma-titel-${id}`}>Actie</label>
        <input id={`ma-titel-${id}`} name="titel" required defaultValue={a?.titel ?? ''} placeholder="Bijv. Vraag drie klanten om een case" className="veld" />
      </div>
      <div>
        <label className="veld-label" htmlFor={`ma-oms-${id}`}>Wat en waarom</label>
        <textarea id={`ma-oms-${id}`} name="omschrijving" rows={3} defaultValue={a?.omschrijving ?? ''} className="veld" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="veld-label" htmlFor={`ma-cat-${id}`}>Onderdeel</label>
          <select id={`ma-cat-${id}`} name="categorie" defaultValue={a?.categorie ?? 'website'} className="veld">
            {CATEGORIEEN.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="veld-label" htmlFor={`ma-eig-${id}`}>Eigenaar</label>
          <select id={`ma-eig-${id}`} name="eigenaar" defaultValue={a?.eigenaar ?? 'jessi'} className="veld">
            {EIGENAARS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </div>
        <div>
          <label className="veld-label" htmlFor={`ma-prio-${id}`}>Prioriteit</label>
          <select id={`ma-prio-${id}`} name="prioriteit" defaultValue={String(a?.prioriteit ?? 2)} className="veld">
            {PRIORITEITEN.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="veld-label" htmlFor={`ma-status-${id}`}>Status</label>
          <select id={`ma-status-${id}`} name="status" defaultValue={a?.status ?? 'open'} className="veld">
            {STATUSSEN.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="veld-label" htmlFor={`ma-dl-${id}`}>Deadline</label>
          <input id={`ma-dl-${id}`} name="deadline" type="date" defaultValue={a?.deadline ?? ''} className="veld" />
        </div>
        <div>
          <label className="veld-label" htmlFor={`ma-kpi-${id}`}>Stuurt op</label>
          <select id={`ma-kpi-${id}`} name="kpi" defaultValue={a?.kpi ?? ''} className="veld">
            <option value="">Geen cijfer</option>
            {KPIS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="veld-label" htmlFor={`ma-not-${id}`}>Notities</label>
        <textarea id={`ma-not-${id}`} name="notities" rows={3} defaultValue={a?.notities ?? ''} placeholder="Wat is er gedaan, wat staat nog open" className="veld" />
      </div>
      {a?.bron && <p className="text-[12px] text-warm">Herkomst: {a.bron}</p>}
      <button type="submit" className="knop-donker self-start">{a ? 'Opslaan' : 'Actie toevoegen'}</button>
    </form>
  );
}
