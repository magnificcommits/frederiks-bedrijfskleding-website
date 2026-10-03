import Link from 'next/link';
import type { LangOpenOrder, PijplijnFase } from '@/lib/kms/dashboardStats';
import LegeStaat from './LegeStaat';

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

/**
 * Kleur per fase: van licht naar donker zoals het werk vordert. Factureren is
 * oranje, want daar ligt geld dat je nog moet ophalen.
 */
const FASE_KLEUR: Record<string, { balk: string; rand: string }> = {
  Voorbereiden: { balk: 'bg-ink-300', rand: 'border-t-ink-300' },
  Inkoop: { balk: 'bg-ink-500', rand: 'border-t-ink-500' },
  Productie: { balk: 'bg-ink-700', rand: 'border-t-ink-700' },
  Levering: { balk: 'bg-ink-900', rand: 'border-t-ink-900' },
  Factureren: { balk: 'bg-amber-500', rand: 'border-t-amber-500' },
  Overig: { balk: 'bg-ink-200', rand: 'border-t-ink-200' },
};

export default function Pijplijn({
  fases,
  open,
  openWaarde,
  langst,
}: {
  fases: PijplijnFase[];
  open: number;
  openWaarde: number;
  langst: LangOpenOrder[];
}) {
  const totaal = fases.reduce((t, f) => t + f.aantal, 0);

  return (
    <section className="panel flex h-full flex-col p-4" aria-labelledby="pijplijn-kop">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id="pijplijn-kop" className="font-display text-base font-bold text-ink-900">Orderpijplijn</h2>
          <p className="mt-0.5 text-[12px] text-warm">
            {open === 0 ? 'Er loopt nu niets.' : `${open} lopende ${open === 1 ? 'order' : 'orders'}${openWaarde > 0 ? `, samen ${euro(openWaarde)}` : ''}`}
          </p>
        </div>
        <Link href="/dashboard/orders" className="knop-tekst">Alle orders</Link>
      </div>

      {totaal === 0 ? (
        <div className="mt-4 flex-1">
          <LegeStaat
            titel="Geen lopende orders"
            tekst="Een goedgekeurde offerte of een portaalbestelling wordt hier een order. Dan zie je per stap hoeveel er klaarstaat."
            actieHref="/dashboard/orders/nieuw"
            actieLabel="Nieuwe order"
          />
        </div>
      ) : (
        <>
          {/* Gestapelde balk: aandeel per fase. */}
          <div
            className="mt-4 flex h-3 w-full gap-[3px] overflow-hidden rounded-full bg-mist"
            role="img"
            aria-label={fases.filter((f) => f.aantal > 0).map((f) => `${f.fase}: ${f.aantal}`).join(', ')}
          >
            {fases.filter((f) => f.aantal > 0).map((f) => (
              <div
                key={f.fase}
                className={`${FASE_KLEUR[f.fase]?.balk ?? 'bg-ink-200'} h-full first:rounded-l-full last:rounded-r-full`}
                style={{ width: `${(f.aantal / totaal) * 100}%` }}
                title={`${f.fase}: ${f.aantal}`}
              />
            ))}
          </div>

          {/* Kolommen per fase, zoals de tellers boven een kanbanbord. */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {fases.filter((f) => f.fase !== 'Overig' || f.aantal > 0).map((f) => {
              const metAantal = f.statussen.filter((s) => s.aantal > 0);
              return (
                <div key={f.fase} className={`rounded-md border border-line border-t-[3px] ${FASE_KLEUR[f.fase]?.rand ?? ''} bg-white p-2.5`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-warm">{f.fase}</span>
                    <span className={`font-display text-lg font-bold tabular-nums ${f.aantal === 0 ? 'text-ink-300' : 'text-ink-900'}`}>{f.aantal}</span>
                  </div>
                  {metAantal.length === 0 ? (
                    <p className="mt-1.5 text-[12px] text-ink-300">leeg</p>
                  ) : (
                    <ul className="mt-1.5 space-y-0.5">
                      {metAantal.map((s) => (
                        <li key={s.status}>
                          <Link
                            href={`/dashboard/orders?status=${encodeURIComponent(s.status)}`}
                            className="-mx-1.5 flex items-center justify-between gap-2 rounded px-1.5 py-1 text-[12px] text-ink-700 transition-colors hover:bg-mist hover:text-ink-900"
                          >
                            <span className="truncate">{s.label}</span>
                            <span className="chip-tel">{s.aantal}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {langst.length > 0 && (
            <div className="mt-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-warm">Liggen het langst</h3>
              <ul className="mt-1.5 divide-y divide-line rounded-md border border-line">
                {langst.map((o) => (
                  <li key={o.id}>
                    <Link href={`/dashboard/orders/${o.id}`} className="flex items-center gap-3 px-3 py-2 text-[13px] transition-colors hover:bg-mist">
                      <span className="w-14 shrink-0 font-semibold tabular-nums text-ink-900">#{o.ordernummer ?? '—'}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-800">{o.klant ?? 'Geen klant'}</span>
                      <span className="hidden shrink-0 sm:inline badge-rust">{o.statusLabel}</span>
                      <span className="hidden w-20 shrink-0 text-right tabular-nums text-warm md:inline">{o.bedrag != null ? euro(Number(o.bedrag)) : '—'}</span>
                      <span className={`w-16 shrink-0 text-right tabular-nums ${o.dagenOpen > 14 ? 'badge-actie justify-end' : 'text-warm'}`}>
                        {o.dagenOpen} {o.dagenOpen === 1 ? 'dag' : 'dgn'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
