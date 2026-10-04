import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Consistente lege staat voor dashboardlijsten: één vormgeving overal, in plaats van
 * losse zinnetjes per pagina. Zeg wat hier komt te staan en geef de stap die het vult:
 * "Nog geen orders" + "Maak je eerste order".
 *
 * - `actieHref`/`actieLabel`: de primaire stap (oranje knop).
 * - `tweedeHref`/`tweedeLabel`: een rustige tweede weg (bijv. importeren).
 * - `soort="gefilterd"`: er is wel data, maar niets past bij zoekterm of filter.
 */
export default function EmptyState({
  titel,
  tekst,
  actieHref,
  actieLabel,
  tweedeHref,
  tweedeLabel,
  soort = 'leeg',
  className = '',
  children,
}: {
  titel?: string;
  tekst: ReactNode;
  actieHref?: string;
  actieLabel?: string;
  tweedeHref?: string;
  tweedeLabel?: string;
  soort?: 'leeg' | 'gefilterd';
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-lg border border-dashed border-ink-200 bg-mist/70 px-6 py-10 text-center ${className}`}
    >
      <span aria-hidden="true" className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink-400 ring-1 ring-line">
        {soort === 'gefilterd' ? (
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13.2 13.2L17 17" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M3 7.5h14v8.5H3z" />
            <path d="M3 7.5L5.5 4h9L17 7.5" />
            <path d="M8 11h4" strokeLinecap="round" />
          </svg>
        )}
      </span>
      {titel && <p className="font-display text-base font-bold text-ink-900">{titel}</p>}
      <p className={`max-w-md text-[13px] leading-relaxed text-warm ${titel ? 'mt-1' : ''}`}>{tekst}</p>
      {((actieHref && actieLabel) || (tweedeHref && tweedeLabel) || children) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {actieHref && actieLabel && (
            <Link href={actieHref} className={soort === 'gefilterd' ? 'knop-stil knop-groot' : 'knop-primair knop-groot'}>
              {actieLabel}
            </Link>
          )}
          {tweedeHref && tweedeLabel && (
            <Link href={tweedeHref} className="knop-tekst knop-groot">
              {tweedeLabel}
            </Link>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
