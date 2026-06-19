'use client';
import { useMemo, useState } from 'react';
import { vraagRetour } from './actions';
import type { RetourneerbareOrder } from '@/lib/portaal/service';

const veld =
  'mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink-900 focus:border-amber-500 focus:outline-none';

type RegelKeuze = { geselecteerd: boolean; aantal: number };

export default function RetourFormulier({ orders }: { orders: RetourneerbareOrder[] }) {
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
      <p className="mt-4 rounded-lg bg-cream px-4 py-3 text-sm text-warm">
        Je hebt op dit moment geen bestellingen die nog binnen de retourtermijn vallen.
      </p>
    );
  }

  return (
    <form action={vraagRetour} className="mt-4">
      <input type="hidden" name="regels" value={regelsJson} />

      <label htmlFor="order_id" className="block text-sm font-semibold text-ink-900">
        Bestelling
      </label>
      <select
        id="order_id"
        name="order_id"
        className={veld}
        value={orderId}
        onChange={(e) => kiesOrder(e.target.value)}
        required
      >
        <option value="">Kies een bestelling</option>
        {orders.map((o) => (
          <option key={o.id} value={o.id}>
            {o.ordernummer ? `Order ${o.ordernummer}` : 'Bestelling'} {'·'}{' '}
            {new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(
              new Date(o.besteldatum),
            )}
          </option>
        ))}
      </select>

      {order && (
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-ink-900">Welke artikelen stuur je terug?</legend>
          <div className="mt-2 space-y-2">
            {order.regels.map((r) => {
              const keuze = keuzes[r.orderregel_id];
              const aan = keuze?.geselecteerd ?? false;
              return (
                <div
                  key={r.orderregel_id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-cream px-3 py-2"
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
                      <span className="text-warm"> {'·'} besteld: {r.besteld_aantal}</span>
                    </span>
                  </label>
                  <label className="flex items-center gap-1 text-xs text-warm">
                    Aantal
                    <input
                      type="number"
                      min={1}
                      max={r.besteld_aantal}
                      value={keuze?.aantal ?? r.besteld_aantal}
                      disabled={!aan}
                      onChange={(e) => zetAantal(r.orderregel_id, Number(e.target.value), r.besteld_aantal)}
                      className="w-16 rounded-md border border-line px-2 py-1 text-sm text-ink-900 disabled:bg-mist disabled:text-warm focus:border-amber-500 focus:outline-none"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      <label htmlFor="reden" className="mt-4 block text-sm font-semibold text-ink-900">
        Reden
      </label>
      <textarea
        id="reden"
        name="reden"
        rows={4}
        required
        placeholder="Bijvoorbeeld een verkeerde maat of een beschadigd kledingstuk."
        className={veld}
      />

      <button
        type="submit"
        disabled={!order || geselecteerd.length === 0}
        className="btn-primary mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
      >
        Retour aanmelden
      </button>
    </form>
  );
}
