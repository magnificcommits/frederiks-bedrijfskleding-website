import type { ReactNode } from 'react';
import type { DemoGoedkeuring, DemoOrderStatus } from '@/lib/prospect/demo/model';

/**
 * Kleine presentatiebouwstenen voor het voorbeeldportaal. Geen hooks, dus bruikbaar
 * in zowel server- als clientcomponenten. De accentkleur komt uit CSS-variabelen
 * die de portaal-layout zet (--demo-accent, --demo-op-accent, --demo-accent-tekst, --demo-accent-zacht).
 */

export const knopAccent =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[var(--demo-accent)] px-5 py-2.5 text-[15px] font-semibold text-[color:var(--demo-op-accent)] shadow-soft transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export const knopStil =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 transition hover:bg-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export const knopDonker =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export const kaart = 'rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6';

export const veld =
  'mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-base text-ink-900 focus:border-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-200 sm:text-sm';

export const accentTekst = 'text-[color:var(--demo-accent-tekst)]';

const euroFmt = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const euroFmt0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function euro(n: number, heel = false): string {
  const v = Number.isFinite(n) ? n : 0;
  return (heel ? euroFmt0 : euroFmt).format(v);
}

export function PaginaKop({ titel, intro, children }: { titel: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        <p className={`text-xs font-bold uppercase tracking-[0.16em] ${accentTekst}`}>Klantportaal</p>
        <h1 className="font-display text-2xl font-extrabold text-ink-900 sm:text-3xl">{titel}</h1>
        {intro && <p className="mt-2 text-sm text-warm">{intro}</p>}
      </div>
      {children}
    </div>
  );
}

/** Uitleg-chip die het voordeel in één zin benoemt. */
export function TijdChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`inline-flex max-w-full items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-snug text-ink-800 ${className ?? ''}`}
    >
      <svg viewBox="0 0 20 20" className="mt-px h-4 w-4 shrink-0 text-amber-700" aria-hidden="true">
        <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 5.5V10l3 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span>
        <strong className="font-semibold text-amber-800">Zo bespaar je tijd:</strong> {children}
      </span>
    </p>
  );
}

const STATUS_LABEL: Record<DemoOrderStatus, string> = {
  wacht: 'Wacht op goedkeuring',
  besteld: 'Besteld',
  borduren: 'Logo wordt geborduurd',
  bedrukken: 'Logo wordt gedrukt',
  verzonden: 'Verzonden',
  afgerond: 'Afgerond',
  afgewezen: 'Afgewezen',
};

export function statusLabel(s: DemoOrderStatus): string {
  return STATUS_LABEL[s];
}

export function StatusBadge({ status }: { status: DemoOrderStatus }) {
  const toon =
    status === 'afgerond' || status === 'verzonden'
      ? 'border-green-300 bg-green-50 text-green-800'
      : status === 'afgewezen'
        ? 'border-red-200 bg-red-50 text-red-700'
        : status === 'wacht'
          ? 'border-amber-300 bg-amber-50 text-amber-800'
          : 'border-sky-200 bg-sky-50 text-sky-800';
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${toon}`}>{STATUS_LABEL[status]}</span>
  );
}

const GOEDKEURING_LABEL: Record<DemoGoedkeuring, string> = {
  niet_nodig: 'Geen goedkeuring nodig',
  wacht: 'Wacht op goedkeuring',
  goedgekeurd: 'Goedgekeurd',
  afgewezen: 'Afgewezen',
};

export function goedkeuringLabel(g: DemoGoedkeuring): string {
  return GOEDKEURING_LABEL[g];
}

/** Voortgangsbalk voor budgetten. */
export function Balk({ deel, totaal, label }: { deel: number; totaal: number; label: string }) {
  const pct = totaal > 0 ? Math.max(0, Math.min(100, Math.round((deel / totaal) * 100))) : 0;
  const vol = pct >= 90;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-ink-100"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className={`h-full rounded-full ${vol ? 'bg-amber-600' : 'bg-[var(--demo-accent)]'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
