'use client';

import { useState } from 'react';
import { stuurTestmail } from './actions';

/** Testmail naar een in te vullen adres, met de melding direct eronder. */
export default function Testmail({ id, standaard, uit = false }: { id: string; standaard: string; uit?: boolean }) {
  const [adres, setAdres] = useState(standaard);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);

  async function verstuur(e: React.FormEvent) {
    e.preventDefault();
    setBezig(true);
    setMelding(null);
    try {
      const uitkomst = await stuurTestmail(id, adres);
      setMelding({ ok: uitkomst.ok, tekst: uitkomst.melding });
    } catch {
      setMelding({ ok: false, tekst: 'De testmail is niet verstuurd. Probeer het nog een keer.' });
    } finally {
      setBezig(false);
    }
  }

  return (
    <form onSubmit={verstuur}>
      <label className="veld-label" htmlFor="testmail-adres">
        Stuur een testmail naar
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="testmail-adres"
          type="email"
          required
          value={adres}
          onChange={(e) => setAdres(e.target.value)}
          className="veld min-w-[260px] flex-1 text-[15px]"
          disabled={uit}
        />
        <button type="submit" className="knop-stil" disabled={bezig || uit}>
          {bezig ? 'Bezig met versturen...' : 'Verstuur testmail'}
        </button>
      </div>
      <p className="veld-hint">
        De testmail ziet er precies zo uit als de echte, met [Test] voor het onderwerp. Sla wijzigingen in het ontwerp eerst op.
      </p>
      {melding && (
        <p
          role="status"
          className={`mt-2 rounded-lg border px-3 py-2 text-[13px] font-semibold ${
            melding.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {melding.tekst}
        </p>
      )}
    </form>
  );
}
