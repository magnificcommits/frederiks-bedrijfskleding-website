'use client';

import { useState } from 'react';

/**
 * Kleine lijn met de laatste maanden, zo breed als de tegel. De lijn schaalt mee
 * (non-scaling-stroke houdt hem even dik); de punt is een HTML-element, zodat hij
 * rond blijft. Bij hover verschijnt maand en waarde.
 */
export default function Sparkline({
  waarden,
  labels,
  opmaak = 'aantal',
  omschrijving,
  hoogte = 36,
}: {
  waarden: number[];
  labels: string[];
  opmaak?: 'aantal' | 'euro';
  omschrijving: string;
  hoogte?: number;
}) {
  const [actief, setActief] = useState<number | null>(null);
  const n = waarden.length;
  if (n < 2) return null;

  const max = Math.max(...waarden);
  const min = Math.min(0, ...waarden);
  const bereik = max - min || 1;
  const pad = 4;
  const B = 100;
  const x = (i: number) => (i * B) / (n - 1);
  const y = (v: number) => hoogte - pad - ((v - min) / bereik) * (hoogte - pad * 2);
  const punten = waarden.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  const lijn = `M${punten.join(' L')}`;
  const vlak = `${lijn} L${B},${hoogte - pad} L0,${hoogte - pad} Z`;
  const toon = actief ?? n - 1;
  const fmt = (v: number) =>
    opmaak === 'euro'
      ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
      : String(v);
  const leeg = max === 0 && min === 0;

  return (
    <div className="w-full">
      <div
        className="relative w-full"
        style={{ height: hoogte }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
          setActief(Math.max(0, Math.min(n - 1, i)));
        }}
        onPointerLeave={() => setActief(null)}
      >
        <svg
          viewBox={`0 0 ${B} ${hoogte}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${omschrijving}: ${waarden.map((v, i) => `${labels[i]} ${fmt(v)}`).join(', ')}`}
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <line x1={0} x2={B} y1={hoogte - pad} y2={hoogte - pad} className="stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {!leeg && <path d={vlak} className="fill-amber-100/60" />}
          <path
            d={lijn}
            fill="none"
            className={leeg ? 'stroke-ink-200' : 'stroke-amber-600'}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {actief !== null && (
            <line
              x1={x(actief)} x2={x(actief)} y1={0} y2={hoogte - pad}
              className="stroke-ink-300" strokeDasharray="2 2" vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <span
          aria-hidden
          className={`pointer-events-none absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ${
            leeg ? 'bg-ink-300 ring-white' : 'bg-amber-600 ring-amber-500/20'
          }`}
          style={{ left: `${x(toon)}%`, top: y(waarden[toon]) }}
        />
      </div>
      <p className={`mt-1 flex justify-between text-[10px] leading-none tabular-nums ${actief !== null ? 'text-ink-700' : 'text-ink-400'}`}>
        {actief !== null ? (
          <span className="ml-auto font-semibold">{labels[actief]}: {fmt(waarden[actief])}</span>
        ) : (
          <>
            <span>{labels[0]}</span>
            <span>{labels[n - 1]}</span>
          </>
        )}
      </p>
    </div>
  );
}
