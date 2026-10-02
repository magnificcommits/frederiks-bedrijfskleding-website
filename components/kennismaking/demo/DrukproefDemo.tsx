'use client';
import { useState } from 'react';
import Link from 'next/link';
import LogoOpKleding from '@/components/kennismaking/LogoOpKleding';
import { useDemo } from './DemoProvider';
import { TijdChip, kaart, veld } from './ui';

/** Drukproef van het logo van de prospect op een artikel, met Goedkeuren of Wijziging vragen (lokaal). */
export default function DrukproefDemo() {
  const { data, paden, drukproef, setDrukproef } = useDemo();
  const [wijzigOpen, setWijzigOpen] = useState(false);
  const [opmerking, setOpmerking] = useState('');

  const proef = data.drukproef;
  const artikel = proef ? data.artikelen.find((a) => a.id === proef.artikelId) : null;

  if (!proef || !artikel) {
    return (
      <p className="mt-8 rounded-2xl border border-line bg-white p-6 text-sm text-warm shadow-soft">
        Er staat nog geen drukproef klaar. Zodra Jessi er een maakt, vind je hem hier.
      </p>
    );
  }

  const status = drukproef.status;

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          <LogoOpKleding
            fotoUrl={artikel.fotoUrl}
            alt={`Drukproef: ${artikel.naam} met logo ${data.bedrijfsnaam}`}
            logoUrl={data.logoUrl}
            bedrijfsnaam={data.bedrijfsnaam}
            positie={artikel.logoPositie}
            className="mx-auto aspect-square w-full max-w-xl bg-white"
          />
        </div>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <section className={kaart}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-extrabold text-ink-900">{proef.naam}</h2>
              <p className="mt-0.5 text-xs text-warm">Klaargezet op {proef.datumLabel}</p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                status === 'goedgekeurd'
                  ? 'border-green-300 bg-green-50 text-green-800'
                  : status === 'wijziging'
                    ? 'border-sky-200 bg-sky-50 text-sky-800'
                    : 'border-amber-300 bg-amber-50 text-amber-800'
              }`}
            >
              {status === 'goedgekeurd' ? 'Goedgekeurd' : status === 'wijziging' ? 'Wijziging gevraagd' : 'Wacht op jullie akkoord'}
            </span>
          </div>

          <dl className="mt-4 divide-y divide-line text-sm">
            {(
              [
                ['Artikel', artikel.naam],
                ['Kleur', artikel.kleur ?? 'Volgens kledinglijn'],
                ['Positie', proef.positie],
                ['Afmeting', proef.afmeting],
                ['Techniek', proef.techniek],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2">
                <dt className="text-warm">{k}</dt>
                <dd className="text-right font-semibold text-ink-900">{v}</dd>
              </div>
            ))}
          </dl>

          {status === 'wacht' ? (
            <div className="mt-5">
              {wijzigOpen ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setDrukproef({ status: 'wijziging', opmerking: opmerking.trim().slice(0, 500) });
                    setWijzigOpen(false);
                  }}
                >
                  <label htmlFor="dp-opmerking" className="block text-sm font-semibold text-ink-900">
                    Wat moet er anders?
                  </label>
                  <textarea
                    id="dp-opmerking"
                    rows={3}
                    maxLength={500}
                    value={opmerking}
                    onChange={(e) => setOpmerking(e.target.value)}
                    placeholder="Bijvoorbeeld: logo iets kleiner, of op de rechterborst."
                    className={veld}
                  />
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button type="submit" className="min-h-[44px] flex-1 rounded-lg bg-ink-900 px-4 text-sm font-bold text-white hover:bg-ink-800">
                      Wijziging versturen
                    </button>
                    <button
                      type="button"
                      onClick={() => setWijzigOpen(false)}
                      className="min-h-[44px] flex-1 rounded-lg border border-line px-4 text-sm font-semibold text-ink-800 hover:bg-mist"
                    >
                      Annuleren
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setDrukproef({ status: 'goedgekeurd', opmerking: '' })}
                    className="min-h-[44px] flex-1 rounded-lg bg-green-700 px-4 text-sm font-bold text-white shadow-soft hover:bg-green-800"
                  >
                    Goedkeuren
                  </button>
                  <button
                    type="button"
                    onClick={() => setWijzigOpen(true)}
                    className="min-h-[44px] flex-1 rounded-lg border border-line bg-white px-4 text-sm font-bold text-ink-800 hover:bg-mist"
                  >
                    Wijziging vragen
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5" role="status">
              {status === 'goedgekeurd' ? (
                <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  Goedgekeurd. Vanaf nu komt jullie logo bij elke bestelling precies zo op dit artikel.
                </p>
              ) : (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  <p>Je vraag staat bij Jessi. Zij past de drukproef aan en zet een nieuwe versie klaar.</p>
                  {drukproef.opmerking && <p className="mt-2 text-xs">Jouw opmerking: &lsquo;{drukproef.opmerking}&rsquo;</p>}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDrukproef({ status: 'wacht', opmerking: '' });
                    setOpmerking('');
                  }}
                  className="min-h-[40px] text-xs font-semibold text-warm hover:text-ink-900"
                >
                  Opnieuw proberen
                </button>
                <Link href={paden.pasdag} className="text-sm font-semibold text-amber-700 hover:underline">
                  Zelf voelen hoe het zit? Plan een pasdag
                </Link>
              </div>
            </div>
          )}
        </section>

        <TijdChip>altijd hetzelfde logo. Eén keer goedkeuren en het staat vast voor elke volgende bestelling.</TijdChip>
      </div>
    </div>
  );
}
