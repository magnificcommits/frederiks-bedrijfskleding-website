'use client';
import { useEffect, useRef, useState } from 'react';
import { normaliseerFotoActie, teNormaliserenActie, terugzettenActie, type GelijkResultaat } from './gelijkActions';

type Uitkomst = GelijkResultaat & { bron: string; teruggezet?: boolean };

const TEGELIJK = 3;
const METHODE: Record<string, string> = {
  transparant: 'was al vrijstaand',
  licht: 'achtergrond wit gemaakt',
  vrijstaand: 'achtergrond weggehaald',
  ongewijzigd: 'niet aangepast, controleer',
};

/** Alle productfoto's in één stijl: product op wit, bijgesneden en even groot. */
export default function GelijkTrekken() {
  const [todo, setTodo] = useState<string[] | null>(null);
  const [klaar, setKlaar] = useState(0);
  const [bezig, setBezig] = useState(false);
  const [uitkomsten, setUitkomsten] = useState<Uitkomst[]>([]);
  const stop = useRef(false);

  const laad = async () => {
    const r = await teNormaliserenActie();
    setTodo(r.todo);
    setKlaar(r.klaar);
  };
  useEffect(() => {
    laad();
  }, []);

  const start = async () => {
    if (!todo?.length) return;
    stop.current = false;
    setBezig(true);
    setUitkomsten([]);
    const rij = [...todo];
    await Promise.all(
      Array.from({ length: TEGELIJK }, async () => {
        while (rij.length && !stop.current) {
          const bron = rij.shift()!;
          let r: GelijkResultaat;
          try {
            r = await normaliseerFotoActie(bron);
          } catch {
            r = { ok: false, fout: 'Verbinding verbroken.' };
          }
          setUitkomsten((u) => [{ ...r, bron }, ...u]);
        }
      }),
    );
    setBezig(false);
    await laad();
  };

  const terug = async (u: Uitkomst) => {
    if (!u.url) return;
    const r = await terugzettenActie(u.url);
    if (r.ok) setUitkomsten((lijst) => lijst.map((x) => (x.url === u.url ? { ...x, teruggezet: true } : x)));
  };

  const gelukt = uitkomsten.filter((u) => u.ok).length;
  const mislukt = uitkomsten.filter((u) => !u.ok);
  const totaal = bezig ? (todo?.length ?? 0) : uitkomsten.length;
  const controleren = uitkomsten.filter((u) => u.ok && u.methode === 'ongewijzigd');

  return (
    <section className="mt-6 rounded-xl border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-ink-900">Foto&apos;s gelijk trekken</h2>
          <p className="mt-1 max-w-2xl text-sm text-warm">
            Zet elke productfoto in dezelfde stijl: product op wit, bijgesneden en even groot. Grijze en gekleurde achtergronden gaan weg. Het
            origineel wordt bewaard; elke foto is terug te zetten.
          </p>
          <p className="mt-2 text-sm font-semibold text-ink-900">
            {todo === null ? 'Foto’s tellen…' : `${todo.length} foto’s te doen · ${klaar} al gedaan`}
          </p>
        </div>
        {bezig ? (
          <button type="button" className="knop-stil" onClick={() => (stop.current = true)}>
            Stoppen
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={!todo?.length} onClick={start}>
            Gelijk trekken
          </button>
        )}
      </div>

      {uitkomsten.length > 0 && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-mist">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${totaal ? Math.round((uitkomsten.length / totaal) * 100) : 0}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-800">
            {uitkomsten.length} verwerkt · {gelukt} klaar · {mislukt.length} mislukt · {controleren.length} niet aangepast
            {bezig ? '' : ' · klaar'}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {uitkomsten
              .filter((u) => u.ok && u.url)
              .slice(0, 48)
              .map((u) => (
                <figure key={u.url} className="min-w-0 rounded-lg border border-line bg-white p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.teruggezet ? u.bron : u.url} alt="" className="aspect-square w-full object-contain" loading="lazy" />
                  <figcaption className="mt-1 flex items-center justify-between gap-1 text-[11px] text-warm">
                    <span className="truncate">{u.teruggezet ? 'teruggezet' : METHODE[u.methode ?? ''] ?? ''}</span>
                    {!u.teruggezet && (
                      <button type="button" onClick={() => terug(u)} className="shrink-0 font-semibold text-amber-700 hover:underline">
                        terug
                      </button>
                    )}
                  </figcaption>
                </figure>
              ))}
          </div>
          {!bezig && mislukt.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink-900">Mislukt ({mislukt.length})</summary>
              <ul className="mt-2 max-h-60 divide-y divide-line overflow-auto rounded-lg border border-line text-xs">
                {mislukt.map((m) => (
                  <li key={m.bron} className="flex flex-wrap justify-between gap-2 px-3 py-1.5">
                    <span className="min-w-0 truncate">{m.bron}</span>
                    <span className="text-warm">{m.fout}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
