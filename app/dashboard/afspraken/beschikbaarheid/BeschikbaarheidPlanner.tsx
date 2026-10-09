'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PlanBlok, PlanDag, Planner } from '@/lib/afspraken/planner';
import { DAGEN_KORT, DAGEN_LANG, MAANDEN_KORT } from '@/app/dashboard/taken/tijd';
import { toon } from '@/components/dashboard/ui/toast';
import { blokkeerPeriodeActie, zetDagActie, zetTijdenActie } from './actions';

const dagKop = (d: string) => {
  const dt = new Date(`${d}T12:00:00Z`);
  return { kort: DAGEN_KORT[dt.getUTCDay()], lang: DAGEN_LANG[dt.getUTCDay()], dag: dt.getUTCDate(), maand: MAANDEN_KORT[dt.getUTCMonth()] };
};

const BLOK_STIJL: Record<PlanBlok['status'], string> = {
  open: 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
  dicht: 'border-line bg-[repeating-linear-gradient(135deg,#f1f0ee,#f1f0ee_6px,#e7e5e2_6px,#e7e5e2_12px)] text-warm hover:border-ink-300',
  geboekt: 'border-ink-900 bg-ink-900 text-white',
  agenda: 'border-ink-600 bg-ink-600 text-white',
  pauze: 'border-transparent bg-transparent text-ink-300',
  voorbij: 'border-transparent bg-mist/60 text-ink-300',
};

function dagStatus(d: PlanDag): { tekst: string; klasse: string } {
  if (d.dicht && !d.werkdag && !d.extraOpen) return { tekst: 'Geen werkdag', klasse: 'bg-mist text-warm' };
  if (d.dicht) return { tekst: 'Dicht', klasse: 'bg-ink-200 text-ink-800' };
  if (d.vol) return { tekst: `Vol (${d.geboekt})`, klasse: 'bg-amber-100 text-amber-900' };
  const open = d.blokken.filter((b) => b.status === 'open').length;
  if (!open) return { tekst: 'Niets vrij', klasse: 'bg-mist text-warm' };
  return { tekst: d.extraOpen ? 'Extra open' : `${open} vrij`, klasse: 'bg-emerald-100 text-emerald-900' };
}

export function BeschikbaarheidPlanner({
  planner,
  vandaag,
  maandag,
  vorige,
  volgende,
  dezeWeek,
}: {
  planner: Planner;
  vandaag: string;
  maandag: string;
  vorige: string | null;
  volgende: string;
  dezeWeek: string;
}) {
  const router = useRouter();
  const [dagen, setDagen] = useState(planner.dagen);
  const [gekozen, setGekozen] = useState(() => planner.dagen.find((d) => d.datum >= vandaag)?.datum ?? planner.dagen[0]?.datum);
  const [bezig, start] = useTransition();
  const [van, setVan] = useState('');
  const [tot, setTot] = useState('');

  useEffect(() => {
    setDagen(planner.dagen);
    setGekozen((g) => (planner.dagen.some((d) => d.datum === g) ? g : planner.dagen.find((d) => d.datum >= vandaag)?.datum ?? planner.dagen[0]?.datum));
  }, [planner, vandaag]);

  /** Lokaal meteen bijwerken, daarna opslaan; mislukt het, dan terug. */
  function werkBij(nieuw: PlanDag[], opslaan: () => Promise<{ ok: boolean; fout?: string }>, melding?: string) {
    const oud = dagen;
    setDagen(nieuw);
    start(async () => {
      const r = await opslaan();
      if (!r.ok) {
        setDagen(oud);
        toon(r.fout ?? 'Opslaan lukte niet', { soort: 'fout' });
      } else {
        if (melding) toon(melding);
        router.refresh();
      }
    });
  }

  function wisselTijden(datum: string, tijden: string[], dicht: boolean) {
    if (!tijden.length) return;
    const nieuw = dagen.map((d) =>
      d.datum !== datum
        ? d
        : { ...d, blokken: d.blokken.map((b) => (tijden.includes(b.tijd) && (b.status === 'open' || b.status === 'dicht') ? { ...b, status: dicht ? 'dicht' : 'open' } as PlanBlok : b)) },
    );
    werkBij(nieuw, () => zetTijdenActie(datum, tijden, dicht));
  }

  function zetDag(d: PlanDag, stand: 'dicht' | 'open') {
    const nieuw = dagen.map((x) =>
      x.datum !== d.datum
        ? x
        : {
            ...x,
            dicht: stand === 'dicht',
            extraOpen: stand === 'open' && !x.werkdag,
            blokken: x.blokken.map((b) => (b.status === 'open' || b.status === 'dicht' ? { ...b, status: stand === 'dicht' ? 'dicht' : 'open' } as PlanBlok : b)),
          },
    );
    const { lang, dag, maand } = dagKop(d.datum);
    werkBij(nieuw, () => zetDagActie(d.datum, stand), `${lang} ${dag} ${maand} staat ${stand === 'dicht' ? 'dicht' : 'open'}`);
  }

  const binnenDeel = (d: PlanDag, deel: 'ochtend' | 'middag') =>
    d.blokken.filter((b) => (deel === 'ochtend' ? b.tijd < '12:00' : b.tijd >= '12:00') && (b.status === 'open' || b.status === 'dicht'));
  const deelDicht = (d: PlanDag, deel: 'ochtend' | 'middag') => {
    const binnen = binnenDeel(d, deel);
    return binnen.length > 0 && binnen.every((b) => b.status === 'dicht');
  };

  function dagdeel(d: PlanDag, deel: 'ochtend' | 'middag') {
    wisselTijden(d.datum, binnenDeel(d, deel).map((b) => b.tijd), !deelDicht(d, deel));
  }

  function periode() {
    if (!van || !tot) return;
    werkBij(
      dagen.map((d) => (d.datum >= van && d.datum <= tot ? { ...d, dicht: true, blokken: d.blokken.map((b) => (b.status === 'open' ? { ...b, status: 'dicht' } as PlanBlok : b)) } : d)),
      () => blokkeerPeriodeActie(van, tot),
      'Periode staat dicht',
    );
    setVan('');
    setTot('');
  }

  const tijden = dagen[0]?.blokken.map((b) => b.tijd) ?? [];
  const dag = dagen.find((d) => d.datum === gekozen) ?? dagen[0];
  const weekTekst = (() => {
    const a = dagKop(maandag);
    const b = dagKop(dagen[dagen.length - 1]?.datum ?? maandag);
    return `${a.dag} ${a.maand} t/m ${b.dag} ${b.maand}`;
  })();

  const BlokKnop = ({ d, b, groot }: { d: PlanDag; b: PlanBlok; groot?: boolean }) => {
    const klikbaar = (b.status === 'open' || b.status === 'dicht') && !(d.dicht && b.status === 'dicht' && !groot && false);
    const tekst = b.status === 'open' ? 'open' : b.status === 'dicht' ? 'dicht' : b.status === 'geboekt' || b.status === 'agenda' ? b.label ?? '' : '';
    const klasse = `w-full rounded-md border text-left transition ${groot ? 'flex min-h-[48px] items-center gap-3 px-3 text-sm' : 'h-8 px-1.5 text-[11px]'} ${BLOK_STIJL[b.status]}`;
    if (b.status === 'geboekt' || b.status === 'agenda') {
      return (
        <Link href={b.href ?? '#'} className={`${klasse} block truncate ${groot ? '' : 'leading-8'}`} title={b.label}>
          {groot && <span className="w-12 shrink-0 font-semibold tabular-nums">{b.tijd}</span>}
          <span className="truncate">{tekst}</span>
        </Link>
      );
    }
    if (!klikbaar) {
      return (
        <div className={`${klasse} ${groot ? '' : 'leading-8'}`} aria-hidden={!groot}>
          {groot && <span className="w-12 shrink-0 tabular-nums">{b.tijd}</span>}
          {groot && <span>{b.status === 'pauze' ? 'pauze' : 'voorbij'}</span>}
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => {
          if (d.dicht && b.status === 'dicht') {
            // In een dichte dag opent een tik de hele dag niet; vraag eerst de dag te openen.
            toon('Deze dag staat helemaal dicht. Zet eerst de dag open.');
            return;
          }
          wisselTijden(d.datum, [b.tijd], b.status === 'open');
        }}
        aria-pressed={b.status === 'dicht'}
        aria-label={`${b.tijd} ${b.status === 'open' ? 'open, tik om dicht te zetten' : 'dicht, tik om open te zetten'}`}
        className={`${klasse} font-semibold ${groot ? '' : 'leading-8'}`}
      >
        {groot && <span className="w-12 shrink-0 tabular-nums">{b.tijd}</span>}
        <span>{tekst}</span>
      </button>
    );
  };

  const DagKnoppen = ({ d }: { d: PlanDag }) => (
    <div className="flex flex-wrap gap-1.5">
      {d.dicht ? (
        <button type="button" onClick={() => zetDag(d, 'open')} className="knop-stil px-2.5 py-1 text-xs">{d.werkdag ? 'Dag open' : 'Toch open'}</button>
      ) : (
        <>
          <button type="button" onClick={() => zetDag(d, 'dicht')} className="knop-stil px-2.5 py-1 text-xs">Dag dicht</button>
          {(['ochtend', 'middag'] as const).map((deel) =>
            binnenDeel(d, deel).length > 0 ? (
              <button key={deel} type="button" onClick={() => dagdeel(d, deel)} className="knop-stil px-2.5 py-1 text-xs">
                {deel === 'ochtend' ? 'Ochtend' : 'Middag'} {deelDicht(d, deel) ? 'open' : 'dicht'}
              </button>
            ) : null,
          )}
        </>
      )}
    </div>
  );

  return (
    <div className={`mt-4 ${bezig ? 'cursor-progress' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        {vorige ? <Link href={`?week=${vorige}`} className="knop-stil px-3" aria-label="Vorige week">‹</Link> : <span className="knop-stil pointer-events-none px-3 opacity-40">‹</span>}
        <span className="min-w-[10rem] text-center text-sm font-bold text-ink-900">{weekTekst}</span>
        <Link href={`?week=${volgende}`} className="knop-stil px-3" aria-label="Volgende week">›</Link>
        {maandag !== dezeWeek && <Link href="?" className="knop-tekst text-sm">Deze week</Link>}
        <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-warm">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-50" />open</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-line bg-[repeating-linear-gradient(135deg,#f1f0ee,#f1f0ee_3px,#e2e0dd_3px,#e2e0dd_6px)]" />dicht</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-ink-900" />geboekt</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-ink-600" />in je agenda</span>
        </div>
      </div>

      {/* Telefoon: één dag tegelijk, grote knoppen. */}
      <div className="mt-4 md:hidden">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {dagen.map((d) => {
            const k = dagKop(d.datum);
            const s = dagStatus(d);
            return (
              <button
                key={d.datum}
                type="button"
                onClick={() => setGekozen(d.datum)}
                className={`min-w-[4.25rem] shrink-0 rounded-lg border-2 px-2 py-1.5 text-center ${gekozen === d.datum ? 'border-amber-500 bg-amber-50' : 'border-line bg-white'}`}
              >
                <span className="block text-[11px] text-warm">{k.kort}</span>
                <span className="block text-sm font-bold text-ink-900">{k.dag} {k.maand}</span>
                <span className={`mt-0.5 block rounded px-1 text-[10px] font-semibold ${s.klasse}`}>{s.tekst}</span>
              </button>
            );
          })}
        </div>
        {dag && (
          <div className="mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-lg font-extrabold capitalize text-ink-900">{dagKop(dag.datum).lang} {dagKop(dag.datum).dag} {dagKop(dag.datum).maand}</p>
              <DagKnoppen d={dag} />
            </div>
            <div className="mt-2 grid gap-1.5">
              {dag.blokken.filter((b) => b.status !== 'pauze').map((b) => <BlokKnop key={b.tijd} d={dag} b={b} groot />)}
            </div>
          </div>
        )}
      </div>

      {/* Groter scherm: de hele week in één raster. */}
      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-line bg-white md:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-14 border-b border-line" />
              {dagen.map((d) => {
                const k = dagKop(d.datum);
                const s = dagStatus(d);
                return (
                  <th key={d.datum} className={`border-b border-l border-line px-1.5 py-2 text-left align-top font-normal ${d.datum === vandaag ? 'bg-amber-50/60' : ''}`}>
                    <span className="block text-xs text-warm">{k.kort}</span>
                    <span className="block font-bold text-ink-900">{k.dag} {k.maand}</span>
                    <span className={`mt-1 inline-block rounded px-1.5 text-[10px] font-semibold ${s.klasse}`}>{s.tekst}</span>
                    <div className="mt-1.5"><DagKnoppen d={d} /></div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {tijden.map((t, rij) => (
              <tr key={t}>
                <td className="border-line pr-2 text-right align-middle text-[11px] tabular-nums text-warm">{t}</td>
                {dagen.map((d) => (
                  <td key={d.datum} className={`border-l border-line px-1 py-0.5 ${d.datum === vandaag ? 'bg-amber-50/40' : ''}`}>
                    <BlokKnop d={d} b={d.blokken[rij]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="font-semibold text-ink-900">Vrij of op vakantie?</p>
          <p className="mt-0.5 text-sm text-warm">Zet een hele periode in één keer dicht.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-warm">Van<input type="date" value={van} min={vandaag} onChange={(e) => { setVan(e.target.value); if (!tot || tot < e.target.value) setTot(e.target.value); }} className="veld mt-1 block" /></label>
            <label className="text-xs text-warm">Tot en met<input type="date" value={tot} min={van || vandaag} onChange={(e) => setTot(e.target.value)} className="veld mt-1 block" /></label>
            <button type="button" onClick={periode} disabled={!van || !tot} className="knop-donker">Zet dicht</button>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 text-sm text-warm">
          <p className="font-semibold text-ink-900">Hoe het werkt</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>Groen is open: daar kan een klant online boeken. Tik erop om hem dicht te zetten.</li>
            <li>Afspraken die je zelf in Taken zet, houden je ook bezet.</li>
            <li>Na {planner.maxPerDag} online afspraken op een dag staat die dag vanzelf vol.</li>
            <li>Je vaste werkdagen en tijden pas je aan onder <Link href="/dashboard/afspraken/instellingen" className="font-semibold text-amber-700 underline">Vaste werktijden</Link>.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
