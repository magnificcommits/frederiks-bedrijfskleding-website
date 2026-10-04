'use client';

import { useEffect, useState } from 'react';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import { markeerGeprintActie } from '../actions';

/**
 * Printknop van een verzending. Na het printvenster vragen we of alles goed uit
 * de printer kwam; dan gaan deze brieven op 'geprint'.
 */
export default function PrintBalk({ batchId, ids, vandaag, alGeprint }: { batchId: string; ids: string[]; vandaag: string; alGeprint: string | null }) {
  const [klaar, setKlaar] = useState(false);
  useEffect(() => {
    const na = () => setKlaar(true);
    window.addEventListener('afterprint', na);
    return () => window.removeEventListener('afterprint', na);
  }, []);
  const n = ids.length;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => window.print()} disabled={n === 0} className="knop-primair disabled:opacity-50">
        Afdrukken ({n} {n === 1 ? 'brief' : 'brieven'})
      </button>
      <form action={markeerGeprintActie} className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1 ${klaar ? 'bg-amber-50 ring-1 ring-amber-300' : ''}`}>
        <input type="hidden" name="batch" value={batchId} />
        {ids.map((id) => <input key={id} type="hidden" name="id" value={id} />)}
        {klaar && <span className="text-[13px] font-semibold text-ink-900">Goed uit de printer gekomen?</span>}
        <label className="flex items-center gap-1.5 text-[13px] text-ink-800">
          Geprint op
          <input type="date" name="datum" defaultValue={vandaag} max={vandaag} className="veld w-auto py-1 text-[13px]" />
        </label>
        <VerzendKnop className={klaar ? 'knop-donker' : 'knop-stil'} disabled={n === 0} bezigTekst="Opslaan…">
          Markeer als geprint
        </VerzendKnop>
      </form>
      {alGeprint && <span className="text-[12px] text-warm">Eerder geprint op {new Date(`${alGeprint}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}.</span>}
    </div>
  );
}
