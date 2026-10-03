'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

/**
 * Bedrijfsnaam met een waarschuwing als er al een klant met (bijna) dezelfde
 * naam bestaat, zodat er geen dubbele klant ontstaat. Blokkeert niets: soms
 * zijn er echt twee vestigingen met dezelfde naam.
 */
export default function BedrijfsnaamVeld({
  standaard,
  bestaande,
  eigenId,
}: {
  standaard: string;
  bestaande: { id: string; naam: string }[];
  eigenId?: string;
}) {
  const [naam, setNaam] = useState(standaard);
  const schoon = (s: string) => s.toLowerCase().replace(/\b(b\.?v\.?|v\.?o\.?f\.?|holding)\b/g, '').replace(/[^a-z0-9]/g, '');
  const gelijk = useMemo(() => {
    const n = schoon(naam);
    if (n.length < 3) return [];
    return bestaande.filter((b) => b.id !== eigenId && schoon(b.naam) === n).slice(0, 3);
  }, [naam, bestaande, eigenId]);

  return (
    <div>
      <label className="veld-label" htmlFor="w-naam">Bedrijfsnaam</label>
      <input
        id="w-naam"
        name="naam"
        required
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
        placeholder="Bijv. Jansen Installatietechniek"
        autoFocus={!standaard}
        autoComplete="off"
        className="veld"
      />
      {gelijk.length > 0 && (
        <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Er bestaat al een klant met deze naam:{' '}
          {gelijk.map((g, i) => (
            <span key={g.id}>
              {i > 0 && ', '}
              <Link href={`/dashboard/klanten/${g.id}`} className="font-semibold underline">
                {g.naam}
              </Link>
            </span>
          ))}
          . Is het dezelfde, open dan die klant in plaats van een nieuwe te maken.
        </p>
      )}
    </div>
  );
}
