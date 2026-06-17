'use client';

import { useState } from 'react';
import { formatEuro, formatGetal } from '@/lib/format';

type MaandStuks = { maand: string; label: string; stuks: number };
type MaandOmzet = { maand: string; label: string; omzet: number };

type Vergelijking = {
  huidig: number;
  vorig: number;
  verschil: number;
  groeiPct: number | null;
};
type GroeiCijfers = {
  huidigLabel: string;
  huidig: number;
  vorigeMaand: Vergelijking;
  vorigJaar: Vergelijking;
};

type Props = {
  stuksPerMaand: MaandStuks[];
  omzetPerMaand: MaandOmzet[];
  stuksGroei: GroeiCijfers;
  omzetGroei: GroeiCijfers;
};

const AMBER = '#ec6726';

type Modus = 'mom' | 'yoy';

function GroeiBadge({ pct, verschil, soort }: { pct: number | null; verschil: number; soort: 'stuks' | 'omzet' }) {
  if (pct === null) {
    return <span className="text-xs font-semibold text-warm">geen vergelijking</span>;
  }
  const omhoog = verschil >= 0;
  const cls = omhoog ? 'text-green-700' : 'text-red-600';
  const pijl = omhoog ? '▲' : '▼';
  const absVerschil =
    soort === 'omzet' ? formatEuro(Math.abs(verschil), 0) : `${formatGetal(Math.abs(verschil))} stuks`;
  return (
    <span className={`inline-flex items-baseline gap-1 text-xs font-semibold ${cls}`}>
      <span aria-hidden>{pijl}</span>
      <span>{Math.abs(pct).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}%</span>
      <span className="font-normal text-warm">({absVerschil})</span>
    </span>
  );
}

/** Lichte inline-SVG staafdiagram. Schaalt mee via viewBox + width 100%. */
function StaafGrafiek({
  data,
  formatWaarde,
  kleur,
}: {
  data: { label: string; waarde: number; titel: string }[];
  formatWaarde: (n: number) => string;
  kleur: string;
}) {
  const breedte = 720;
  const hoogte = 260;
  const margeLinks = 56;
  const margeOnder = 34;
  const margeBoven = 16;
  const margeRechts = 12;
  const plotB = breedte - margeLinks - margeRechts;
  const plotH = hoogte - margeBoven - margeOnder;

  const max = Math.max(1, ...data.map((d) => d.waarde));
  const n = Math.max(1, data.length);
  const stap = plotB / n;
  const staafB = Math.min(stap * 0.62, 46);

  // Drie horizontale gridlijnen op 0/50/100%.
  const grid = [0, 0.5, 1];

  return (
    <svg
      viewBox={`0 0 ${breedte} ${hoogte}`}
      width="100%"
      role="img"
      aria-label="Staafdiagram"
      className="h-auto w-full"
    >
      {grid.map((g) => {
        const y = margeBoven + plotH - g * plotH;
        return (
          <g key={g}>
            <line x1={margeLinks} y1={y} x2={breedte - margeRechts} y2={y} stroke="#e7e1d8" strokeWidth={1} />
            <text x={margeLinks - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#8a8175">
              {formatWaarde(max * g)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (d.waarde / max) * plotH;
        const x = margeLinks + i * stap + (stap - staafB) / 2;
        const y = margeBoven + plotH - h;
        return (
          <g key={d.label + i}>
            <rect x={x} y={y} width={staafB} height={Math.max(0, h)} rx={3} fill={kleur}>
              <title>{d.titel}</title>
            </rect>
            <text
              x={x + staafB / 2}
              y={hoogte - margeOnder + 16}
              textAnchor="middle"
              fontSize={10}
              fill="#8a8175"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Lichte inline-SVG lijndiagram met area-fill. */
function LijnGrafiek({
  data,
  formatWaarde,
  kleur,
}: {
  data: { label: string; waarde: number; titel: string }[];
  formatWaarde: (n: number) => string;
  kleur: string;
}) {
  const breedte = 720;
  const hoogte = 260;
  const margeLinks = 64;
  const margeOnder = 34;
  const margeBoven = 16;
  const margeRechts = 12;
  const plotB = breedte - margeLinks - margeRechts;
  const plotH = hoogte - margeBoven - margeOnder;

  const max = Math.max(1, ...data.map((d) => d.waarde));
  const n = Math.max(1, data.length);
  const x = (i: number) => (n === 1 ? margeLinks + plotB / 2 : margeLinks + (i / (n - 1)) * plotB);
  const y = (v: number) => margeBoven + plotH - (v / max) * plotH;

  const punten = data.map((d, i) => ({ ...d, px: x(i), py: y(d.waarde) }));
  const lijn = punten.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(' ');
  const area =
    punten.length > 0
      ? `${lijn} L ${punten[punten.length - 1].px.toFixed(1)} ${(margeBoven + plotH).toFixed(1)} L ${punten[0].px.toFixed(1)} ${(margeBoven + plotH).toFixed(1)} Z`
      : '';
  const grid = [0, 0.5, 1];

  return (
    <svg
      viewBox={`0 0 ${breedte} ${hoogte}`}
      width="100%"
      role="img"
      aria-label="Lijndiagram"
      className="h-auto w-full"
    >
      {grid.map((g) => {
        const gy = margeBoven + plotH - g * plotH;
        return (
          <g key={g}>
            <line x1={margeLinks} y1={gy} x2={breedte - margeRechts} y2={gy} stroke="#e7e1d8" strokeWidth={1} />
            <text x={margeLinks - 8} y={gy + 4} textAnchor="end" fontSize={11} fill="#8a8175">
              {formatWaarde(max * g)}
            </text>
          </g>
        );
      })}
      {area && <path d={area} fill={kleur} fillOpacity={0.12} stroke="none" />}
      {lijn && <path d={lijn} fill="none" stroke={kleur} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      {punten.map((p, i) => (
        <g key={p.label + i}>
          <circle cx={p.px} cy={p.py} r={3.5} fill={kleur}>
            <title>{p.titel}</title>
          </circle>
          <text x={p.px} y={hoogte - margeOnder + 16} textAnchor="middle" fontSize={10} fill="#8a8175">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function Grafieken({ stuksPerMaand, omzetPerMaand, stuksGroei, omzetGroei }: Props) {
  const [modus, setModus] = useState<Modus>('mom');

  const stuksVgl = modus === 'mom' ? stuksGroei.vorigeMaand : stuksGroei.vorigJaar;
  const omzetVgl = modus === 'mom' ? omzetGroei.vorigeMaand : omzetGroei.vorigJaar;
  const vglWoord = modus === 'mom' ? 'vorige maand' : 'zelfde maand vorig jaar';

  const stuksData = stuksPerMaand.map((m) => ({
    label: m.label,
    waarde: m.stuks,
    titel: `${m.label}: ${formatGetal(m.stuks)} stuks`,
  }));
  const omzetData = omzetPerMaand.map((m) => ({
    label: m.label,
    waarde: m.omzet,
    titel: `${m.label}: ${formatEuro(m.omzet, 0)}`,
  }));

  const tabBasis = 'rounded-full px-4 py-2 text-sm font-semibold transition';
  const tabActief = 'bg-ink-900 text-white';
  const tabRust = 'bg-white text-warm hover:text-ink-800 border border-line';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-warm">Vergelijking:</span>
        <button
          type="button"
          onClick={() => setModus('mom')}
          aria-pressed={modus === 'mom'}
          className={`${tabBasis} ${modus === 'mom' ? tabActief : tabRust}`}
        >
          Per maand (t.o.v. vorige maand)
        </button>
        <button
          type="button"
          onClick={() => setModus('yoy')}
          aria-pressed={modus === 'yoy'}
          className={`${tabBasis} ${modus === 'yoy' ? tabActief : tabRust}`}
        >
          Per jaar (t.o.v. vorig jaar)
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-bold text-ink-900">Verkochte stuks per maand</h3>
              <p className="mt-0.5 text-sm text-warm">
                {stuksGroei.huidigLabel || 'Deze maand'}: {formatGetal(stuksGroei.huidig)} stuks
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-warm">t.o.v. {vglWoord}</p>
              <GroeiBadge pct={stuksVgl.groeiPct} verschil={stuksVgl.verschil} soort="stuks" />
            </div>
          </div>
          <div className="mt-4">
            <StaafGrafiek data={stuksData} formatWaarde={(n) => formatGetal(n)} kleur={AMBER} />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-bold text-ink-900">Omzet per maand</h3>
              <p className="mt-0.5 text-sm text-warm">
                {omzetGroei.huidigLabel || 'Deze maand'}: {formatEuro(omzetGroei.huidig, 0)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-warm">t.o.v. {vglWoord}</p>
              <GroeiBadge pct={omzetVgl.groeiPct} verschil={omzetVgl.verschil} soort="omzet" />
            </div>
          </div>
          <div className="mt-4">
            <LijnGrafiek data={omzetData} formatWaarde={(n) => formatEuro(n, 0)} kleur={AMBER} />
          </div>
        </section>
      </div>

      <p className="mt-3 text-xs text-warm">
        Betaalde omzet uit facturen (op betaaldatum). Stuks uit orderregels van geplaatste orders (concept en
        offertes tellen niet mee). Beweeg over een staaf of punt voor het exacte cijfer.
      </p>
    </div>
  );
}
