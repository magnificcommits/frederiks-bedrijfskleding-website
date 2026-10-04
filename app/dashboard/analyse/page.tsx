import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { leesPeriode, periodeParams, urlMet, type Periode } from '@/lib/kms/analysePeriode';
import PeriodeKiezer from './_delen/PeriodeKiezer';
import AiSamenvatting from './AiSamenvatting';
import Verkoop from './_tabs/Verkoop';
import Producten from './_tabs/Producten';
import Klanten from './_tabs/Klanten';
import Funnel from './_tabs/Funnel';
import Operatie from './_tabs/Operatie';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analyse', robots: { index: false, follow: false } };

const TABS = [
  { id: 'verkoop', label: 'Verkoop', vraag: 'Hoeveel verkopen we, aan wie en in welke branche?' },
  { id: 'producten', label: 'Producten', vraag: 'Wat gaat de deur uit: categorie, merk, kleur en maat. En wat houden we eraan over?' },
  { id: 'klanten', label: 'Klanten', vraag: 'Wie zijn de waardevolste klanten, wie is stil gevallen en waar zit nog groei?' },
  { id: 'funnel', label: 'Funnel', vraag: 'Hoeveel aanvragen worden offerte en order, en hoe snel?' },
  { id: 'operatie', label: 'Operatie', vraag: 'Waar blijven orders hangen, wat is te laat en wat komt terug?' },
] as const;
type TabId = (typeof TABS)[number]['id'];

type SP = { tab?: string; periode?: string; van?: string; tot?: string; vgl?: string; slaap?: string; norm?: string };

function Laden() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cijfers worden berekend</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="panel h-[118px] animate-pulse bg-mist/60 motion-reduce:animate-none" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => <div key={i} className="panel h-[280px] animate-pulse bg-mist/60 motion-reduce:animate-none" />)}
      </div>
    </div>
  );
}

function TabInhoud({ tab, periode, slaap, norm }: { tab: TabId; periode: Periode; slaap: number; norm: number }) {
  switch (tab) {
    case 'producten': return <Producten periode={periode} />;
    case 'klanten': return <Klanten periode={periode} slaap={slaap} />;
    case 'funnel': return <Funnel periode={periode} />;
    case 'operatie': return <Operatie periode={periode} norm={norm} />;
    default: return <Verkoop periode={periode} />;
  }
}

export default async function AnalysePage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const sp = await searchParams;

  if (!kmsAdmin()) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl panel p-6">
          <h1 className="dash-h1">Database nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen.</p>
        </div>
      </main>
    );
  }

  const tab: TabId = (TABS.find((t) => t.id === sp.tab)?.id ?? 'verkoop') as TabId;
  const periode = leesPeriode(sp);
  const pp = periodeParams(periode);
  const slaap = [3, 6, 12].includes(Number(sp.slaap)) ? Number(sp.slaap) : 6;
  const norm = Math.max(1, Math.min(90, Number(sp.norm) || 14));
  const extra: Record<string, string | undefined> = {
    slaap: tab === 'klanten' && slaap !== 6 ? String(slaap) : undefined,
    norm: tab === 'operatie' && norm !== 14 ? String(norm) : undefined,
  };
  const huidig = TABS.find((t) => t.id === tab)!;

  return (
    <main className="container-app pb-12">
      <div className="dash-kop justify-between gap-4">
        <h1 className="dash-h1">Analyse</h1>
        <nav className="flex items-center gap-1 text-[13px]" aria-label="Verwante pagina's">
          <Link href="/dashboard" className="knop-tekst">Startpagina</Link>
          <Link href={urlMet('/dashboard/rapportages', pp)} className="knop-tekst">Rapportages</Link>
        </nav>
      </div>

      <p className="dash-sub mt-3 max-w-3xl">
        Hier zoek je uit hoe het gaat en waarom. Kies een periode, vergelijk en klik door naar de orders, facturen of klanten
        achter een getal. Wat er vandaag moet gebeuren staat op de <Link href="/dashboard" className="font-semibold text-ink-800 underline-offset-2 hover:underline">startpagina</Link>;
        vaste overzichten om te exporteren of naar een klant te sturen vind je bij{' '}
        <Link href="/dashboard/rapportages" className="font-semibold text-ink-800 underline-offset-2 hover:underline">rapportages</Link>.
      </p>

      <PeriodeKiezer periode={periode} pad="/dashboard/analyse" bewaar={{ tab: tab === 'verkoop' ? undefined : tab, ...extra }} />

      <nav className="mt-4 flex flex-wrap gap-1 border-b border-line" aria-label="Onderdelen">
        {TABS.map((t) => {
          const aan = t.id === tab;
          return (
            <Link
              key={t.id}
              href={urlMet('/dashboard/analyse', t.id === 'verkoop' ? {} : { tab: t.id }, pp)}
              aria-current={aan ? 'page' : undefined}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${aan ? 'border-amber-600 text-ink-900' : 'border-transparent text-warm hover:text-ink-800'}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-3 text-[13px] text-warm">{huidig.vraag}</p>

      <div className="mt-4">
        <Suspense key={`${tab}-${periode.van}-${periode.tot}-${periode.vergelijk}-${slaap}-${norm}`} fallback={<Laden />}>
          <TabInhoud tab={tab} periode={periode} slaap={slaap} norm={norm} />
        </Suspense>
      </div>

      <section className="panel mt-6 p-4">
        <h2 className="font-display text-base font-bold text-ink-900">Samenvatting door AI</h2>
        <p className="mt-0.5 text-[12px] text-warm">
          Een paar punten over {periode.label}: wat valt op, wat gaat goed en waar je op moet letten. Controleer de getallen hierboven voor je erop stuurt.
        </p>
        <div className="mt-3">
          <AiSamenvatting params={pp} periodeLabel={periode.label} />
        </div>
      </section>
    </main>
  );
}
