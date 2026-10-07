'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useOfferteSelectie } from '@/components/OfferteSelectie';
import { LOGO_KEUZES, mandSleutel, schoonAantal, stuks, volledigeNaam, type LogoKeuze } from '@/lib/offerteMand';

export type KoopProduct = {
  id: string;
  naam: string;
  merk: string | null;
  categorieSlug: string | null;
  slug: string;
  foto: string | null;
  fotos: string[];
  kleuren: string[];
  maten: string[];
  matenPerKleur: Record<string, string[]>;
};

/**
 * Productpagina, interactief deel: foto per kleur, kleur kiezen, aantallen per
 * maat en de logoplek, en dat in het offertemandje leggen. De vaste teksten
 * (kop, omschrijving, specificaties) komen van de server als `kop` en `onder`,
 * zodat ze statisch en vindbaar blijven.
 */
export function ProductKoop({
  p,
  kleurFotos,
  kop,
  onder,
}: {
  p: KoopProduct;
  kleurFotos: Record<string, string>;
  kop: React.ReactNode;
  onder: React.ReactNode;
}) {
  const { voegToe, items } = useOfferteSelectie();
  const [kleur, setKleur] = useState<string | null>(p.kleuren.length === 1 ? p.kleuren[0] : null);
  const [extraFoto, setExtraFoto] = useState<string | null>(null);
  const [aantallen, setAantallen] = useState<Record<string, number>>({});
  const [zonderMaat, setZonderMaat] = useState(0);
  const [logo, setLogo] = useState<LogoKeuze | null>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const hoofdFoto = extraFoto ?? (kleur && kleurFotos[kleur]) ?? p.foto;
  const leverbaar = useMemo(() => {
    const lijst = kleur ? p.matenPerKleur[kleur] : null;
    return new Set(lijst && lijst.length ? lijst : p.maten);
  }, [kleur, p.matenPerKleur, p.maten]);
  const totaal = stuks({ aantallen, aantalZonderMaat: zonderMaat });
  const inMand = items.filter((r) => r.productId === p.id);

  function kiesKleur(k: string) {
    setKleur(k);
    setExtraFoto(null);
    setFout(null);
    // Maten die in deze kleur niet bestaan vallen weg.
    const lijst = p.matenPerKleur[k];
    if (lijst?.length) setAantallen((h) => Object.fromEntries(Object.entries(h).filter(([m]) => lijst.includes(m))));
  }

  function toevoegen() {
    if (p.kleuren.length > 1 && !kleur) {
      setFout('Kies eerst een kleur.');
      document.getElementById('kleurkeuze')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    voegToe({
      sleutel: mandSleutel(p.id, kleur),
      productId: p.id,
      naam: p.naam,
      merk: p.merk,
      categorieSlug: p.categorieSlug,
      slug: p.slug,
      foto: (kleur && kleurFotos[kleur]) || p.foto,
      kleuren: p.kleuren,
      maten: p.maten,
      kleur,
      aantallen,
      aantalZonderMaat: zonderMaat,
      logo,
    });
    setMelding(
      [kleur, totaal ? `${totaal} ${totaal === 1 ? 'stuk' : 'stuks'}` : 'aantallen nog open'].filter(Boolean).join(', '),
    );
    setAantallen({});
    setZonderMaat(0);
    setFout(null);
  }

  const knopKlein = 'rounded-md border px-3 py-1.5 text-xs font-semibold transition';

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
      <div>
        <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-white">
          {hoofdFoto && (
            <Image
              key={hoofdFoto}
              src={hoofdFoto}
              alt={[volledigeNaam(p.merk, p.naam), kleur].filter(Boolean).join(', ')}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain p-6"
              priority
            />
          )}
        </div>
        {p.fotos.length > 1 && (
          <div className="mt-3 grid grid-cols-4 gap-3">
            {p.fotos.slice(0, 4).map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => setExtraFoto(f)}
                className={`relative aspect-square overflow-hidden rounded-lg border bg-white ${extraFoto === f ? 'border-amber-500' : 'border-line hover:border-ink-300'}`}
                aria-label="Bekijk deze foto"
              >
                <Image src={f} alt="" fill sizes="25vw" className="object-contain p-2" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        {kop}

        {p.kleuren.length > 0 && (
          <div id="kleurkeuze" className="mt-6">
            <p className="text-sm font-semibold text-ink-900">
              Kleur{kleur ? <span className="font-normal text-warm">: {kleur}</span> : <span className="font-normal text-warm"> ({p.kleuren.length})</span>}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.kleuren.map((k) => {
                const f = kleurFotos[k];
                const aan = kleur === k;
                return f ? (
                  <button
                    type="button"
                    key={k}
                    onClick={() => kiesKleur(k)}
                    aria-pressed={aan}
                    title={k}
                    className={`relative h-14 w-14 overflow-hidden rounded-lg border-2 bg-white transition ${aan ? 'border-amber-500' : 'border-line hover:border-ink-400'}`}
                  >
                    <Image src={f} alt={k} fill sizes="56px" className="object-contain p-1" />
                  </button>
                ) : (
                  <button
                    type="button"
                    key={k}
                    onClick={() => kiesKleur(k)}
                    aria-pressed={aan}
                    className={`${knopKlein} ${aan ? 'border-amber-500 bg-amber-50 text-ink-900' : 'border-line bg-white text-ink-700 hover:border-ink-400'}`}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
            {fout && <p className="mt-2 text-sm font-medium text-amber-700">{fout}</p>}
          </div>
        )}

        <div className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-ink-900">{p.maten.length ? 'Aantal per maat' : 'Aantal'}</p>
            {totaal > 0 && <p className="text-sm text-warm"><span className="font-semibold text-ink-900 tabular-nums">{totaal}</span> stuks</p>}
          </div>
          {p.maten.length > 0 ? (
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {p.maten.map((m) => {
                const ok = leverbaar.has(m);
                return (
                  <label
                    key={m}
                    className={`flex flex-col items-center rounded-lg border px-1 pb-1.5 pt-1 ${ok ? 'border-line bg-white focus-within:border-amber-400' : 'border-line bg-mist opacity-50'}`}
                    title={ok ? undefined : `Niet leverbaar in ${kleur}`}
                  >
                    <span className="text-xs font-bold text-ink-800">{m}</span>
                    <input
                      inputMode="numeric"
                      disabled={!ok}
                      value={aantallen[m] ? String(aantallen[m]) : ''}
                      onChange={(e) => {
                        const n = schoonAantal(e.target.value);
                        setAantallen((h) => {
                          const nieuw = { ...h };
                          if (n) nieuw[m] = n;
                          else delete nieuw[m];
                          return nieuw;
                        });
                      }}
                      placeholder="0"
                      aria-label={`Aantal in maat ${m}`}
                      className="mt-1 w-full rounded border-0 bg-transparent p-0 text-center text-base tabular-nums text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-0"
                    />
                  </label>
                );
              })}
            </div>
          ) : (
            <input
              inputMode="numeric"
              value={zonderMaat ? String(zonderMaat) : ''}
              onChange={(e) => setZonderMaat(schoonAantal(e.target.value))}
              placeholder="0"
              aria-label="Aantal"
              className="invoer mt-2 w-32 tabular-nums"
            />
          )}
          <p className="mt-2 text-xs text-warm">
            Maten nog niet bekend? Laat ze leeg, dan passen we eerst. Bekijk de{' '}
            <Link href="/maattabellen" className="font-semibold text-amber-700 underline underline-offset-2">maattabellen</Link>.
          </p>
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold text-ink-900">Logo</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LOGO_KEUZES.map((l) => (
              <button
                type="button"
                key={l}
                onClick={() => setLogo(logo === l ? null : l)}
                aria-pressed={logo === l}
                className={`${knopKlein} ${logo === l ? 'border-amber-500 bg-amber-50 text-ink-900' : 'border-line bg-white text-ink-700 hover:border-ink-400'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3" data-plek="product">
          <button type="button" onClick={toevoegen} className="btn-primary" data-cta="mandje">
            In mijn offerte
          </button>
          <Link href="/pakket-samenstellen" className="btn-outline">Ontwerp met je logo</Link>
        </div>

        <div aria-live="polite">
          {melding && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <p className="text-ink-900">
                <span aria-hidden="true">✓ </span>Toegevoegd aan je offerte: {melding}.
              </p>
              <Link href="/offerte" className="ml-auto font-semibold text-amber-700 underline underline-offset-2">
                Bekijk mijn offerte ({items.length})
              </Link>
            </div>
          )}
          {!melding && inMand.length > 0 && (
            <p className="mt-3 text-sm text-warm">
              Staat al in je offerte{inMand.some((r) => r.kleur) ? ` (${inMand.map((r) => r.kleur ?? 'kleur open').join(', ')})` : ''}.{' '}
              <Link href="/offerte" className="font-semibold text-amber-700 underline underline-offset-2">Bekijk</Link>
            </p>
          )}
        </div>

        {onder}
      </div>
    </div>
  );
}
