'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { VoorraadProduct } from '@/lib/kms/voorraad';

const GEEN_MERK = 'Geen merk';

type MerkGroep = {
  merk: string;
  producten: VoorraadProduct[];
  onderMinimum: number;
};

export default function VoorraadLijst({ producten }: { producten: VoorraadProduct[] }) {
  const [zoek, setZoek] = useState('');
  const [merkFilter, setMerkFilter] = useState('');
  const [openMerken, setOpenMerken] = useState<Record<string, boolean>>({});

  // Beschikbare merken voor de filterchips (uniek, alfabetisch).
  const merken = useMemo(() => {
    const set = new Set<string>();
    for (const p of producten) set.add(p.merk || GEEN_MERK);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'nl'));
  }, [producten]);

  // Filter op zoekterm (naam, merk, maat en kleur van varianten) en op merk.
  const gefilterd = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    return producten.filter((p) => {
      const merk = p.merk || GEEN_MERK;
      if (merkFilter && merk !== merkFilter) return false;
      if (!term) return true;
      if (p.naam.toLowerCase().includes(term)) return true;
      if (merk.toLowerCase().includes(term)) return true;
      return p.varianten.some(
        (v) =>
          (v.maat ?? '').toLowerCase().includes(term) ||
          (v.kleur ?? '').toLowerCase().includes(term),
      );
    });
  }, [producten, zoek, merkFilter]);

  // Groepeer de gefilterde producten per merk.
  const groepen = useMemo<MerkGroep[]>(() => {
    const map = new Map<string, VoorraadProduct[]>();
    for (const p of gefilterd) {
      const merk = p.merk || GEEN_MERK;
      const lijst = map.get(merk);
      if (lijst) lijst.push(p);
      else map.set(merk, [p]);
    }
    return Array.from(map.entries())
      .map(([merk, lijst]) => ({
        merk,
        producten: lijst,
        onderMinimum: lijst.filter((p) => p.onderMinimum).length,
      }))
      .sort((a, b) => a.merk.localeCompare(b.merk, 'nl'));
  }, [gefilterd]);

  const totaalGefilterd = gefilterd.length;
  const onderMinimumGefilterd = gefilterd.filter((p) => p.onderMinimum).length;

  // Een merk is open als de gebruiker het expliciet opende, of -- bij geen expliciete
  // keuze -- automatisch wanneer er producten onder minimum in zitten of er gezocht wordt.
  const isOpen = (g: MerkGroep) => {
    const expliciet = openMerken[g.merk];
    if (expliciet !== undefined) return expliciet;
    if (zoek.trim()) return true;
    return g.onderMinimum > 0;
  };

  const toggle = (merk: string, open: boolean) =>
    setOpenMerken((prev) => ({ ...prev, [merk]: !open }));

  return (
    <div>
      {/* Overzicht bovenaan */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span
          className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
            onderMinimumGefilterd > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
          }`}
        >
          {onderMinimumGefilterd === 1
            ? '1 product onder minimum'
            : `${onderMinimumGefilterd} producten onder minimum`}
        </span>
        <span className="text-sm text-warm">
          {totaalGefilterd === 1 ? '1 product' : `${totaalGefilterd} producten`}
          {totaalGefilterd !== producten.length ? ` van ${producten.length}` : ''}
        </span>
      </div>

      {/* Zoekbalk + merkfilter */}
      <div className="mt-5 flex flex-col gap-4">
        <div className="relative max-w-md">
          <input
            type="search"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek op product, merk, maat of kleur"
            aria-label="Zoek in voorraad"
            className="w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-sm text-ink-900 shadow-soft outline-none placeholder:text-warm focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
          />
        </div>

        {merken.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMerkFilter('')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                merkFilter === ''
                  ? 'border-amber-300 bg-amber-100 text-amber-800'
                  : 'border-line bg-white text-warm hover:text-ink-800'
              }`}
            >
              Alle merken
            </button>
            {merken.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMerkFilter(m)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  merkFilter === m
                    ? 'border-amber-300 bg-amber-100 text-amber-800'
                    : 'border-line bg-white text-warm hover:text-ink-800'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lijst, gegroepeerd per merk en inklapbaar */}
      {groepen.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">
          Geen producten gevonden voor deze zoekopdracht.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {groepen.map((g) => {
            const open = isOpen(g);
            return (
              <section
                key={g.merk}
                className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft"
              >
                <button
                  type="button"
                  onClick={() => toggle(g.merk, open)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-mist"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`text-warm transition-transform ${open ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    >
                      &#9656;
                    </span>
                    <span className="font-display text-lg font-bold text-ink-900">{g.merk}</span>
                    <span className="inline-block rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-warm">
                      {g.producten.length === 1 ? '1 product' : `${g.producten.length} producten`}
                    </span>
                    {g.onderMinimum > 0 && (
                      <span className="inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        {g.onderMinimum} onder minimum
                      </span>
                    )}
                  </span>
                </button>

                {open && (
                  <div className="border-t border-line">
                    {g.producten.map((p) => (
                      <ProductRij key={p.id} product={p} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductRij({ product: p }: { product: VoorraadProduct }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-b border-line last:border-b-0 ${p.onderMinimum ? 'bg-amber-50' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3 text-left hover:bg-mist"
      >
        <span className="flex items-center gap-2">
          <span
            className={`text-warm transition-transform ${open ? 'rotate-90' : ''}`}
            aria-hidden="true"
          >
            &#9656;
          </span>
          <span className="font-semibold text-ink-900">{p.naam}</span>
          <span className="text-xs text-warm">
            {p.varianten.length === 1 ? '1 variant' : `${p.varianten.length} varianten`}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {p.onderMinimum && (
            <span className="inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              Onder minimum
            </span>
          )}
          <span className="inline-block rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-warm">
            Totaal {p.totaal}
            {p.min_voorraad != null ? ` / min. ${p.min_voorraad}` : ''}
          </span>
        </span>
      </button>

      {open && (
        <div className="px-5 pb-4">
          <div className="mb-3">
            <Link
              href={`/dashboard/producten/${p.id}`}
              className="text-sm font-semibold text-amber-700 hover:text-amber-800"
            >
              Naar productpagina
            </Link>
          </div>
          {p.varianten.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-4 py-3 text-sm text-warm">
              Geen varianten voor dit product.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                  <tr>
                    <th className="px-4 py-3">Maat</th>
                    <th className="px-4 py-3">Kleur</th>
                    <th className="px-4 py-3">Voorraad</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {p.varianten.map((v) => (
                    <tr key={v.id} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3 text-warm">{v.maat || '-'}</td>
                      <td className="px-4 py-3 text-warm">{v.kleur || '-'}</td>
                      <td className="px-4 py-3 font-semibold text-ink-900">{v.voorraad}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                            v.actief ? 'bg-green-100 text-green-800' : 'bg-ink-100 text-ink-500'
                          }`}
                        >
                          {v.actief ? 'actief' : 'inactief'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
