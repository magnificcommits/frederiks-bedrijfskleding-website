import { procent, type FunnelRij } from '@/lib/prospect/briefStatus';

/**
 * Funnel van een verzending: verstuurd, gescand, demo-portaal, contact, klant.
 * Per stap een balk (inline SVG, breedte ten opzichte van verstuurd), het aantal
 * en de conversie ten opzichte van de stap ervoor. `compact` is de smalle
 * versie voor in een lijst met verzendingen.
 */
export default function Funnel({ rijen, compact = false, titel }: { rijen: FunnelRij[]; compact?: boolean; titel?: string }) {
  const start = rijen[0]?.aantal ?? 0;
  const omschrijving = rijen.map((r) => `${r.label} ${r.aantal}`).join(', ');

  if (compact) {
    return (
      <div className="flex items-end gap-1" role="img" aria-label={`Funnel: ${omschrijving}`}>
        {rijen.map((r, i) => {
          const h = start ? Math.max(2, Math.round((r.aantal / start) * 28)) : 2;
          return (
            <div key={r.sleutel} className="flex w-9 flex-col items-center gap-0.5" title={`${r.label}: ${r.aantal}${r.vanVorige != null ? ` (${procent(r.vanVorige)} van de stap ervoor)` : ''}`}>
              <span className="text-[11px] font-semibold tabular-nums text-ink-800">{r.aantal}</span>
              <svg viewBox="0 0 36 28" className="h-7 w-9" aria-hidden="true">
                <rect x="0" y="0" width="36" height="28" rx="2" className="fill-mist" />
                <rect x="0" y={28 - h} width="36" height={h} rx="2" className={i === 0 ? 'fill-ink-800' : i === rijen.length - 1 ? 'fill-green-600' : 'fill-amber-500'} />
              </svg>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <figure className="m-0">
      {titel && <figcaption className="mb-2 text-[13px] font-semibold text-ink-900">{titel}</figcaption>}
      <ol className="space-y-2" aria-label={`Funnel: ${omschrijving}`}>
        {rijen.map((r, i) => {
          const deel = start ? r.aantal / start : 0;
          return (
            <li key={r.sleutel} className="grid grid-cols-[9.5rem_minmax(0,1fr)_5.5rem] items-center gap-3 text-[13px]">
              <span className="truncate text-ink-800">{r.label}</span>
              <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-4 w-full" aria-hidden="true">
                <rect x="0" y="0" width="100" height="10" rx="1.5" className="fill-mist" />
                {r.aantal > 0 && (
                  <rect x="0" y="0" width={Math.max(1.5, deel * 100)} height="10" rx="1.5" className={i === 0 ? 'fill-ink-800' : i === rijen.length - 1 ? 'fill-green-600' : 'fill-amber-500'} />
                )}
              </svg>
              <span className="text-right tabular-nums">
                <strong className="text-ink-900">{r.aantal}</strong>
                {r.vanVorige != null && <span className="ml-1.5 text-[12px] text-warm">{procent(r.vanVorige)}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {start > 0 && (
        <p className="mt-2 text-[12px] text-warm">
          Percentage = van de stap erboven. Van verstuurd naar klant: {procent(rijen[rijen.length - 1]?.vanStart ?? null)}.
        </p>
      )}
    </figure>
  );
}
