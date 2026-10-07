'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useOfferteSelectie } from '@/components/OfferteSelectie';
import { LOGO_KEUZES, schoonAantal, stuks, volledigeNaam, type LogoKeuze } from '@/lib/offerteMand';

/**
 * Het offertemandje op /offerte: per regel kleur, aantallen per maat en logo
 * nog aanpassen, of de regel weghalen.
 */
export function MandRegels() {
  const { items, stuks: totaal, werkBij, verwijder, leegmaken } = useOfferteSelectie();
  if (items.length === 0) return null;

  const veld = 'min-h-[36px] rounded-md border border-line bg-white px-2 py-1 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

  return (
    <div className="rounded-xl border border-line bg-mist p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-lg font-extrabold text-ink-900">
          Je offerte: {items.length} {items.length === 1 ? 'artikel' : 'artikelen'}
          {totaal > 0 && <span className="font-sans text-sm font-normal text-warm"> · {totaal} stuks</span>}
        </p>
        <div className="flex gap-4 text-xs font-semibold">
          <Link href="/assortiment" className="text-amber-700 underline underline-offset-2">Artikel toevoegen</Link>
          <button type="button" onClick={leegmaken} className="text-warm underline underline-offset-2 hover:text-ink-900">
            Alles verwijderen
          </button>
        </div>
      </div>

      <ul className="mt-4 grid gap-3">
        {items.map((r) => {
          const naam = volledigeNaam(r.merk, r.naam);
          const url = r.categorieSlug ? `/assortiment/${r.categorieSlug}/${r.slug}` : null;
          return (
            <li key={r.sleutel} className="rounded-lg border border-line bg-white p-3">
              <div className="flex gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-line bg-white">
                  {r.foto && <Image src={r.foto} alt="" fill sizes="64px" className="object-contain p-1" />}
                </div>
                <div className="min-w-0 grow">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug text-ink-900">
                      {url ? <Link href={url} className="hover:text-amber-700">{naam}</Link> : naam}
                    </p>
                    <button
                      type="button"
                      onClick={() => verwijder(r.sleutel)}
                      aria-label={`${naam} uit je offerte halen`}
                      className="rounded px-1.5 text-lg leading-none text-warm hover:bg-mist hover:text-ink-900"
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.kleuren.length > 0 ? (
                      <select
                        value={r.kleur ?? ''}
                        onChange={(e) => werkBij(r.sleutel, { kleur: e.target.value || null })}
                        aria-label={`Kleur voor ${naam}`}
                        className={`${veld} ${r.kleur ? '' : 'border-amber-300'}`}
                      >
                        <option value="">Kies een kleur…</option>
                        {r.kleuren.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    ) : (
                      <input
                        value={r.kleur ?? ''}
                        onChange={(e) => werkBij(r.sleutel, { kleur: e.target.value.slice(0, 60) || null })}
                        placeholder="Kleur"
                        aria-label={`Kleur voor ${naam}`}
                        className={`${veld} w-36`}
                      />
                    )}
                    <select
                      value={r.logo ?? ''}
                      onChange={(e) => werkBij(r.sleutel, { logo: (e.target.value || null) as LogoKeuze | null })}
                      aria-label={`Logo voor ${naam}`}
                      className={veld}
                    >
                      <option value="">Logo…</option>
                      {LOGO_KEUZES.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                {r.maten.length > 0 ? (
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                    {r.maten.map((m) => (
                      <label key={m} className="flex flex-col items-center rounded-md border border-line px-1 pb-1 pt-0.5 focus-within:border-amber-400">
                        <span className="text-[11px] font-bold text-ink-700">{m}</span>
                        <input
                          inputMode="numeric"
                          value={r.aantallen[m] ? String(r.aantallen[m]) : ''}
                          onChange={(e) => {
                            const n = schoonAantal(e.target.value);
                            const nieuw = { ...r.aantallen };
                            if (n) nieuw[m] = n;
                            else delete nieuw[m];
                            werkBij(r.sleutel, { aantallen: nieuw });
                          }}
                          placeholder="0"
                          aria-label={`${naam}, aantal in maat ${m}`}
                          className="w-full border-0 bg-transparent p-0 text-center text-sm tabular-nums placeholder:text-ink-300 focus:outline-none focus:ring-0"
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <label className="flex items-center gap-2 text-sm text-warm">
                    Aantal
                    <input
                      inputMode="numeric"
                      value={r.aantalZonderMaat ? String(r.aantalZonderMaat) : ''}
                      onChange={(e) => werkBij(r.sleutel, { aantalZonderMaat: schoonAantal(e.target.value) })}
                      placeholder="0"
                      className={`${veld} w-24 tabular-nums`}
                    />
                  </label>
                )}
                <p className="mt-1.5 text-xs text-warm">
                  {stuks(r) > 0 ? `${stuks(r)} stuks` : 'Aantallen nog open, mag ook.'}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-warm">
        Kleur, maten en logo mag je openlaten. We rekenen alles door in één voorstel, met jouw staffel en bedrukking erbij.
      </p>
    </div>
  );
}
