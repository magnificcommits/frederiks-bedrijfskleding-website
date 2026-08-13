'use client';

import { useMemo, useState, useTransition } from 'react';
import type { CatalogusItem, VariantKeuze } from '@/lib/kms/passessies';
import { haalVarianten, voegRegelToe } from '../actions';

type Medewerker = { id: string; naam: string; functie: string | null; personeelsnummer: string | null };

/**
 * Het pasformulier zoals je het op een tablet gebruikt: eerst de medewerker die voor je
 * staat, dan het artikel, dan kleur en maat. Grote raakvlakken, geen dropdowns waar een
 * rij knoppen kan. Na opslaan blijft de medewerker staan, want in de praktijk pas je er
 * meerdere stuks achter elkaar op.
 */
export default function PasSessieFormulier({
  passessieId,
  medewerkers,
  catalogus,
  gesloten,
}: {
  passessieId: string;
  medewerkers: Medewerker[];
  catalogus: CatalogusItem[];
  gesloten: boolean;
}) {
  const [medewerkerId, setMedewerkerId] = useState<string>('');
  const [losseNaam, setLosseNaam] = useState('');
  const [zoek, setZoek] = useState('');
  const [artikel, setArtikel] = useState<CatalogusItem | null>(null);
  const [keuze, setKeuze] = useState<VariantKeuze | null>(null);
  const [kleur, setKleur] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [maat, setMaat] = useState<string | null>(null);
  const [prijs, setPrijs] = useState<number | null>(null);
  const [lengte, setLengte] = useState<number | null>(null);
  const [aantal, setAantal] = useState(1);
  const [opmerking, setOpmerking] = useState('');
  const [melding, setMelding] = useState<{ soort: 'ok' | 'fout'; tekst: string } | null>(null);
  const [bezig, start] = useTransition();

  const gevonden = useMemo(() => {
    const t = zoek.trim().toLowerCase();
    if (t.length < 2) return [];
    return catalogus
      .filter((p) => `${p.naam} ${p.merk ?? ''} ${p.categorie ?? ''}`.toLowerCase().includes(t))
      .slice(0, 24);
  }, [zoek, catalogus]);

  function kiesArtikel(p: CatalogusItem) {
    setArtikel(p);
    setKeuze(null);
    setKleur(null);
    setVariantId(null);
    setMaat(null);
    setPrijs(null);
    setLengte(null);
    start(async () => {
      const k = await haalVarianten(p.id);
      setKeuze(k);
      if (k.kleuren.length === 1) setKleur(k.kleuren[0].kleur);
    });
  }

  function resetArtikel() {
    setArtikel(null);
    setKeuze(null);
    setKleur(null);
    setVariantId(null);
    setMaat(null);
    setPrijs(null);
    setLengte(null);
    setAantal(1);
    setOpmerking('');
  }

  function opslaan() {
    const naam = medewerkerId ? null : losseNaam.trim() || null;
    if (!medewerkerId && !naam) return setMelding({ soort: 'fout', tekst: 'Kies eerst wie er past.' });
    if (!artikel) return setMelding({ soort: 'fout', tekst: 'Kies eerst een artikel.' });
    if (!maat) return setMelding({ soort: 'fout', tekst: 'Kies een maat.' });
    if (artikel.maatwerk_lengte && !lengte) return setMelding({ soort: 'fout', tekst: 'Kies een broeklengte.' });

    start(async () => {
      const res = await voegRegelToe({
        passessieId,
        medewerkerId: medewerkerId || null,
        medewerkerNaam: naam,
        productId: artikel.id,
        variantId,
        itemNaam: artikel.naam,
        maat,
        kleur,
        lengte,
        aantal,
        stukprijs: prijs,
        opmerking: opmerking.trim() || null,
      });
      if (res.ok) {
        setMelding({ soort: 'ok', tekst: `${artikel.naam} - maat ${maat} vastgelegd.` });
        resetArtikel();
        setZoek('');
      } else {
        setMelding({ soort: 'fout', tekst: res.fout ?? 'Opslaan mislukt.' });
      }
    });
  }

  if (gesloten) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-mist p-6 text-sm text-warm">
        Deze sessie is afgerond. Heropen hem om nog iets toe te voegen.
      </p>
    );
  }

  const maten = kleur && keuze ? keuze.matenPerKleur[kleur] ?? [] : [];

  return (
    <div className="space-y-6">
      {melding && (
        <p
          className={`rounded-md px-4 py-3 text-sm font-medium ${
            melding.soort === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {melding.tekst}
        </p>
      )}

      {/* 1. Wie past er */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <h3 className="text-sm font-bold uppercase tracking-wide text-warm">1. Wie past er</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {medewerkers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMedewerkerId(m.id === medewerkerId ? '' : m.id);
                setLosseNaam('');
              }}
              className={`min-h-[52px] rounded-xl border px-4 py-2 text-left text-sm font-semibold transition ${
                medewerkerId === m.id
                  ? 'border-amber-500 bg-amber-500 text-ink-900'
                  : 'border-line bg-mist text-ink-800 hover:border-amber-300'
              }`}
            >
              {m.naam}
              {m.functie && <span className="block text-xs font-normal opacity-70">{m.functie}</span>}
            </button>
          ))}
          {medewerkers.length === 0 && (
            <p className="text-sm text-warm">Deze klant heeft nog geen medewerkers. Vul hieronder een naam in.</p>
          )}
        </div>
        <label className="mt-4 block text-sm font-medium text-ink-800">
          Of iemand die nog niet in het systeem staat
          <input
            value={losseNaam}
            onChange={(e) => {
              setLosseNaam(e.target.value);
              if (e.target.value) setMedewerkerId('');
            }}
            placeholder="Naam"
            className="mt-1 w-full rounded-md border border-line px-3 py-3 text-base focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </label>
      </section>

      {/* 2. Artikel */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <h3 className="text-sm font-bold uppercase tracking-wide text-warm">2. Artikel</h3>
        {artikel ? (
          <div className="mt-3 flex items-center gap-4">
            {artikel.afbeelding && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artikel.afbeelding} alt="" className="h-16 w-16 rounded-lg border border-line object-contain" />
            )}
            <div className="flex-1">
              <p className="font-semibold text-ink-900">{artikel.naam}</p>
              <p className="text-xs text-warm">{artikel.merk}</p>
            </div>
            <button type="button" onClick={resetArtikel} className="text-sm font-semibold text-warm hover:text-ink-800">
              Ander artikel
            </button>
          </div>
        ) : (
          <>
            <input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek op naam, merk of categorie"
              className="mt-3 w-full rounded-md border border-line px-3 py-3 text-base focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {gevonden.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => kiesArtikel(p)}
                  className="flex min-h-[64px] items-center gap-3 rounded-xl border border-line bg-mist p-2 text-left hover:border-amber-300"
                >
                  {p.afbeelding ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.afbeelding} alt="" className="h-12 w-12 rounded object-contain" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded bg-line text-[10px] text-warm">
                      geen foto
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-900">{p.naam}</span>
                    <span className="block truncate text-xs text-warm">{p.merk}</span>
                  </span>
                </button>
              ))}
              {zoek.trim().length >= 2 && gevonden.length === 0 && (
                <p className="text-sm text-warm">Niets gevonden voor &ldquo;{zoek}&rdquo;.</p>
              )}
            </div>
          </>
        )}
      </section>

      {/* 3. Kleur en maat */}
      {artikel && (
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <h3 className="text-sm font-bold uppercase tracking-wide text-warm">3. Kleur en maat</h3>
          {!keuze ? (
            <p className="mt-3 text-sm text-warm">Kleuren en maten laden...</p>
          ) : (
            <>
              {keuze.kleuren.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {keuze.kleuren.map((k) => (
                    <button
                      key={k.kleur}
                      type="button"
                      onClick={() => {
                        setKleur(k.kleur);
                        setMaat(null);
                        setVariantId(null);
                        setPrijs(null);
                      }}
                      className={`min-h-[48px] rounded-xl border px-3 py-2 text-sm font-medium ${
                        kleur === k.kleur
                          ? 'border-amber-500 bg-amber-500 text-ink-900'
                          : 'border-line bg-mist text-ink-800 hover:border-amber-300'
                      }`}
                    >
                      {k.kleur}
                    </button>
                  ))}
                </div>
              )}

              {kleur && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {maten.map((m) => (
                    <button
                      key={m.variant_id}
                      type="button"
                      onClick={() => {
                        setMaat(m.maat);
                        setVariantId(m.variant_id);
                        setPrijs(m.prijs);
                      }}
                      className={`min-h-[48px] min-w-[56px] rounded-xl border px-3 py-2 text-sm font-bold ${
                        variantId === m.variant_id
                          ? 'border-amber-500 bg-amber-500 text-ink-900'
                          : 'border-line bg-mist text-ink-800 hover:border-amber-300'
                      }`}
                    >
                      {m.maat}
                    </button>
                  ))}
                </div>
              )}

              {artikel.maatwerk_lengte && keuze.lengtes.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-ink-800">
                    Broeklengte <span className="font-normal text-warm">(wordt op maat gemaakt)</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {keuze.lengtes.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLengte(l)}
                        className={`min-h-[44px] min-w-[52px] rounded-xl border px-3 py-2 text-sm font-bold ${
                          lengte === l
                            ? 'border-amber-500 bg-amber-500 text-ink-900'
                            : 'border-line bg-mist text-ink-800 hover:border-amber-300'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-end gap-4">
                <label className="text-sm font-medium text-ink-800">
                  Aantal
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAantal((a) => Math.max(1, a - 1))}
                      className="h-12 w-12 rounded-xl border border-line bg-mist text-xl font-bold"
                    >
                      -
                    </button>
                    <span className="w-10 text-center text-lg font-bold">{aantal}</span>
                    <button
                      type="button"
                      onClick={() => setAantal((a) => a + 1)}
                      className="h-12 w-12 rounded-xl border border-line bg-mist text-xl font-bold"
                    >
                      +
                    </button>
                  </div>
                </label>
                <label className="min-w-[200px] flex-1 text-sm font-medium text-ink-800">
                  Opmerking
                  <input
                    value={opmerking}
                    onChange={(e) => setOpmerking(e.target.value)}
                    placeholder="Bijv. logo op borst en rug"
                    className="mt-1 w-full rounded-md border border-line px-3 py-3 text-base focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </label>
                {prijs !== null && (
                  <p className="text-sm text-warm">
                    Stukprijs{' '}
                    <span className="font-bold text-ink-900">
                      {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(prijs)}
                    </span>
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={opslaan}
                disabled={bezig}
                className="mt-5 w-full rounded-xl bg-amber-500 px-6 py-4 text-base font-bold text-ink-900 hover:bg-amber-400 disabled:opacity-50 sm:w-auto"
              >
                {bezig ? 'Bezig...' : 'Vastleggen'}
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
