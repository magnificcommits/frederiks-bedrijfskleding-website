'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import LogoOpKleding from '@/components/kennismaking/LogoOpKleding';
import { maatVoor } from '@/lib/prospect/demo/model';
import { useDemo } from './DemoProvider';
import { TijdChip, euro, knopAccent, veld } from './ui';

/** Webshop van het voorbeeldportaal: jullie artikelen met logo, maat kiezen, in de winkelmand. */
export default function WebshopDemo() {
  const { data, paden, medewerkers, voorMedewerkerId, setVoorMedewerker, medewerker, voegToe, mand, budgetVan } = useDemo();
  const [maatKeuze, setMaatKeuze] = useState<Record<string, string>>({});
  const [toegevoegd, setToegevoegd] = useState<Record<string, number>>({});
  const [categorie, setCategorie] = useState<string>('alle');

  const voor = medewerker(voorMedewerkerId);
  const categorieen = useMemo(() => {
    const set = new Set<string>();
    for (const a of data.artikelen) if (a.categorie) set.add(a.categorie);
    return [...set];
  }, [data.artikelen]);
  const zichtbaar = categorie === 'alle' ? data.artikelen : data.artikelen.filter((a) => a.categorie === categorie);
  const aantalMand = mand.reduce((t, r) => t + r.aantal, 0);
  const budget = voor ? budgetVan(voor.id) : null;
  const afdelingNaam = (id: string) => data.afdelingen.find((a) => a.id === id)?.naam ?? '';

  function kiesMedewerker(id: string) {
    setVoorMedewerker(id || null);
    setMaatKeuze({});
  }

  function toevoegen(artikelId: string, maat: string) {
    voegToe(artikelId, maat, voor?.id ?? null);
    setToegevoegd((t) => ({ ...t, [artikelId]: (t[artikelId] ?? 0) + 1 }));
  }

  if (data.artikelen.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
        <p className="text-sm text-warm">Jullie kledinglijn wordt nog samengesteld. Jessi zet hier straks de artikelen klaar die bij jullie werk passen.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {/* Voor wie */}
      <section className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,20rem)_1fr] sm:items-end">
          <div>
            <label htmlFor="voor-wie" className="block text-sm font-semibold text-ink-900">
              Bestellen voor
            </label>
            <select id="voor-wie" value={voor?.id ?? ''} onChange={(e) => kiesMedewerker(e.target.value)} className={veld}>
              <option value="">Kies een medewerker</option>
              {data.afdelingen.map((afd) => (
                <optgroup key={afd.id} label={afd.naam}>
                  {medewerkers
                    .filter((m) => m.afdelingId === afd.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.naam} ({m.functie})
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div aria-live="polite">
            {voor && budget ? (
              <div className="text-sm">
                <p className="text-ink-800">
                  Maten van <strong>{voor.naam}</strong> staan klaar: boven {voor.maten.boven}, broek {voor.maten.broek}, schoen {voor.maten.schoen}.
                </p>
                <p className="mt-0.5 text-warm">
                  {afdelingNaam(voor.afdelingId)} · nog {euro(Math.max(0, budget.restant), true)} van {euro(budget.budget, true)} budget
                </p>
              </div>
            ) : (
              <TijdChip>kies een collega en de juiste maten staan al aangevinkt. Geen maattabel, geen navragen.</TijdChip>
            )}
          </div>
        </div>
      </section>

      {/* Filter */}
      {categorieen.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter op categorie">
          {['alle', ...categorieen].map((c) => {
            const aan = categorie === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={aan}
                onClick={() => setCategorie(c)}
                className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold transition ${aan ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-white text-ink-700 hover:border-ink-300'}`}
              >
                {c === 'alle' ? 'Alles' : c}
              </button>
            );
          })}
        </div>
      )}

      {/* Artikelen */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {zichtbaar.map((a) => {
          const maat = maatKeuze[a.id] ?? (voor || a.maatSoort === 'een' ? maatVoor(voor, a) : '');
          const isVoorkeur = Boolean(voor) && maat === maatVoor(voor, a) && !maatKeuze[a.id];
          const n = toegevoegd[a.id] ?? 0;
          return (
            <article key={a.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
              <LogoOpKleding
                fotoUrl={a.fotoUrl}
                alt={`${a.naam}${a.kleur ? ` in ${a.kleur}` : ''} met logo ${data.bedrijfsnaam}`}
                logoUrl={data.logoUrl}
                bedrijfsnaam={data.bedrijfsnaam}
                positie={a.logoPositie}
                className="aspect-square w-full bg-white"
              />
              <div className="flex flex-1 flex-col border-t border-line p-4">
                <p className="font-semibold text-ink-900">{a.naam}</p>
                <p className="mt-0.5 text-xs text-warm">
                  {[a.merk, a.kleur ? `kleur ${a.kleur}` : null].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-1 text-xs text-warm">Kleur en logo liggen vast in jullie kledinglijn.</p>

                <fieldset className="mt-3">
                  <legend className="text-xs font-semibold text-ink-700">
                    Maat{isVoorkeur ? <span className="font-normal text-warm"> · vaste maat van {voor?.voornaam}</span> : null}
                  </legend>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {a.maten.map((m) => {
                      const aan = m === maat;
                      return (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={aan}
                          onClick={() => setMaatKeuze((k) => ({ ...k, [a.id]: m }))}
                          className={`min-h-[40px] min-w-[44px] rounded-lg border px-2.5 text-sm font-semibold transition ${
                            aan
                              ? 'border-[var(--demo-accent)] bg-[var(--demo-accent)] text-[color:var(--demo-op-accent)]'
                              : 'border-line bg-white text-ink-900 hover:border-ink-300'
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="mt-auto pt-4">
                  <p className="text-sm">
                    <span className="font-display text-lg font-extrabold text-ink-900">{euro(a.prijs)}</span>{' '}
                    <span className="text-xs text-warm">ex btw{a.prijsIndicatie ? ', richtprijs' : ''}</span>
                  </p>
                  <button type="button" disabled={!maat} onClick={() => toevoegen(a.id, maat)} className={`${knopAccent} mt-2 w-full`}>
                    {maat ? 'In winkelmand' : 'Kies eerst een maat'}
                  </button>
                  <p className="mt-2 min-h-[1.25rem] text-xs" aria-live="polite">
                    {n > 0 && (
                      <>
                        <span className="font-semibold text-green-700">Toegevoegd{n > 1 ? ` (${n}x)` : ''}.</span>{' '}
                        <Link href={`${paden.portaal}/winkelmand`} className="font-semibold text-ink-900 underline underline-offset-2">
                          Naar winkelmand
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {aantalMand > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-soft">
          <p className="text-sm text-ink-800">
            <strong>{aantalMand}</strong> {aantalMand === 1 ? 'artikel' : 'artikelen'} in de winkelmand
          </p>
          <Link href={`${paden.portaal}/winkelmand`} className={knopAccent}>
            Naar winkelmand
          </Link>
        </div>
      )}

      <p className="mt-6 text-xs text-warm">
        Prijzen zijn ex btw en dienen als voorbeeld. In jullie echte portaal staan jullie eigen prijsafspraken en logokosten er al in.
      </p>
    </div>
  );
}
