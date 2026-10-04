'use client';
import { useMemo, useState } from 'react';
import { vraagRetour } from './actions';
import type { RetourneerbareOrder } from '@/lib/portaal/service';
import { useVertaler } from '@/lib/i18n/portaal/client';

const veld =
  'mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink-900 focus:border-amber-500 focus:outline-none';

type RegelKeuze = { geselecteerd: boolean; aantal: number };

export default function RetourFormulier({
  orders,
  redenen = [],
  soort = 'retour',
}: {
  orders: RetourneerbareOrder[];
  redenen?: string[];
  /** Terugsturen of ruilen; bepaalt alleen de teksten en wat er wordt opgeslagen. */
  soort?: 'retour' | 'ruilen';
}) {
  const ruilen = soort === 'ruilen';
  const { t, datum } = useVertaler();
  const [orderId, setOrderId] = useState('');
  const [keuzes, setKeuzes] = useState<Record<string, RegelKeuze>>({});

  const order = useMemo(() => orders.find((o) => o.id === orderId) ?? null, [orders, orderId]);

  function kiesOrder(id: string) {
    setOrderId(id);
    const nieuw: Record<string, RegelKeuze> = {};
    const gekozen = orders.find((o) => o.id === id);
    if (gekozen) {
      for (const r of gekozen.regels) {
        nieuw[r.orderregel_id] = { geselecteerd: false, aantal: r.besteld_aantal };
      }
    }
    setKeuzes(nieuw);
  }

  function zetGeselecteerd(orderregelId: string, geselecteerd: boolean) {
    setKeuzes((vorig) => ({
      ...vorig,
      [orderregelId]: { ...(vorig[orderregelId] ?? { aantal: 1 }), geselecteerd },
    }));
  }

  function zetAantal(orderregelId: string, aantal: number, max: number) {
    const veilig = Math.min(Math.max(1, Math.floor(aantal || 1)), max);
    setKeuzes((vorig) => ({
      ...vorig,
      [orderregelId]: { geselecteerd: vorig[orderregelId]?.geselecteerd ?? true, aantal: veilig },
    }));
  }

  const geselecteerd = order ? order.regels.filter((r) => keuzes[r.orderregel_id]?.geselecteerd) : [];

  // Bouw de payload met de geselecteerde regels als JSON voor de server action.
  const regelsJson = JSON.stringify(
    geselecteerd.map((r) => ({
      orderregel_id: r.orderregel_id,
      item_naam: r.item_naam,
      maat: r.maat,
      kleur: r.kleur,
      aantal: keuzes[r.orderregel_id]?.aantal ?? r.besteld_aantal,
    })),
  );

  if (orders.length === 0) {
    return (
      <p className="mt-4 rounded-lg bg-mist px-4 py-3 text-sm text-warm">
        {t('retouren.geenOrders')}
      </p>
    );
  }

  return (
    <form action={vraagRetour} className="mt-4">
      <input type="hidden" name="regels" value={regelsJson} />
      <input type="hidden" name="soort" value={soort} />

      <label htmlFor="order_id" className="block text-sm font-semibold text-ink-900">
        {t('algemeen.bestelling')}
      </label>
      <select
        id="order_id"
        name="order_id"
        className={veld}
        value={orderId}
        onChange={(e) => kiesOrder(e.target.value)}
        required
      >
        <option value="">{t('retouren.kiesBestelling')}</option>
        {orders.map((o) => (
          <option key={o.id} value={o.id}>
            {o.ordernummer ? t('algemeen.order', { nr: o.ordernummer }) : t('algemeen.bestelling')} {'·'}{' '}
            {datum(o.besteldatum)}
          </option>
        ))}
      </select>

      {order && (
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-ink-900">{ruilen ? t('retouren.welkeRuilen') : t('retouren.welkeArtikelen')}</legend>
          <div className="mt-2 space-y-2">
            {order.regels.map((r) => {
              const keuze = keuzes[r.orderregel_id];
              const aan = keuze?.geselecteerd ?? false;
              return (
                <div
                  key={r.orderregel_id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-mist px-3 py-2"
                >
                  <label className="flex flex-1 items-start gap-2 text-sm text-ink-800">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={aan}
                      onChange={(e) => zetGeselecteerd(r.orderregel_id, e.target.checked)}
                    />
                    <span>
                      <span className="font-semibold text-ink-900">{r.item_naam}</span>
                      {(r.maat || r.kleur) && (
                        <span className="text-warm">
                          {' '}
                          {[r.maat, r.kleur].filter(Boolean).join(' / ')}
                        </span>
                      )}
                      <span className="text-warm"> {'·'} {t('retouren.besteld', { n: r.besteld_aantal })}</span>
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-warm">{t('algemeen.aantal')}</span>
                    {(() => {
                      const huidig = keuze?.aantal ?? r.besteld_aantal;
                      const knopCls =
                        'flex h-11 w-11 items-center justify-center rounded-md border border-line text-lg font-bold text-ink-900 disabled:cursor-not-allowed disabled:bg-mist disabled:text-warm';
                      return (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={t('retouren.verlagen')}
                            disabled={!aan || huidig <= 1}
                            onClick={() => zetAantal(r.orderregel_id, huidig - 1, r.besteld_aantal)}
                            className={knopCls}
                          >
                            {'−'}
                          </button>
                          <span
                            aria-live="polite"
                            className={`w-10 text-center text-sm font-semibold ${aan ? 'text-ink-900' : 'text-warm'}`}
                          >
                            {huidig}
                          </span>
                          <button
                            type="button"
                            aria-label={t('retouren.verhogen')}
                            disabled={!aan || huidig >= r.besteld_aantal}
                            onClick={() => zetAantal(r.orderregel_id, huidig + 1, r.besteld_aantal)}
                            className={knopCls}
                          >
                            +
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      {redenen.length > 0 && (
        <>
          <label htmlFor="reden_keuze" className="mt-4 block text-sm font-semibold text-ink-900">
            {t('retouren.reden')}
          </label>
          <select id="reden_keuze" name="reden_keuze" className={veld} defaultValue="" required>
            <option value="" disabled>
              {t('retouren.kiesReden')}
            </option>
            {redenen.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </>
      )}

      <label htmlFor="reden" className="mt-4 block text-sm font-semibold text-ink-900">
        {redenen.length > 0 ? t('retouren.toelichting') : t('retouren.reden')}
      </label>
      <textarea
        id="reden"
        name="reden"
        rows={4}
        required={redenen.length === 0}
        placeholder={
          ruilen
            ? t('retouren.placeholderRuilen')
            : redenen.length > 0
              ? t('retouren.placeholderMetKeuze')
              : t('retouren.placeholderZonderKeuze')
        }
        className={veld}
      />

      <button
        type="submit"
        disabled={!order || geselecteerd.length === 0}
        className="btn-primary mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ruilen ? t('retouren.aanmeldenRuilen') : t('retouren.aanmelden')}
      </button>
    </form>
  );
}
