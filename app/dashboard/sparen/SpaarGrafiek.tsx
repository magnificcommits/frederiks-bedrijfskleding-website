'use client';

import { useEffect, useRef, useState } from 'react';
import type { SpaarMaand } from '@/lib/kms/sparenGrootboek';

const getal = (n: number) => new Intl.NumberFormat('nl-NL').format(Math.round(n || 0));
const kort = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}k` : String(Math.round(n)));

function netteMax(v: number): number {
  if (v <= 0) return 100;
  const macht = 10 ** Math.floor(Math.log10(v));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * macht >= v) return f * macht;
  return 10 * macht;
}

const HOOGTE = 230;
const M = { boven: 10, onder: 24, links: 40, rechts: 8 };

/**
 * Punten per maand, twaalf maanden. Boven de as wat erbij kwam, onder de as wat
 * eraf ging: ingewisseld (donker) en vervallen of teruggeboekt (licht). Zo zie je
 * in één oogopslag of de puntenpot groeit of leegloopt.
 */
export default function SpaarGrafiek({ maanden, euroPerPunt }: { maanden: SpaarMaand[]; euroPerPunt: number }) {
  const [actief, setActief] = useState<number | null>(null);
  const [breedte, setBreedte] = useState(720);
  const kader = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = kader.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBreedte(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxBoven = netteMax(Math.max(...maanden.map((m) => m.bijgeboekt), 1));
  const maxOnder = Math.max(...maanden.map((m) => m.ingewisseld + m.afgeboekt), 0);
  const onderSchaal = maxOnder > 0 ? netteMax(maxOnder) : maxBoven * 0.25;
  const totaalBij = maanden.reduce((s, m) => s + m.bijgeboekt, 0);
  const totaalAf = maanden.reduce((s, m) => s + m.ingewisseld + m.afgeboekt, 0);
  const leeg = totaalBij === 0 && totaalAf === 0;

  const binnenB = breedte - M.links - M.rechts;
  const binnenH = HOOGTE - M.boven - M.onder;
  // De as ligt zo dat boven en onder in verhouding staan.
  const asY = M.boven + binnenH * (maxBoven / (maxBoven + onderSchaal));
  const schaal = (asY - M.boven) / maxBoven;
  const band = binnenB / maanden.length;
  const staaf = Math.min(36, band * 0.56);
  const laatste = maanden.length - 1;
  const tip = actief !== null ? maanden[actief] : null;
  const tipX = actief !== null ? M.links + band * actief + band / 2 : 0;

  return (
    <section className="panel flex h-full flex-col p-4" aria-labelledby="spaar-grafiek-kop">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="spaar-grafiek-kop" className="font-display text-base font-bold text-ink-900">Punten per maand</h2>
          <p className="mt-0.5 text-[12px] text-warm">Erbij boven de lijn, eraf eronder</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-warm">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />gespaard</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ink-800" />ingewisseld</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ink-300" />vervallen of teruggeboekt</span>
        </div>
      </div>

      {!leeg && (
        <p className="mt-3 text-[12px] text-warm">
          <span className="font-display text-xl font-bold tabular-nums text-ink-900">+{getal(totaalBij)}</span>
          <span className="ml-1.5">gespaard,</span>
          <span className="ml-1.5 font-semibold tabular-nums text-ink-800">{getal(totaalAf)}</span> eraf in 12 maanden
          <span className="text-ink-400"> · netto {totaalBij - totaalAf >= 0 ? '+' : ''}{getal(totaalBij - totaalAf)} punten, {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format((totaalBij - totaalAf) * euroPerPunt)}</span>
        </p>
      )}

      <div ref={kader} className="relative mt-3 flex-1" style={{ minHeight: HOOGTE }}>
        <svg
          width="100%"
          height={HOOGTE}
          viewBox={`0 0 ${breedte} ${HOOGTE}`}
          role="img"
          aria-label={`Punten per maand: ${maanden.map((m) => `${m.labelLang} plus ${getal(m.bijgeboekt)}, min ${getal(m.ingewisseld + m.afgeboekt)}`).join('; ')}`}
          className={`block ${leeg ? 'opacity-40' : ''}`}
          onPointerLeave={() => setActief(null)}
        >
          {[0.5, 1].map((f) => (
            <g key={f}>
              <line x1={M.links} x2={breedte - M.rechts} y1={asY - maxBoven * f * schaal} y2={asY - maxBoven * f * schaal} className="stroke-line" strokeDasharray="3 4" />
              <text x={M.links - 6} y={asY - maxBoven * f * schaal} dy="0.32em" textAnchor="end" className="fill-ink-400 text-[10px] tabular-nums">
                {kort(maxBoven * f)}
              </text>
            </g>
          ))}
          <line x1={M.links} x2={breedte - M.rechts} y1={asY} y2={asY} className="stroke-ink-300" />
          <text x={M.links - 6} y={asY} dy="0.32em" textAnchor="end" className="fill-ink-400 text-[10px]">0</text>

          {maanden.map((m, i) => {
            const cx = M.links + band * i + band / 2;
            const x0 = cx - staaf / 2;
            const nu = i === laatste;
            const gedimd = actief !== null && actief !== i;
            const hBij = m.bijgeboekt * schaal;
            const hInw = m.ingewisseld * schaal;
            const hAf = m.afgeboekt * schaal;
            return (
              <g key={m.key} className={`transition-opacity ${gedimd ? 'opacity-45' : ''}`}>
                {hBij > 0 && <rect x={x0} y={asY - hBij} width={staaf} height={Math.max(1, hBij)} rx={2.5} className={nu ? 'fill-amber-400' : 'fill-amber-500'} />}
                {hInw > 0 && <rect x={x0} y={asY + 1} width={staaf} height={Math.max(1, hInw)} rx={2.5} className="fill-ink-800" />}
                {hAf > 0 && <rect x={x0} y={asY + 1 + hInw} width={staaf} height={Math.max(1, hAf)} rx={2.5} className="fill-ink-300" />}
                <text x={cx} y={HOOGTE - 6} textAnchor="middle" className={`text-[10px] ${nu ? 'fill-ink-900 font-semibold' : 'fill-ink-400'}`}>
                  {m.label}
                </text>
                <rect x={M.links + band * i} y={M.boven} width={band} height={binnenH} fill="transparent" onPointerEnter={() => setActief(i)} />
              </g>
            );
          })}
        </svg>

        {tip && !leeg && (
          <div
            className="pointer-events-none absolute z-10 w-max min-w-[160px] -translate-x-1/2 rounded-md border border-line bg-white px-3 py-2 text-[12px] shadow-card"
            style={{ left: Math.min(Math.max(tipX, 90), breedte - 90), top: 4 }}
          >
            <p className="font-semibold capitalize text-ink-900">{tip.labelLang}</p>
            <p className="mt-1 tabular-nums text-ink-800">+{getal(tip.bijgeboekt)} gespaard</p>
            <p className="tabular-nums text-warm">{getal(tip.ingewisseld)} ingewisseld</p>
            {tip.afgeboekt > 0 && <p className="tabular-nums text-warm">{getal(tip.afgeboekt)} vervallen of teruggeboekt</p>}
          </div>
        )}

        {leeg && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-lg border border-line bg-white/95 px-5 py-4 text-center shadow-soft">
              <p className="font-display text-[15px] font-bold text-ink-900">Nog geen punten geboekt</p>
              <p className="mt-1 text-[13px] text-warm">Zodra een order een bedrag en een status voorbij concept heeft, komen hier de eerste punten.</p>
            </div>
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>Punten per maand</caption>
        <thead><tr><th>Maand</th><th>Gespaard</th><th>Ingewisseld</th><th>Vervallen of teruggeboekt</th></tr></thead>
        <tbody>
          {maanden.map((m) => (
            <tr key={m.key}><td>{m.labelLang}</td><td>{getal(m.bijgeboekt)}</td><td>{getal(m.ingewisseld)}</td><td>{getal(m.afgeboekt)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
