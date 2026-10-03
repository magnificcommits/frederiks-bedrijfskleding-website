'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { MaandPunt } from '@/lib/kms/dashboardStats';

type Modus = 'gefactureerd' | 'orderwaarde';

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const euroKort = (n: number) => {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}m`;
  if (n >= 1000) return `€${(n / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}k`;
  return `€${Math.round(n)}`;
};

/** Mooie bovengrens voor de as: 1, 2, 2,5 of 5 maal een macht van tien. */
function netteMax(v: number): number {
  if (v <= 0) return 100;
  const macht = 10 ** Math.floor(Math.log10(v));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * macht >= v) return f * macht;
  return 10 * macht;
}

const HOOGTE = 220;
const M = { boven: 12, onder: 26, links: 46, rechts: 8 };

/**
 * Staafgrafiek omzet per maand, twaalf maanden. Twee weergaven:
 * - gefactureerd (excl. btw, op factuurdatum), gesplitst in betaald en nog open;
 * - orderwaarde (op besteldatum), voor als de facturatie nog niet in het systeem loopt.
 * De lopende maand is oranje, zodat je meteen ziet waar je nu staat.
 */
export default function OmzetGrafiek({ maanden }: { maanden: MaandPunt[] }) {
  const heeftFacturen = maanden.some((m) => m.gefactureerd > 0);
  const heeftOrders = maanden.some((m) => m.orderwaarde > 0);
  const [modus, setModus] = useState<Modus>(!heeftFacturen && heeftOrders ? 'orderwaarde' : 'gefactureerd');
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

  const waarde = (m: MaandPunt) => (modus === 'gefactureerd' ? m.gefactureerd : m.orderwaarde);
  const totaal = maanden.reduce((t, m) => t + waarde(m), 0);
  const leeg = totaal === 0;
  const max = netteMax(Math.max(...maanden.map(waarde)));
  const binnenB = breedte - M.links - M.rechts;
  const binnenH = HOOGTE - M.boven - M.onder;
  const band = binnenB / maanden.length;
  const staaf = Math.min(44, band * 0.58);
  const y = (v: number) => M.boven + binnenH - (v / max) * binnenH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const laatste = maanden.length - 1;
  const maandenMet = maanden.filter((m) => waarde(m) > 0).length;

  const tip = actief !== null ? maanden[actief] : null;
  const tipX = actief !== null ? M.links + band * actief + band / 2 : 0;

  return (
    <section className="panel flex h-full flex-col p-4" aria-labelledby="omzet-kop">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="omzet-kop" className="font-display text-base font-bold text-ink-900">
            {modus === 'gefactureerd' ? 'Omzet per maand' : 'Orderwaarde per maand'}
          </h2>
          <p className="mt-0.5 text-[12px] text-warm">
            {modus === 'gefactureerd' ? 'Gefactureerd, excl. btw, op factuurdatum' : 'Waarde van nieuwe orders, op besteldatum'}
          </p>
        </div>
        <div role="tablist" aria-label="Weergave" className="inline-flex rounded-md border border-line bg-mist p-0.5">
          {(['gefactureerd', 'orderwaarde'] as Modus[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={modus === m}
              onClick={() => { setModus(m); setActief(null); }}
              className={`rounded px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                modus === m ? 'bg-white text-ink-900 shadow-sm' : 'text-warm hover:text-ink-900'
              }`}
            >
              {m === 'gefactureerd' ? 'Gefactureerd' : 'Orderwaarde'}
            </button>
          ))}
        </div>
      </div>

      {!leeg && (
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-1">
          <p>
            <span className="font-display text-2xl font-bold tabular-nums text-ink-900">{euro(totaal)}</span>
            <span className="ml-2 text-[12px] text-warm">in 12 maanden</span>
          </p>
          <p className="text-[12px] text-warm">
            gemiddeld <span className="font-semibold tabular-nums text-ink-800">{euro(totaal / 12)}</span> per maand
            {maandenMet < 12 && <span className="text-ink-400"> · {maandenMet} {maandenMet === 1 ? 'maand' : 'maanden'} met omzet</span>}
          </p>
          {modus === 'gefactureerd' && (
            <p className="ml-auto flex items-center gap-3 text-[11px] text-warm">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ink-800" />betaald</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ink-300" />nog open</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />deze maand</span>
            </p>
          )}
        </div>
      )}

      <div ref={kader} className="relative mt-3 flex-1" style={{ minHeight: HOOGTE }}>
        <svg
          width="100%"
          height={HOOGTE}
          viewBox={`0 0 ${breedte} ${HOOGTE}`}
          role="img"
          aria-label={`${modus === 'gefactureerd' ? 'Gefactureerde omzet' : 'Orderwaarde'} per maand: ${maanden
            .map((m) => `${m.labelLang} ${euro(waarde(m))}`)
            .join(', ')}`}
          className={`block ${leeg ? 'opacity-40' : ''}`}
          onPointerLeave={() => setActief(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.links} x2={breedte - M.rechts} y1={y(t)} y2={y(t)} className={t === 0 ? 'stroke-ink-200' : 'stroke-line'} strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={M.links - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-400 text-[10px] tabular-nums">
                {euroKort(t)}
              </text>
            </g>
          ))}
          {maanden.map((m, i) => {
            const cx = M.links + band * i + band / 2;
            const x0 = cx - staaf / 2;
            const nu = i === laatste;
            const gedimd = actief !== null && actief !== i;
            const totaalM = waarde(m);
            const betaald = modus === 'gefactureerd' ? m.betaald : totaalM;
            const yTop = y(totaalM);
            const yBetaald = y(betaald);
            return (
              <g key={m.key} className={`transition-opacity ${gedimd ? 'opacity-50' : ''}`}>
                {totaalM > 0 && (
                  <>
                    {/* bovenste deel: nog open (bij gefactureerd) */}
                    {modus === 'gefactureerd' && totaalM > betaald && (
                      <rect x={x0} y={yTop} width={staaf} height={Math.max(0, yBetaald - yTop)} rx={3}
                        className={nu ? 'fill-amber-200' : 'fill-ink-300'} />
                    )}
                    {betaald > 0 && (
                      <rect x={x0} y={yBetaald} width={staaf} height={Math.max(1, y(0) - yBetaald)} rx={3}
                        className={nu ? 'fill-amber-500' : 'fill-ink-800'} />
                    )}
                  </>
                )}
                {totaalM === 0 && (
                  <rect x={x0} y={y(0) - 2} width={staaf} height={2} rx={1} className={nu ? 'fill-amber-300' : 'fill-ink-100'} />
                )}
                <text x={cx} y={HOOGTE - 8} textAnchor="middle"
                  className={`text-[10px] ${nu ? 'fill-ink-900 font-semibold' : 'fill-ink-400'}`}>
                  {m.label}
                </text>
                {/* Ruim raakvlak voor de muis; schermlezers krijgen de tabel hieronder. */}
                <rect
                  x={M.links + band * i}
                  y={M.boven}
                  width={band}
                  height={binnenH}
                  fill="transparent"
                  onPointerEnter={() => setActief(i)}
                />
              </g>
            );
          })}
        </svg>

        {tip && !leeg && (
          <div
            className="pointer-events-none absolute z-10 w-max min-w-[150px] -translate-x-1/2 -translate-y-full rounded-md border border-line bg-white px-3 py-2 text-[12px] shadow-card"
            style={{
              left: Math.min(Math.max(tipX, 80), breedte - 80),
              top: Math.max(y(waarde(tip)) - 8, 64),
            }}
          >
            <p className="font-semibold capitalize text-ink-900">{tip.labelLang}</p>
            <p className="mt-0.5 font-display text-base font-bold tabular-nums text-ink-900">{euro(waarde(tip))}</p>
            {modus === 'gefactureerd' ? (
              <p className="mt-0.5 tabular-nums text-warm">
                {euro(tip.betaald)} betaald · {euro(tip.gefactureerd - tip.betaald)} open
              </p>
            ) : (
              <p className="mt-0.5 tabular-nums text-warm">{tip.orders} {tip.orders === 1 ? 'order' : 'orders'}</p>
            )}
          </div>
        )}

        {leeg && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-lg border border-line bg-white/95 px-5 py-4 text-center shadow-soft">
              <p className="font-display text-[15px] font-bold text-ink-900">
                {modus === 'gefactureerd' ? 'Nog geen gefactureerde omzet' : 'Nog geen orders met een bedrag'}
              </p>
              <p className="mt-1 text-[13px] text-warm">
                {modus === 'gefactureerd'
                  ? 'Zodra je een factuur verstuurt, staat hier per maand wat je hebt gefactureerd en wat al binnen is.'
                  : 'Geef orders een bedrag, dan zie je hier per maand hoeveel werk er binnenkomt.'}
              </p>
              <div className="mt-3 flex justify-center gap-2">
                {modus === 'gefactureerd' && heeftOrders ? (
                  <button type="button" onClick={() => setModus('orderwaarde')} className="knop-stil">Bekijk orderwaarde</button>
                ) : null}
                <Link href={modus === 'gefactureerd' ? '/dashboard/facturen' : '/dashboard/orders'} className="knop-donker">
                  {modus === 'gefactureerd' ? 'Naar facturen' : 'Naar orders'}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>{modus === 'gefactureerd' ? 'Gefactureerde omzet per maand' : 'Orderwaarde per maand'}</caption>
        <thead><tr><th>Maand</th><th>Bedrag</th></tr></thead>
        <tbody>
          {maanden.map((m) => (
            <tr key={m.key}><td>{m.labelLang}</td><td>{euro(waarde(m))}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
