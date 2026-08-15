const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);

export type TotaalRegel = { label: string; waarde: number; mindering?: boolean };

/**
 * De financiële samenvatting in het rechterspoor van offerte, order en factuur.
 * Eén vormgeving voor alle drie, zodat "wat verdien ik hieraan" overal op
 * dezelfde plek staat en meeloopt tijdens het scrollen.
 *
 * De marge kleurt amber onder de drempel: dat is de enige plek in het dashboard
 * waar kleur een oordeel geeft, en het is precies het getal waar het om gaat.
 */
export default function TotaalKaart({
  regels,
  totaalLabel = 'Totaal',
  totaal,
  marge = null,
  margeDrempelPct = 20,
  toelichting,
}: {
  regels: TotaalRegel[];
  totaalLabel?: string;
  totaal: number;
  marge?: number | null;
  margeDrempelPct?: number;
  toelichting?: string;
}) {
  const basis = regels.find((r) => r.label.toLowerCase().startsWith('subtotaal'))?.waarde ?? 0;
  const margePct = marge != null && basis > 0 ? (marge / basis) * 100 : null;
  const mager = margePct != null && margePct < margeDrempelPct;

  return (
    <div className="panel p-4">
      <dl className="space-y-1.5 text-[13px]">
        {regels.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-warm">{r.label}</dt>
            <dd className="tabular-nums text-ink-900">{r.mindering ? `− ${euro(r.waarde)}` : euro(r.waarde)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
        <span className="text-[13px] font-semibold text-ink-900">{totaalLabel}</span>
        <span className="font-display text-xl font-bold tabular-nums text-ink-900">{euro(totaal)}</span>
      </div>

      {marge != null && (
        <div className="mt-2.5 border-t border-line pt-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] text-warm">Marge</span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[13px] font-semibold tabular-nums text-ink-900">{euro(marge)}</span>
              {margePct != null && (
                <span className={mager ? 'badge-actie' : 'badge-rust'}>
                  {margePct.toFixed(1).replace('.', ',')}%
                </span>
              )}
            </span>
          </div>
          {mager && <p className="mt-1 text-[11px] text-amber-800">Onder de {margeDrempelPct}% die je normaal aanhoudt.</p>}
          {toelichting && <p className="mt-1 text-[11px] text-warm">{toelichting}</p>}
        </div>
      )}
    </div>
  );
}
