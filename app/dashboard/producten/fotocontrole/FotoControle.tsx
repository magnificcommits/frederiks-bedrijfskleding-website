'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ControleFoto, OntbrekendeFoto } from '@/lib/kms/afbeeldingen';
import { bewaarMetingenActie } from './actions';
import { DREMPELS, PROBLEEM_LABEL, kb, meetFoto, type FotoMeting, type FotoProbleem } from './meten';

type Meting = FotoMeting & { gemetenOp?: string };

const FILTERS: { id: string; label: string }[] = [
  { id: '', label: 'Alle foto’s' },
  { id: 'afwijkend', label: 'Met afwijking' },
  { id: 'te_klein', label: PROBLEEM_LABEL.te_klein },
  { id: 'niet_vierkant', label: PROBLEEM_LABEL.niet_vierkant },
  { id: 'wazig', label: PROBLEEM_LABEL.wazig },
  { id: 'witruimte', label: PROBLEEM_LABEL.witruimte },
  { id: 'uit_midden', label: PROBLEEM_LABEL.uit_midden },
  { id: 'laadfout', label: PROBLEEM_LABEL.laadfout },
  { id: 'ontbreekt', label: 'Ontbreekt' },
];

const sleutel = (f: { productId: string; url: string }) => `${f.productId}\u0000${f.url}`;
const PER_KEER = 100;
const TEGELIJK = 4;

function uitOpslag(f: ControleFoto): Meting | null {
  const m = f.meting;
  if (!m) return null;
  return {
    breedte: m.breedte,
    hoogte: m.hoogte,
    bytes: m.bytes,
    scherpte: m.scherpte,
    witruimte: m.witruimte,
    uitMidden: m.uit_midden,
    vulling: m.vulling,
    problemen: (m.problemen ?? []) as FotoProbleem[],
    gemetenOp: m.gemeten_op,
  };
}

export default function FotoControle({
  fotos,
  ontbrekend,
  opslaan,
  beginFilter,
}: {
  fotos: ControleFoto[];
  ontbrekend: OntbrekendeFoto[];
  opslaan: boolean;
  beginFilter: string;
}) {
  const [metingen, setMetingen] = useState<Map<string, Meting>>(() => {
    const m = new Map<string, Meting>();
    for (const f of fotos) {
      const o = uitOpslag(f);
      if (o) m.set(sleutel(f), o);
    }
    return m;
  });
  const [filter, setFilter] = useState(FILTERS.some((f) => f.id === beginFilter) ? beginFilter : '');
  const [zoek, setZoek] = useState('');
  const [ookInactief, setOokInactief] = useState(false);
  const [zichtbaar, setZichtbaar] = useState(PER_KEER);
  const [bezig, setBezig] = useState(false);
  const [wachtrij, setWachtrij] = useState(0);
  const [bewaarFout, setBewaarFout] = useState(false);
  const stoppen = useRef(false);
  const teBewaren = useRef<Parameters<typeof bewaarMetingenActie>[0]>([]);

  const spoel = useCallback(async () => {
    if (!opslaan || teBewaren.current.length === 0) return;
    const blok = teBewaren.current.splice(0, teBewaren.current.length);
    for (let i = 0; i < blok.length; i += 50) {
      const r = await bewaarMetingenActie(blok.slice(i, i + 50));
      if (!r.ok) setBewaarFout(true);
    }
  }, [opslaan]);

  const meet = useCallback(
    async (lijst: ControleFoto[]) => {
      if (lijst.length === 0) return;
      stoppen.current = false;
      setBezig(true);
      setWachtrij(lijst.length);
      let volgende = 0;
      const werker = async () => {
        while (!stoppen.current && volgende < lijst.length) {
          const f = lijst[volgende++];
          const m = await meetFoto(f.url);
          setMetingen((oud) => new Map(oud).set(sleutel(f), m));
          setWachtrij((w) => w - 1);
          teBewaren.current.push({
            productId: f.productId,
            kleur: f.kleur,
            url: f.url,
            breedte: m.breedte,
            hoogte: m.hoogte,
            bytes: m.bytes,
            scherpte: m.scherpte,
            witruimte: m.witruimte,
            uitMidden: m.uitMidden,
            vulling: m.vulling,
            problemen: m.problemen,
          });
          if (teBewaren.current.length >= 25) void spoel();
        }
      };
      await Promise.all(Array.from({ length: TEGELIJK }, werker));
      await spoel();
      setBezig(false);
      setWachtrij(0);
    },
    [spoel],
  );

  // Bij openen: alles meten wat nog geen meting heeft.
  const gestart = useRef(false);
  useEffect(() => {
    // In de ontwikkelmodus draait React dit effect twee keer (aan, uit, aan);
    // daarom hier steeds weer vrijgeven en maar één keer starten.
    stoppen.current = false;
    if (!gestart.current) {
      gestart.current = true;
      void meet(fotos.filter((f) => !f.meting));
    }
    return () => {
      stoppen.current = true;
    };
  }, [fotos, meet]);

  const basis = useMemo(() => {
    const t = zoek.trim().toLowerCase();
    return fotos.filter(
      (f) =>
        (ookInactief || f.actief) &&
        (!t || f.product.toLowerCase().includes(t) || (f.merk ?? '').toLowerCase().includes(t) || (f.kleur ?? '').toLowerCase().includes(t)),
    );
  }, [fotos, zoek, ookInactief]);

  const ontbrekendZichtbaar = useMemo(() => {
    const t = zoek.trim().toLowerCase();
    return ontbrekend.filter(
      (o) => (ookInactief || o.actief) && (!t || o.product.toLowerCase().includes(t) || (o.kleur ?? '').toLowerCase().includes(t)),
    );
  }, [ontbrekend, zoek, ookInactief]);

  const tellingen = useMemo(() => {
    const t: Record<string, number> = { '': basis.length, afwijkend: 0, ontbreekt: ontbrekendZichtbaar.length };
    for (const f of basis) {
      const m = metingen.get(sleutel(f));
      if (!m) continue;
      if (m.problemen.length) t.afwijkend++;
      for (const p of m.problemen) t[p] = (t[p] ?? 0) + 1;
    }
    return t;
  }, [basis, metingen, ontbrekendZichtbaar.length]);

  const rijen = useMemo(() => {
    const lijst = basis.filter((f) => {
      if (!filter) return true;
      const m = metingen.get(sleutel(f));
      if (!m) return false;
      if (filter === 'afwijkend') return m.problemen.length > 0;
      return m.problemen.includes(filter as FotoProbleem);
    });
    // Afwijkingen bovenaan, de ergste eerst; daarna wat nog gemeten moet worden.
    return lijst.sort((a, b) => {
      const ma = metingen.get(sleutel(a));
      const mb = metingen.get(sleutel(b));
      const pa = ma ? ma.problemen.length : -1;
      const pb = mb ? mb.problemen.length : -1;
      if (pa !== pb) return pb - pa;
      return a.product.localeCompare(b.product, 'nl');
    });
  }, [basis, filter, metingen]);

  function kiesFilter(id: string) {
    setFilter(id);
    setZichtbaar(PER_KEER);
    try {
      const u = new URL(window.location.href);
      if (id) u.searchParams.set('filter', id);
      else u.searchParams.delete('filter');
      window.history.replaceState(null, '', u.toString());
    } catch {
      // Geen history: filter werkt gewoon zonder URL.
    }
  }

  const gemeten = fotos.length - wachtrij;

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72 max-w-full">
          <label htmlFor="foto-zoek" className="veld-label">Zoeken</label>
          <input id="foto-zoek" type="search" value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Product, merk of kleur" className="veld" />
        </div>
        <label className="flex items-center gap-2 pb-1.5 text-[13px] text-ink-700">
          <input type="checkbox" checked={ookInactief} onChange={(e) => setOokInactief(e.target.checked)} />
          Ook inactieve producten
        </label>
        <div className="ml-auto flex items-center gap-2 pb-0.5">
          {bezig ? (
            <>
              <span className="text-[13px] tabular-nums text-warm" role="status" aria-live="polite">
                {gemeten.toLocaleString('nl-NL')} van {fotos.length.toLocaleString('nl-NL')} gemeten
              </span>
              <button type="button" className="knop-stil" onClick={() => (stoppen.current = true)}>Pauzeren</button>
            </>
          ) : (
            <>
              {fotos.some((f) => !metingen.has(sleutel(f))) && (
                <button type="button" className="knop-stil" onClick={() => void meet(fotos.filter((f) => !metingen.has(sleutel(f))))}>
                  Verder meten
                </button>
              )}
              <button
                type="button"
                className="knop-stil"
                onClick={() => void meet(rijen.length && filter && filter !== 'ontbreekt' ? rijen : basis)}
                title="Meet de foto's in de huidige selectie opnieuw, bijvoorbeeld na het vervangen"
              >
                Selectie opnieuw meten
              </button>
            </>
          )}
        </div>
      </div>
      {bezig && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded bg-ink-100" aria-hidden="true">
          <div className="h-full bg-amber-500 transition-[width]" style={{ width: `${fotos.length ? (gemeten / fotos.length) * 100 : 100}%` }} />
        </div>
      )}
      {bewaarFout && <p className="mt-2 text-[12px] text-red-700">Een deel van de metingen kon niet worden bewaard. Ze staan wel hier in beeld.</p>}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => kiesFilter(f.id)} className={`chip ${filter === f.id ? 'chip-aan' : ''}`}>
            {f.label}
            <span className="chip-tel">{tellingen[f.id] ?? 0}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-warm">
        Normen: kortste zijde minstens {DREMPELS.minKorteZijde} px, vierkant (marge {Math.round(DREMPELS.vierkantMarge * 100)}%), scherpte
        minstens {DREMPELS.minScherpte}, product vult minstens {Math.round(DREMPELS.minVulling * 100)}% van de foto.
      </p>

      {filter === 'ontbreekt' ? (
        ontbrekendZichtbaar.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-line bg-mist px-5 py-6 text-center text-[13px] text-warm">Elk product en elke kleur heeft een foto.</p>
        ) : (
          <div className="panel mt-4">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Merk</th>
                  <th>Wat ontbreekt</th>
                </tr>
              </thead>
              <tbody>
                {ontbrekendZichtbaar.slice(0, zichtbaar).map((o) => (
                  <tr key={`${o.productId}-${o.kleur ?? ''}`}>
                    <td>
                      <Link href={`/dashboard/producten/${o.productId}?tab=kleuren`} className="rij-link">{o.product}</Link>
                      {!o.actief && <span className="badge-rust ml-2">inactief</span>}
                    </td>
                    <td className="stil">{o.merk ?? '-'}</td>
                    <td>{o.kleur ? <>Foto voor kleur <strong className="font-semibold">{o.kleur}</strong></> : 'Helemaal geen foto'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : rijen.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line bg-mist px-5 py-6 text-center text-[13px] text-warm">
          {bezig ? 'Nog bezig met meten.' : 'Geen foto’s in deze selectie.'}
        </p>
      ) : (
        <div className="panel mt-4 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-16">Foto</th>
                <th>Product</th>
                <th>Kleur</th>
                <th className="text-right">Pixels</th>
                <th className="text-right">Verhouding</th>
                <th className="text-right">Grootte</th>
                <th className="text-right">Scherpte</th>
                <th className="text-right">Vulling</th>
                <th>Afwijkingen</th>
              </tr>
            </thead>
            <tbody>
              {rijen.slice(0, zichtbaar).map((f) => {
                const m = metingen.get(sleutel(f));
                const verhouding = m?.breedte && m?.hoogte ? m.breedte / m.hoogte : null;
                return (
                  <tr key={sleutel(f)}>
                    <td>
                      <a href={f.url} target="_blank" rel="noreferrer" title="Foto op volle grootte openen">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url} alt="" loading="lazy" className="h-12 w-12 rounded border border-line bg-white object-contain" />
                      </a>
                    </td>
                    <td>
                      <Link href={`/dashboard/producten/${f.productId}?tab=kleuren`} className="rij-link">{f.product}</Link>
                      <span className="block text-[11px] text-warm">{f.merk ?? ''}{!f.actief ? ' · inactief' : ''}</span>
                    </td>
                    <td className="stil">{f.kleur ?? 'algemeen'}</td>
                    <td className={`num ${m?.problemen.includes('te_klein') ? 'font-semibold text-amber-800' : ''}`}>
                      {m?.breedte ? `${m.breedte} × ${m.hoogte}` : m ? '-' : '…'}
                    </td>
                    <td className={`num ${m?.problemen.includes('niet_vierkant') ? 'font-semibold text-amber-800' : ''}`}>
                      {verhouding ? verhouding.toFixed(2).replace('.', ',') : '-'}
                    </td>
                    <td className="num">{m ? kb(m.bytes) : '…'}</td>
                    <td className={`num ${m?.problemen.includes('wazig') ? 'font-semibold text-amber-800' : ''}`}>
                      {m?.scherpte != null ? m.scherpte : '-'}
                    </td>
                    <td className={`num ${m?.problemen.includes('witruimte') ? 'font-semibold text-amber-800' : ''}`}>
                      {m?.vulling != null ? `${Math.round(m.vulling * 100)}%` : '-'}
                    </td>
                    <td>
                      {!m ? (
                        <span className="text-[12px] text-warm">wacht op meting</span>
                      ) : m.problemen.length === 0 ? (
                        <span className="badge-klaar">in orde</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {m.problemen.map((p) => (
                            <span key={p} className="badge-actie">{PROBLEEM_LABEL[p] ?? p}</span>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(filter === 'ontbreekt' ? ontbrekendZichtbaar.length : rijen.length) > zichtbaar && (
        <div className="mt-3 text-center">
          <button type="button" className="knop-stil" onClick={() => setZichtbaar((z) => z + PER_KEER)}>
            Meer tonen ({((filter === 'ontbreekt' ? ontbrekendZichtbaar.length : rijen.length) - zichtbaar).toLocaleString('nl-NL')} over)
          </button>
        </div>
      )}
    </div>
  );
}
