import Link from 'next/link';

/**
 * Kleine grafieken voor de analyse van klachten en retouren. Inline SVG, geen
 * bibliotheek, in de kleuren van het dashboard: ink voor de gewone staven, amber
 * alleen voor wat aandacht vraagt.
 */

export type StaafRij = { label: string; waarde: number; sub?: string; href?: string; nadruk?: boolean };

/** Horizontale staven met label links en aantal rechts. */
export function Staven({
  rijen,
  leegTekst = 'Nog geen gegevens.',
  opmaak = (n: number) => String(n),
}: {
  rijen: StaafRij[];
  leegTekst?: string;
  opmaak?: (n: number) => string;
}) {
  if (rijen.length === 0) return <p className="text-[13px] text-warm">{leegTekst}</p>;
  const max = Math.max(1, ...rijen.map((r) => r.waarde));
  return (
    <ul className="space-y-1.5">
      {rijen.map((r) => {
        const breed = Math.max(2, (r.waarde / max) * 100);
        const label = (
          <span className="block truncate text-[13px] text-ink-800" title={r.label}>
            {r.label}
            {r.sub && <span className="ml-1.5 text-[12px] text-warm">{r.sub}</span>}
          </span>
        );
        return (
          <li key={r.label} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3">
            {r.href ? (
              <Link href={r.href} className="min-w-0 hover:underline">
                {label}
              </Link>
            ) : (
              <span className="min-w-0">{label}</span>
            )}
            <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-2.5 w-full" aria-hidden>
              <rect x={0} y={0} width={100} height={10} rx={2} className="fill-ink-50" />
              <rect x={0} y={0} width={breed} height={10} rx={2} className={r.nadruk ? 'fill-amber-500' : 'fill-ink-700'} />
            </svg>
            <span className="w-12 text-right text-[13px] font-semibold tabular-nums text-ink-900">{opmaak(r.waarde)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Staafjes per maand (oudste links), de laatste maand in amber. */
export function MaandTrend({ maanden, omschrijving }: { maanden: { label: string; waarde: number }[]; omschrijving: string }) {
  const H = 260;
  const B = 100 * maanden.length;
  const max = Math.max(1, ...maanden.map((m) => m.waarde));
  const leeg = maanden.every((m) => m.waarde === 0);
  return (
    <figure>
      <svg
        viewBox={`0 0 ${B} ${H + 30}`}
        className={`h-auto w-full ${leeg ? 'opacity-40' : ''}`}
        role="img"
        aria-label={`${omschrijving}: ${maanden.map((m) => `${m.label} ${m.waarde}`).join(', ')}`}
      >
        <line x1={0} x2={B} y1={H} y2={H} className="stroke-ink-200" strokeWidth={2} />
        {maanden.map((m, i) => {
          const h = (m.waarde / max) * (H - 34);
          const laatste = i === maanden.length - 1;
          return (
            <g key={`${m.label}-${i}`}>
              <rect x={i * 100 + 22} y={H - h} width={56} height={Math.max(h, m.waarde > 0 ? 2 : 0)} rx={3} className={laatste ? 'fill-amber-500' : 'fill-ink-700'} />
              {m.waarde > 0 && (
                <text x={i * 100 + 50} y={H - h - 8} textAnchor="middle" className="fill-ink-700 text-[24px] font-semibold tabular-nums">
                  {m.waarde}
                </text>
              )}
              <text x={i * 100 + 50} y={H + 26} textAnchor="middle" className="fill-ink-400 text-[22px]">
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export type Deel = { label: string; waarde: number; toon: 'amber' | 'donker' | 'midden' | 'licht' };
const TOON: Record<Deel['toon'], string> = {
  amber: 'fill-amber-500',
  donker: 'fill-ink-800',
  midden: 'fill-ink-400',
  licht: 'fill-ink-200',
};
const TOON_BG: Record<Deel['toon'], string> = {
  amber: 'bg-amber-500',
  donker: 'bg-ink-800',
  midden: 'bg-ink-400',
  licht: 'bg-ink-200',
};

/** Eén gestapelde balk: hoe een totaal is opgebouwd (bijv. te klein / te groot / overig). */
export function VerdelingBalk({ delen }: { delen: Deel[] }) {
  const totaal = delen.reduce((n, d) => n + d.waarde, 0);
  if (totaal === 0) return <span className="text-[12px] text-ink-400">-</span>;
  let x = 0;
  return (
    <svg
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      className="h-2.5 w-full min-w-[80px]"
      role="img"
      aria-label={delen.filter((d) => d.waarde > 0).map((d) => `${d.label} ${d.waarde}`).join(', ')}
    >
      {delen.map((d) => {
        const w = (d.waarde / totaal) * 100;
        const el = <rect key={d.label} x={x} y={0} width={w} height={10} className={TOON[d.toon]} />;
        x += w;
        return el;
      })}
    </svg>
  );
}

export function Legenda({ delen }: { delen: Pick<Deel, 'label' | 'toon'>[] }) {
  return (
    <p className="flex flex-wrap items-center gap-3 text-[11px] text-warm">
      {delen.map((d) => (
        <span key={d.label} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${TOON_BG[d.toon]}`} />
          {d.label}
        </span>
      ))}
    </p>
  );
}

/** Kaal getal-blokje voor in een paneel (niet klikbaar, anders dan KpiTegel). */
export function Kengetal({ label, waarde, sub }: { label: string; waarde: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[12px] font-medium text-warm">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums text-ink-900">{waarde}</p>
      {sub && <p className="mt-0.5 text-[12px] text-warm">{sub}</p>}
    </div>
  );
}

/** Duur in uren als leesbare tekst: "3 u", "1,5 dag". */
export function duurTekst(uren: number | null): string {
  if (uren == null || !Number.isFinite(uren)) return '-';
  if (uren < 1) return `${Math.max(1, Math.round(uren * 60))} min`;
  if (uren < 48) return `${uren < 10 ? uren.toFixed(1).replace('.', ',') : Math.round(uren)} u`;
  const dagen = uren / 24;
  return `${dagen < 10 ? dagen.toFixed(1).replace('.', ',') : Math.round(dagen)} dagen`;
}
