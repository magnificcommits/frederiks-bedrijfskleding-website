import Link from 'next/link';
import {
  PERIODE_LABEL,
  VERGELIJK_KEUZES,
  VERGELIJK_LABEL,
  periodeParams,
  urlMet,
  type Periode,
  type PeriodeKeuze,
} from '@/lib/kms/analysePeriode';

const STANDAARD: PeriodeKeuze[] = ['maand', 'vorige-maand', 'kwartaal', 'vorig-kwartaal', 'jaar', 'vorig-jaar', '12m'];

/**
 * Periodekiezer die alles in de URL zet: vaste periodes en de vergelijking als
 * links, een eigen bereik via een gewoon GET-formulier. Werkt zonder JavaScript
 * en een weergave is te delen of te bookmarken.
 */
export default function PeriodeKiezer({
  periode,
  pad,
  bewaar = {},
  keuzes = STANDAARD,
  metVergelijking = true,
}: {
  periode: Periode;
  pad: string;
  /** Overige parameters die blijven staan (tab, klant). */
  bewaar?: Record<string, string | undefined>;
  keuzes?: PeriodeKeuze[];
  metVergelijking?: boolean;
}) {
  const url = (keuze: PeriodeKeuze, vergelijk = periode.vergelijk) =>
    urlMet(pad, bewaar, periodeParams({ keuze, van: periode.van, tot: periode.tot, vergelijk }, true));

  return (
    <div className="panel mt-4 p-3 print:hidden">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Periode">
        {keuzes.map((k) => (
          <Link key={k} href={url(k)} className={`chip ${periode.keuze === k ? 'chip-aan' : ''}`} aria-current={periode.keuze === k ? 'true' : undefined}>
            {PERIODE_LABEL[k]}
          </Link>
        ))}
        <details className="group relative">
          <summary className={`chip cursor-pointer list-none ${periode.keuze === 'eigen' ? 'chip-aan' : ''}`}>
            {PERIODE_LABEL.eigen}
          </summary>
          <form method="get" action={pad} className="absolute right-0 z-30 mt-1 flex w-[300px] sm:left-0 sm:right-auto max-w-[calc(100vw-2.5rem)] flex-col gap-2 rounded-lg border border-line bg-white p-3 shadow-card">
            {Object.entries(bewaar).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            <input type="hidden" name="periode" value="eigen" />
            {periode.vergelijk !== 'vorige' && <input type="hidden" name="vgl" value={periode.vergelijk} />}
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="veld-label">Van</span>
                <input type="date" name="van" defaultValue={periode.van} max={periode.vandaag} className="veld" required />
              </label>
              <label className="block">
                <span className="veld-label">Tot en met</span>
                <input type="date" name="tot" defaultValue={periode.tot} max={periode.vandaag} className="veld" required />
              </label>
            </div>
            <button type="submit" className="knop-donker">Toon periode</button>
          </form>
        </details>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-warm">
        <span>
          <span className="font-semibold text-ink-900">{periode.label}</span>
          {periode.vgl && <> vergeleken met <span className="font-semibold text-ink-800">{periode.vgl.label}</span></>}
        </span>
        {metVergelijking && (
          <span className="flex flex-wrap items-center gap-1" role="group" aria-label="Vergelijken met">
            <span className="mr-1">Vergelijk met</span>
            {VERGELIJK_KEUZES.map((v) => (
              <Link
                key={v}
                href={url(periode.keuze, v)}
                className={`rounded px-2 py-0.5 font-semibold transition-colors ${periode.vergelijk === v ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-mist'}`}
                aria-current={periode.vergelijk === v ? 'true' : undefined}
              >
                {VERGELIJK_LABEL[v].toLowerCase()}
              </Link>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
