'use client';

import { useEffect, useRef, useState } from 'react';
import type { MaandInkoop } from '@/lib/kms/leveranciers';

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const euroKort = (n: number) => (n >= 1000 ? `€${(n / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}k` : `€${Math.round(n)}`);

function netteMax(v: number): number {
  if (v <= 0) return 100;
  const macht = 10 ** Math.floor(Math.log10(v));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * macht >= v) return f * macht;
  return 10 * macht;
}

const HOOGTE = 180;
const M = { boven: 10, onder: 24, links: 44, rechts: 6 };

/**
 * Inkoop per maand bij deze leverancier, twaalf maanden, op besteldatum en
 * tegen inkoopprijs. Zelfde opbouw als de omzetgrafiek op het overzicht: de
 * lopende maand in oranje, de rest donker, hover toont het bedrag.
 */
export default function InkoopGrafiek({ maanden }: { maanden: MaandInkoop[] }) {
  const [actief, setActief] = useState<number | null>(null);
  const [breedte, setBreedte] = useState(640);
  const kader = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = kader.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBreedte(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totaal = maanden.reduce((t, m) => t + m.waarde, 0);
  const leeg = totaal === 0;
  const max = netteMax(Math.max(...maanden.map((m) => m.waarde)));
  const binnenB = breedte - M.links - M.rechts;
  const binnenH = HOOGTE - M.boven - M.onder;
  const band = binnenB / maanden.length;
  const staaf = Math.min(36, band * 0.56);
  const y = (v: number) => M.boven + binnenH - (v / max) * binnenH;
  const laatste = maanden.length - 1;
  const tip = actief !== null ? maanden[actief] : null;

  return (
    <section className="panel p-4" aria-labelledby="inkoop-kop">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="inkoop-kop" className="font-display text-base font-bold text-ink-900">Inkoop per maand</h2>
        {!leeg && (
          <p className="text-[12px] text-warm">
            <span className="font-display text-lg font-bold tabular-nums text-ink-900">{euro(totaal)}</span> in 12 maanden
          </p>
        )}
      </div>
      <div ref={kader} className="relative mt-2" style={{ minHeight: HOOGTE }}>
        <svg
          width="100%"
          height={HOOGTE}
          viewBox={`0 0 ${breedte} ${HOOGTE}`}
          role="img"
          aria-label={`Inkoop per maand: ${maanden.map((m) => `${m.labelLang} ${euro(m.waarde)}`).join(', ')}`}
          className={`block ${leeg ? 'opacity-40' : ''}`}
          onPointerLeave={() => setActief(null)}
        >
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={M.links} x2={breedte - M.rechts} y1={y(f * max)} y2={y(f * max)} className={f === 0 ? 'stroke-ink-200' : 'stroke-line'} strokeDasharray={f === 0 ? undefined : '3 4'} />
              <text x={M.links - 6} y={y(f * max)} dy="0.32em" textAnchor="end" className="fill-ink-400 text-[10px] tabular-nums">{euroKort(f * max)}</text>
            </g>
          ))}
          {maanden.map((m, i) => {
            const cx = M.links + band * i + band / 2;
            const nu = i === laatste;
            return (
              <g key={m.sleutel} className={`transition-opacity ${actief !== null && actief !== i ? 'opacity-50' : ''}`}>
                {m.waarde > 0 ? (
                  <rect x={cx - staaf / 2} y={y(m.waarde)} width={staaf} height={Math.max(1, y(0) - y(m.waarde))} rx={3} className={nu ? 'fill-amber-500' : 'fill-ink-800'} />
                ) : (
                  <rect x={cx - staaf / 2} y={y(0) - 2} width={staaf} height={2} rx={1} className={nu ? 'fill-amber-300' : 'fill-ink-100'} />
                )}
                <text x={cx} y={HOOGTE - 7} textAnchor="middle" className={`text-[10px] ${nu ? 'fill-ink-900 font-semibold' : 'fill-ink-400'}`}>{m.label}</text>
                <rect x={M.links + band * i} y={M.boven} width={band} height={binnenH} fill="transparent" onPointerEnter={() => setActief(i)} />
              </g>
            );
          })}
        </svg>
        {tip && !leeg && (
          <div
            className="pointer-events-none absolute z-10 w-max -translate-x-1/2 rounded-md border border-line bg-white px-3 py-2 text-[12px] shadow-card"
            style={{ left: Math.min(Math.max(M.links + band * (actief ?? 0) + band / 2, 70), breedte - 70), top: 4 }}
          >
            <p className="font-semibold capitalize text-ink-900">{tip.labelLang}</p>
            <p className="font-display text-base font-bold tabular-nums text-ink-900">{euro(tip.waarde)}</p>
            <p className="text-warm">{tip.regels} {tip.regels === 1 ? 'regel' : 'regels'}</p>
          </div>
        )}
        {leeg && (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] text-warm">
            Nog niets besteld bij deze leverancier. Zodra er inkoopregels op besteld staan, groeit hier de grafiek.
          </p>
        )}
      </div>
    </section>
  );
}
