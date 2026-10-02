'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DemoOrder } from '@/lib/prospect/demo/model';
import { useDemo } from './DemoProvider';
import { StatusBadge, TijdChip, euro, goedkeuringLabel, knopDonker } from './ui';

type Filter = 'alle' | 'lopend' | 'afgerond';

const isLopend = (o: DemoOrder) => o.status !== 'afgerond' && o.status !== 'afgewezen';

/** Bestelhistorie met statussen, goedkeuring en een track & trace-voorbeeld. */
export default function BestellingenDemo() {
  const { paden, orders, medewerker, herbestel } = useDemo();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('alle');

  const zichtbaar = orders.filter((o) => (filter === 'alle' ? true : filter === 'lopend' ? isLopend(o) : !isLopend(o)));

  function opnieuw(id: string) {
    if (herbestel(id) > 0) router.push(`${paden.portaal}/winkelmand`);
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter bestellingen">
        {(
          [
            ['alle', 'Alle'],
            ['lopend', 'Lopend'],
            ['afgerond', 'Afgerond'],
          ] as const
        ).map(([id, label]) => {
          const aan = filter === id;
          const n = id === 'alle' ? orders.length : orders.filter((o) => (id === 'lopend' ? isLopend(o) : !isLopend(o))).length;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={aan}
              onClick={() => setFilter(id)}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${aan ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-white text-ink-700 hover:border-ink-300'}`}
            >
              {label}
              <span className={`rounded-full px-1.5 text-[11px] ${aan ? 'bg-white/25' : 'bg-ink-100'}`}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-4">
        {zichtbaar.map((o) => {
          const mw = medewerker(o.medewerkerId);
          return (
            <article key={o.id} className="rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    {o.datumLabel}
                    {o.lokaal && <span className="ml-2 rounded-full bg-mist px-2 py-0.5 text-[11px] font-semibold text-warm">Net geplaatst (voorbeeld)</span>}
                  </p>
                  <p className="text-xs text-warm">Bestelling #{o.ordernummer}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={o.status} />
                  <span className="text-sm font-semibold text-ink-900">{euro(o.bedrag)}</span>
                </div>
              </div>

              <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-warm">
                {mw && <span>Voor {mw.naam}</span>}
                <span>Aangevraagd door {o.aangevraagdDoor}</span>
                <span>{goedkeuringLabel(o.goedkeuring)}</span>
                {o.buitenBudget && <span>Telt niet mee in het budget</span>}
              </p>

              <ul className="mt-4 divide-y divide-line text-sm">
                {o.regels.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-ink-800">
                      {r.naam}
                      <span className="text-warm"> ({[r.maat ? `maat ${r.maat}` : '', r.kleur ? `kleur ${r.kleur}` : ''].filter(Boolean).join(', ')})</span>
                    </span>
                    <span className="font-semibold text-ink-900">{r.aantal}x</span>
                  </li>
                ))}
              </ul>

              {(o.status === 'borduren' || o.status === 'bedrukken') && (
                <p className="mt-4 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  In de werkplaats: het logo wordt nu {o.status === 'borduren' ? 'geborduurd' : 'gedrukt'}. Daarna gaat het pakket dezelfde week de deur uit.
                </p>
              )}

              {o.trackTrace && (
                <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p>
                      <span className="font-semibold">{o.trackTrace.vervoerder}</span> · track en trace{' '}
                      <span className="font-mono text-[13px]">{o.trackTrace.code}</span>
                    </p>
                    <p className="text-xs">Verwacht: {o.trackTrace.verwacht}</p>
                  </div>
                  <ol className="mt-3 space-y-2">
                    {o.trackTrace.stappen.map((s) => (
                      <li key={s.label} className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${s.klaar ? 'bg-green-600 text-white' : 'border-2 border-green-300 bg-white'}`}
                          aria-hidden="true"
                        >
                          {s.klaar && (
                            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
                              <path d="M2.5 6.2l2.2 2.2 4.8-4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span className={s.klaar ? 'text-green-900' : 'text-green-800/70'}>
                          {s.label} <span className="text-xs opacity-80">· {s.tijd}</span>
                          <span className="sr-only">{s.klaar ? ' (gedaan)' : ' (nog niet)'}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-xs text-green-800">Voorbeeldcode. In het echte portaal staat hier de code van de vervoerder.</p>
                </div>
              )}

              {o.goedkeuring === 'wacht' && (
                <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Deze aanvraag wacht op een leidinggevende.{' '}
                  <Link href={`${paden.portaal}/goedkeuringen`} className="font-semibold underline underline-offset-2">
                    Naar goedkeuringen
                  </Link>
                </div>
              )}

              {o.regels.some((r) => r.artikelId) && o.goedkeuring !== 'wacht' && (
                <div className="mt-5 border-t border-line pt-4">
                  <button type="button" onClick={() => opnieuw(o.id)} className={knopDonker}>
                    Bestel opnieuw
                  </button>
                  <p className="mt-2 text-xs text-warm">Je controleert de winkelmand nog voordat je bestelt.</p>
                </div>
              )}
            </article>
          );
        })}
        {zichtbaar.length === 0 && <p className="rounded-2xl border border-line bg-white p-6 text-sm text-warm">Geen bestellingen in deze lijst.</p>}
      </div>

      <TijdChip className="mt-6">geen mailtjes meer met &lsquo;is het al verstuurd?&rsquo;. Iedereen ziet zelf waar de bestelling is.</TijdChip>
    </div>
  );
}
