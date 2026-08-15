'use client';

import { useMemo, useState } from 'react';
import type { KaartProduct } from '@/lib/kms/catalogus';
import { ProductKaart } from '@/components/ProductKaart';

/**
 * Filterbaar assortimentsoverzicht.
 *
 * Filteren gebeurt in de browser en niet via de server. Een categorie heeft
 * hoogstens een paar honderd artikelen, dus dat is instant, en de pagina blijft
 * statisch te genereren - beter voor snelheid én voor Google dan een URL met
 * queryparameters per filtercombinatie.
 *
 * Binnen één groep is het OF (Snickers óf Fristads), tussen groepen is het EN
 * (Snickers én maat L). Dat is wat mensen verwachten van een filter, ook al zegt
 * niemand het hardop.
 */
type Groep = { sleutel: string; label: string; waarden: string[] };

/** XS < S < M < ... < 5XL, en getallen op getalvolgorde. Alfabetisch zet 10 vóór 2. */
const MAATVOLGORDE = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', '6XL'];
function maatSorteer(a: string, b: string): number {
  const na = Number(a.replace(/\D/g, '')), nb = Number(b.replace(/\D/g, ''));
  const aIsGetal = /^\d/.test(a.trim()), bIsGetal = /^\d/.test(b.trim());
  if (aIsGetal && bIsGetal) return na - nb;
  if (aIsGetal !== bIsGetal) return aIsGetal ? 1 : -1;
  const ia = MAATVOLGORDE.indexOf(a.toUpperCase()), ib = MAATVOLGORDE.indexOf(b.toUpperCase());
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b, 'nl');
}

function telOp(waarden: (string | null)[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of waarden) {
    const s = w?.trim();
    if (s) m.set(s, (m.get(s) ?? 0) + 1);
  }
  return m;
}

export function Assortimentslijst({
  producten,
  toonMerkfilter = true,
}: {
  producten: KaartProduct[];
  toonMerkfilter?: boolean;
}) {
  const [keuze, setKeuze] = useState<Record<string, string[]>>({});

  const groepen = useMemo<Groep[]>(() => {
    const g: Groep[] = [];
    if (toonMerkfilter) {
      const merken = telOp(producten.map((p) => p.merk));
      if (merken.size > 1) {
        g.push({
          sleutel: 'merk',
          label: 'Merk',
          waarden: [...merken.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'nl')).map(([k]) => k),
        });
      }
    }
    const kleuren = telOp(producten.flatMap((p) => p.kleuren));
    if (kleuren.size > 1) {
      // Bij tientallen kleurnamen ("Navy/Zwart 9504") is een volledige lijst
      // onbruikbaar; de twaalf meestvoorkomende dekken vrijwel alles.
      g.push({
        sleutel: 'kleur',
        label: 'Kleur',
        waarden: [...kleuren.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k),
      });
    }
    const maten = telOp(producten.flatMap((p) => p.maten));
    if (maten.size > 1) {
      g.push({ sleutel: 'maat', label: 'Maat', waarden: [...maten.keys()].sort(maatSorteer) });
    }
    const geslacht = telOp(producten.map((p) => p.geslacht));
    if (geslacht.size > 1) {
      g.push({ sleutel: 'geslacht', label: 'Voor', waarden: [...geslacht.keys()].sort((a, b) => a.localeCompare(b, 'nl')) });
    }
    return g;
  }, [producten, toonMerkfilter]);

  const zichtbaar = useMemo(() => {
    const actief = Object.entries(keuze).filter(([, v]) => v.length);
    if (!actief.length) return producten;
    return producten.filter((p) =>
      actief.every(([sleutel, waarden]) => {
        if (sleutel === 'merk') return p.merk ? waarden.includes(p.merk) : false;
        if (sleutel === 'geslacht') return p.geslacht ? waarden.includes(p.geslacht) : false;
        if (sleutel === 'kleur') return p.kleuren.some((k) => waarden.includes(k));
        if (sleutel === 'maat') return p.maten.some((m) => waarden.includes(m));
        return true;
      }),
    );
  }, [producten, keuze]);

  const aantalActief = Object.values(keuze).reduce((n, v) => n + v.length, 0);
  const wissel = (sleutel: string, waarde: string) =>
    setKeuze((h) => {
      const huidig = h[sleutel] ?? [];
      const nieuw = huidig.includes(waarde) ? huidig.filter((x) => x !== waarde) : [...huidig, waarde];
      return { ...h, [sleutel]: nieuw };
    });

  return (
    <>
      {groepen.length > 0 && (
        <div className="rounded-xl border border-line bg-mist p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-warm">Filter</p>
            {aantalActief > 0 && (
              <button
                type="button"
                onClick={() => setKeuze({})}
                className="text-sm font-semibold text-amber-700 underline underline-offset-2"
              >
                Wis alle filters ({aantalActief})
              </button>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {groepen.map((g) => (
              <div key={g.sleutel} className="sm:grid sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-4">
                <p className="pt-1.5 text-sm font-semibold text-ink-800">{g.label}</p>
                <div className="mt-1.5 flex flex-wrap gap-2 sm:mt-0">
                  {g.waarden.map((w) => {
                    const aan = (keuze[g.sleutel] ?? []).includes(w);
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => wissel(g.sleutel, w)}
                        aria-pressed={aan}
                        className={`rounded-md border px-3 py-1.5 text-sm transition ${
                          aan
                            ? 'border-amber-500 bg-amber-500 font-semibold text-ink-900'
                            : 'border-line bg-white text-ink-700 hover:border-amber-400'
                        }`}
                      >
                        {w}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-sm text-warm" aria-live="polite">
        {zichtbaar.length === producten.length
          ? `${producten.length} artikelen`
          : `${zichtbaar.length} van ${producten.length} artikelen`}
      </p>

      {zichtbaar.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-white px-5 py-8 text-center text-warm">
          Geen artikelen met deze combinatie.{' '}
          <button type="button" onClick={() => setKeuze({})} className="font-semibold text-amber-700 underline underline-offset-2">
            Wis de filters
          </button>{' '}
          of bel ons — we leveren meer dan hier staat.
        </p>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {zichtbaar.map((p) => (
            <ProductKaart key={p.id} p={p} />
          ))}
        </div>
      )}
    </>
  );
}
