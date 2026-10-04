import Link from 'next/link';
import { Delta, type Richting } from '@/components/dashboard/overzicht/KpiTegel';
import { aantal, euro, pct } from './opmaak';

export type BalkRij = {
  sleutel: string;
  label: string;
  waarde: number;
  vorige?: number | null;
  /** Kleine tekst onder het label, bijv. '3 klanten'. */
  sub?: string;
  /** Rechts naast de waarde, bijv. aandeel of marge. */
  extra?: string;
  href?: string | null;
  gedimd?: boolean;
};

/**
 * Horizontale balken met label en waarde, zoals "Grootste klanten" op de
 * startpagina. Elke rij met een href is een link naar de lijst eronder.
 */
export default function Balken({
  rijen,
  opmaak = 'euro',
  vergelijk,
  richting = 'hoger-beter',
  maxRijen,
}: {
  rijen: BalkRij[];
  opmaak?: 'euro' | 'aantal' | 'pct';
  /** Label van de vergelijkingsperiode; zonder label geen delta. */
  vergelijk?: string | null;
  richting?: Richting;
  maxRijen?: number;
}) {
  const zicht = maxRijen ? rijen.slice(0, maxRijen) : rijen;
  const max = Math.max(1e-9, ...zicht.map((r) => Math.abs(r.waarde)));
  const fmt = (n: number) => (opmaak === 'euro' ? euro(n) : opmaak === 'pct' ? pct(n) : aantal(n));

  return (
    <ol className="space-y-1">
      {zicht.map((r, i) => {
        const inhoud = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0">
                <span className={`block truncate font-medium ${r.gedimd ? 'text-warm' : 'text-ink-900'} ${r.href ? 'group-hover:underline' : ''}`}>
                  {r.label}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-ink-900">
                {fmt(r.waarde)}
                {r.extra && <span className="ml-1.5 text-[11px] text-ink-400">{r.extra}</span>}
              </span>
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-mist">
              <span
                className={`block h-full rounded-full ${r.gedimd ? 'bg-ink-200' : i === 0 ? 'bg-amber-500' : 'bg-ink-700'}`}
                style={{ width: `${Math.max(2, (Math.abs(r.waarde) / max) * 100)}%` }}
              />
            </span>
            {(r.sub || (vergelijk && r.vorige !== undefined && r.vorige !== null)) && (
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-warm">
                {r.sub && <span>{r.sub}</span>}
                {vergelijk && r.vorige !== undefined && r.vorige !== null && (
                  <Delta nu={r.waarde} vorige={r.vorige} richting={richting} vergelijk={vergelijk} />
                )}
              </span>
            )}
          </>
        );
        return (
          <li key={r.sleutel}>
            {r.href ? (
              <Link href={r.href} className="group -mx-2 block rounded-md px-2 py-1.5 transition-colors hover:bg-mist">
                {inhoud}
              </Link>
            ) : (
              <div className="-mx-2 px-2 py-1.5">{inhoud}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
