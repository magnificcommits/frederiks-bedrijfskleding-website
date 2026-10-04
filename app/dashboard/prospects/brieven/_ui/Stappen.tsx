import Link from 'next/link';

export type Stap = { sleutel: string; label: string; href: string; klaar: boolean; detail?: string };

/**
 * Stappenbalk van een verzending: 1. ontvangers, 2. brief, 3. controleren,
 * 4. printen, 5. versturen en volgen. Een afgeronde stap krijgt een vinkje, de
 * huidige een donkere achtergrond. Je kunt altijd terug naar een eerdere stap.
 */
export default function Stappen({ stappen, actief }: { stappen: Stap[]; actief: string }) {
  return (
    <nav aria-label="Stappen" className="overflow-x-auto print:hidden">
      <ol className="flex min-w-max items-stretch gap-1 rounded-lg border border-line bg-white p-1">
        {stappen.map((s, i) => {
          const nu = s.sleutel === actief;
          return (
            <li key={s.sleutel} className="flex">
              <Link
                href={s.href}
                aria-current={nu ? 'step' : undefined}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors ${nu ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-mist'}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums ${
                    nu ? 'bg-amber-500 text-ink-900' : s.klaar ? 'bg-green-100 text-green-800' : 'bg-ink-100 text-ink-600'
                  }`}
                >
                  {s.klaar && !nu ? (
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-semibold">{s.label}</span>
                  {s.detail && <span className={`text-[11px] ${nu ? 'text-white/70' : 'text-warm'}`}>{s.detail}</span>}
                </span>
                {s.klaar && <span className="sr-only">(klaar)</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
