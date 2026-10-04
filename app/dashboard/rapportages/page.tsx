import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { laadKlanten } from '@/lib/kms/analyseData';
import { PERIODE_LABEL, leesPeriode, periodeParams, urlMet } from '@/lib/kms/analysePeriode';
import { RAPPORTEN, RAPPORT_GROEPEN, type RapportDef } from '@/lib/kms/rapportages';
import KlantFilter from './_delen/KlantFilter';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rapportages', robots: { index: false, follow: false } };

type SP = { periode?: string; van?: string; tot?: string };

const GROEP_UITLEG: Record<(typeof RAPPORT_GROEPEN)[number], string> = {
  Verkoop: 'Omzet uitgesplitst, en hoe offertes uitpakken.',
  Boekhouding: 'Voor de btw-aangifte en het debiteurenbeheer. Exporteer naar Excel en stuur door.',
  'Klanten en budget': 'Overzichten per klant: wie kreeg wat, wat is er nog van het budget.',
  'Inkoop en voorraad': 'Wat is er besteld bij leveranciers en wat ligt er op de plank.',
};

function RapportKaart({ def, pp }: { def: RapportDef; pp: Record<string, string> }) {
  const params = def.periode ? pp : {};
  const href = urlMet(`/dashboard/rapportages/${def.key}`, params);
  const exp = (formaat: string) => urlMet('/dashboard/rapportages/export', { rapport: def.key, formaat }, params);
  return (
    <li className="panel flex flex-col p-4 transition-colors hover:border-ink-300">
      <h3 className="font-display text-[15px] font-bold text-ink-900">
        <Link href={href} className="hover:underline">{def.titel}</Link>
      </h3>
      <p className="mt-1 flex-1 text-[13px] leading-snug text-warm">{def.beschrijving}</p>
      <p className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <span className="badge-rust">{def.periode ? `standaard ${PERIODE_LABEL[def.standaardPeriode ?? 'maand'].toLowerCase()}` : 'stand van vandaag'}</span>
        {def.klant && <span className="badge-rust">per klant te filteren</span>}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Link href={href} className="knop-donker">Bekijken</Link>
        <a href={exp('xlsx')} className="knop-stil">Excel</a>
        <a href={exp('csv')} className="knop-tekst">CSV</a>
      </div>
    </li>
  );
}

export default async function RapportagesPage({ searchParams }: { searchParams: Promise<SP> }) {
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

  // Kom je uit Analyse met een periode, dan openen de rapporten op die periode.
  const meegegeven = !!(sp.periode || sp.van);
  const periode = leesPeriode(sp);
  const pp = meegegeven ? periodeParams(periode, true) : {};
  delete pp.vgl;
  const klanten = [...(await laadKlanten()).values()].map((k) => ({ id: k.id, naam: k.naam }));

  return (
    <main className="container-app pb-12">
      <div className="dash-kop justify-between gap-4">
        <h1 className="dash-h1">Rapportages</h1>
        <nav className="flex items-center gap-1 text-[13px]" aria-label="Verwante pagina's">
          <Link href="/dashboard" className="knop-tekst">Startpagina</Link>
          <Link href={urlMet('/dashboard/analyse', meegegeven ? periodeParams(periode) : {})} className="knop-tekst">Analyse</Link>
        </nav>
      </div>

      <p className="dash-sub mt-3 max-w-3xl">
        Vaste overzichten die je exporteert, afdrukt of doorstuurt: naar de boekhouder, naar een klant of voor je eigen administratie.
        Elk rapport heeft een periode- en klantfilter, totalen en een export naar Excel. Wil je uitzoeken waarom een cijfer zo is?
        Dat doe je in <Link href="/dashboard/analyse" className="font-semibold text-ink-800 underline-offset-2 hover:underline">analyse</Link>.
      </p>
      {meegegeven && (
        <p className="mt-2 text-[13px] text-warm">
          Rapporten met een periode openen op <span className="font-semibold text-ink-900">{periode.label}</span>.{' '}
          <Link href="/dashboard/rapportages" className="font-semibold text-ink-800 underline-offset-2 hover:underline">Standaardperiodes gebruiken</Link>
        </p>
      )}

      <section className="panel mt-5 grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Rapport per klant</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-snug text-warm">
            Eén pagina om naar je klant te sturen: het jaaroverzicht met omzet per maand, wat iedere medewerker heeft gekregen en hoeveel budget er nog over is.
            Afdrukken of opslaan als pdf.
          </p>
        </div>
        <KlantFilter pad="/dashboard/rapportages/klant" klanten={klanten} huidig={null} bewaar={{}} label="Kies een klant" legeOptie="Kies een klant…" />
      </section>

      {RAPPORT_GROEPEN.map((groep) => {
        const lijst = RAPPORTEN.filter((r) => r.groep === groep);
        if (!lijst.length) return null;
        return (
          <section key={groep} className="mt-8">
            <h2 className="font-display text-lg font-bold text-ink-900">{groep}</h2>
            <p className="mt-0.5 text-[13px] text-warm">{GROEP_UITLEG[groep]}</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lijst.map((def) => <RapportKaart key={def.key} def={def} pp={pp} />)}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
