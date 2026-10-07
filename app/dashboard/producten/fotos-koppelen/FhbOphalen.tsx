'use client';
import { useEffect, useRef, useState } from 'react';
import type { KoppelArtikel } from '@/lib/kms/fotoKoppelen';
import { haalFhbKleurfotoActie, koppelArtikelenActie, type FhbResultaat } from './actions';

type Taak = { productId: string; naam: string; kleur: string };
type Uitkomst = Taak & { status: FhbResultaat['status']; fout?: string };

const REDEN: Record<FhbResultaat['status'], string> = {
  gekoppeld: 'Gekoppeld',
  'geen-code': 'Geen kleurcode in de kleurnaam',
  'geen-pagina': 'Kleur of artikel staat niet op fhb.de',
  'geen-foto': 'Geen voorkant-foto op de FHB-pagina',
  fout: 'Fout',
};

const TEGELIJK = 3;

/** Haalt voor alle FHB-kleuren zonder foto de voorkant-foto op bij fhb.de. */
export default function FhbOphalen() {
  const [taken, setTaken] = useState<Taak[] | null>(null);
  const [bezig, setBezig] = useState(false);
  const [uitkomsten, setUitkomsten] = useState<Uitkomst[]>([]);
  const stop = useRef(false);

  const laad = async () => {
    const artikelen: KoppelArtikel[] = await koppelArtikelenActie();
    setTaken(
      artikelen
        .filter((a) => /^fhb$/i.test((a.merk ?? '').trim()))
        .flatMap((a) => a.kleuren.filter((k) => !k.heeftFoto).map((k) => ({ productId: a.id, naam: a.naam, kleur: k.kleur }))),
    );
  };
  useEffect(() => {
    laad();
  }, []);

  const start = async () => {
    if (!taken?.length) return;
    stop.current = false;
    setBezig(true);
    setUitkomsten([]);
    const rij = [...taken];
    const werker = async () => {
      while (rij.length && !stop.current) {
        const t = rij.shift()!;
        let r: FhbResultaat;
        try {
          r = await haalFhbKleurfotoActie(t.productId, t.kleur);
        } catch {
          r = { ok: false, status: 'fout', fout: 'Verbinding verbroken.' };
        }
        setUitkomsten((u) => [...u, { ...t, status: r.status, fout: r.fout }]);
      }
    };
    await Promise.all(Array.from({ length: TEGELIJK }, werker));
    setBezig(false);
    await laad();
  };

  const gekoppeld = uitkomsten.filter((u) => u.status === 'gekoppeld').length;
  const missers = uitkomsten.filter((u) => u.status !== 'gekoppeld');
  const totaal = bezig ? (taken?.length ?? 0) : uitkomsten.length;

  return (
    <section className="mt-6 rounded-xl border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-ink-900">Automatisch ophalen bij FHB</h2>
          <p className="mt-1 max-w-2xl text-sm text-warm">
            Haalt per kleur de voorkant-foto van fhb.de en koppelt hem. Alleen kleuren zonder eigen foto; bestaande foto&apos;s blijven staan.
          </p>
          <p className="mt-2 text-sm font-semibold text-ink-900">
            {taken === null ? 'Kleuren tellen…' : `${taken.length} FHB-kleuren zonder foto`}
          </p>
        </div>
        {bezig ? (
          <button type="button" className="knop-stil" onClick={() => (stop.current = true)}>
            Stoppen
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={!taken?.length} onClick={start}>
            Ophalen bij FHB
          </button>
        )}
      </div>

      {uitkomsten.length > 0 && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-mist">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${totaal ? Math.round((uitkomsten.length / totaal) * 100) : 0}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-800">
            {uitkomsten.length} verwerkt · {gekoppeld} gekoppeld · {missers.length} niet gevonden
            {bezig ? '' : ' · klaar'}
          </p>
          {!bezig && missers.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink-900">
                Niet gevonden ({missers.length}): koppel deze hieronder met de hand
              </summary>
              <ul className="mt-2 max-h-72 divide-y divide-line overflow-auto rounded-lg border border-line text-sm">
                {missers.map((m) => (
                  <li key={`${m.productId}|${m.kleur}`} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                    <span className="min-w-0 font-medium text-ink-900">
                      {m.naam} · {m.kleur}
                    </span>
                    <span className="text-warm">{m.fout ?? REDEN[m.status]}</span>
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
