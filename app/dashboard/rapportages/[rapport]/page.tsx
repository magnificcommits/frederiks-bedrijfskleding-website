import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar, kmsAdmin } from '@/lib/kms/adminClient';
import { laadKlanten } from '@/lib/kms/analyseData';
import { datumKort, periodeParams, urlMet, type PeriodeKeuze } from '@/lib/kms/analysePeriode';
import { leesRapportFilters, vindRapport } from '@/lib/kms/rapportages';
import PeriodeKiezer from '../../analyse/_delen/PeriodeKiezer';
import AfdrukKnop from '../_delen/AfdrukKnop';
import AfdrukStijl from '../_delen/AfdrukStijl';
import KlantFilter from '../_delen/KlantFilter';
import RapportWeergave from '../_delen/RapportWeergave';

export const dynamic = 'force-dynamic';

type SP = { periode?: string; van?: string; tot?: string; klant?: string };

export async function generateMetadata({ params }: { params: Promise<{ rapport: string }> }) {
  const def = vindRapport((await params).rapport);
  return { title: def ? def.titel : 'Rapport', robots: { index: false, follow: false } };
}

const KEUZES: PeriodeKeuze[] = ['maand', 'vorige-maand', 'kwartaal', 'vorig-kwartaal', 'jaar', 'vorig-jaar', '12m'];

/** Waar dit rapport in Analyse verder te verkennen is. */
const ANALYSE_TAB: Record<string, string> = {
  'omzet-klant': 'verkoop',
  'omzet-merk': 'producten',
  'omzet-categorie': 'producten',
  offertes: 'funnel',
};

export default async function RapportPagina({ params, searchParams }: { params: Promise<{ rapport: string }>; searchParams: Promise<SP> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const [{ rapport }, sp] = await Promise.all([params, searchParams]);
  const def = vindRapport(rapport);
  if (!def) notFound();
  if (def.key !== rapport) redirect(urlMet(`/dashboard/rapportages/${def.key}`, sp));
  if (!kmsAdmin()) redirect('/dashboard/rapportages');

  const filters = leesRapportFilters(def, sp);
  const pp = def.periode ? periodeParams(filters.periode, true) : {};
  delete pp.vgl; // Rapporten vergelijken niet; de periode is genoeg.
  const filterParams = { ...pp, klant: filters.klantId ?? undefined };

  const [tabel, klanten] = await Promise.all([def.bouw(filters), def.klant ? laadKlanten() : Promise.resolve(new Map())]);
  const klantNaam = filters.klantId ? klanten.get(filters.klantId)?.naam ?? null : null;
  const exportUrl = (formaat: 'csv' | 'xlsx') => urlMet('/dashboard/rapportages/export', { rapport: def.key, formaat }, filterParams);
  const analyseTab = ANALYSE_TAB[def.key];

  return (
    <main className="container-app pb-12">
      <AfdrukStijl />
      <div className="dash-kop justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link href={urlMet('/dashboard/rapportages', pp)} className="knop-tekst -ml-2 shrink-0" aria-label="Terug naar rapportages">&larr;</Link>
          <h1 className="dash-h1 truncate">{def.titel}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {analyseTab && (
            <Link href={urlMet('/dashboard/analyse', { tab: analyseTab === 'verkoop' ? undefined : analyseTab }, pp)} className="knop-tekst hidden sm:inline-flex">
              Verkennen in analyse <span aria-hidden>&rarr;</span>
            </Link>
          )}
          <AfdrukKnop />
          <a href={exportUrl('csv')} className="knop-stil">CSV</a>
          <a href={exportUrl('xlsx')} className="knop-donker">Excel</a>
        </div>
      </div>
      <p className="dash-sub mt-3 max-w-3xl">{def.beschrijving}</p>

      {def.periode && (
        <PeriodeKiezer
          periode={filters.periode}
          pad={`/dashboard/rapportages/${def.key}`}
          bewaar={{ klant: filters.klantId ?? undefined }}
          keuzes={KEUZES}
          metVergelijking={false}
        />
      )}
      {def.klant && (
        <div className={def.periode ? 'mt-3' : 'mt-4'}>
          <KlantFilter
            pad={`/dashboard/rapportages/${def.key}`}
            klanten={[...klanten.values()].map((k) => ({ id: k.id, naam: k.naam }))}
            huidig={filters.klantId}
            bewaar={pp}
          />
        </div>
      )}

      <div id="rapport-afdruk" className="mt-5">
        <div className="mb-4 hidden border-b border-ink-200 pb-3 print:block">
          <p className="text-[11px] uppercase tracking-wide text-ink-500">Frederiks Bedrijfskleding</p>
          <h2 className="mt-1 font-display text-xl font-bold text-ink-900">{def.titel}</h2>
          <p className="mt-0.5 text-[12px] text-ink-600">
            {def.periode ? filters.periode.label : `Peildatum ${datumKort(filters.periode.vandaag)}`}
            {klantNaam && ` · ${klantNaam}`} · gemaakt op {datumKort(filters.periode.vandaag)}
          </p>
        </div>
        {(klantNaam || !def.periode) && (
          <p className="mb-3 text-[13px] text-warm print:hidden">
            {!def.periode && <>Peildatum <span className="font-semibold text-ink-900">{datumKort(filters.periode.vandaag)}</span>. </>}
            {klantNaam && <>Alleen <span className="font-semibold text-ink-900">{klantNaam}</span>.</>}
          </p>
        )}
        <RapportWeergave tabel={tabel} />
      </div>
    </main>
  );
}
