'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

type Optie = { value: string; label: string };

/**
 * Keuzelijsten die meteen filteren. Elke keuze werkt de URL bij en laat de
 * overige filters, de weergave en de sortering staan.
 */
export default function LeadFilters({
  bronnen,
  branches,
  personen,
  mijnPersoon,
}: {
  bronnen: Optie[];
  branches: Optie[];
  personen: Optie[];
  mijnPersoon: string | null;
}) {
  const router = useRouter();
  const pad = usePathname();
  const sp = useSearchParams();
  const [bezig, start] = useTransition();

  function zet(sleutel: string, waarde: string) {
    const p = new URLSearchParams(sp.toString());
    p.delete('ok');
    p.delete('fout');
    if (waarde) p.set(sleutel, waarde);
    else p.delete(sleutel);
    start(() => router.replace(p.toString() ? `${pad}?${p}` : pad, { scroll: false }));
  }

  const kies = (sleutel: string, label: string, opties: Optie[], alle = 'Alle') => (
    <label className="flex flex-col">
      <span className="veld-label">{label}</span>
      <select
        value={sp.get(sleutel) ?? ''}
        onChange={(e) => zet(sleutel, e.target.value)}
        className={`veld w-auto min-w-[8rem] max-w-[13rem] py-1 ${sp.get(sleutel) ? 'border-ink-700' : ''}`}
      >
        <option value="">{alle}</option>
        {opties.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );

  const vandaagAan = sp.get('vandaag') === '1';

  return (
    <div className={`flex flex-wrap items-end gap-3 transition-opacity ${bezig ? 'opacity-70' : ''}`} aria-busy={bezig || undefined}>
      {kies('periode', 'Binnengekomen', [
        { value: '7d', label: 'Afgelopen 7 dagen' },
        { value: '30d', label: 'Afgelopen 30 dagen' },
        { value: 'maand', label: 'Deze maand' },
        { value: '90d', label: 'Afgelopen 3 maanden' },
        { value: 'jaar', label: 'Dit jaar' },
      ], 'Altijd')}
      {kies('bron', 'Herkomst', bronnen)}
      {kies('branche', 'Branche', branches)}
      {personen.length > 0 && kies('eigenaar', 'Eigenaar', [...personen, { value: 'geen', label: 'Nog niemand' }], 'Iedereen')}
      {kies('score', 'Score', [
        { value: '65', label: '65 of hoger' },
        { value: '40', label: '40 of hoger' },
        { value: 'laag', label: 'Onder 40' },
      ])}
      <button
        type="button"
        aria-pressed={vandaagAan}
        onClick={() => zet('vandaag', vandaagAan ? '' : '1')}
        className={`chip h-[30px] ${vandaagAan ? 'chip-aan' : ''}`}
        title={mijnPersoon ? 'Leads waarvan jij eigenaar bent met een opvolgdatum van vandaag of eerder' : 'Leads met een opvolgdatum van vandaag of eerder'}
      >
        {mijnPersoon ? 'Mijn opvolgingen vandaag' : 'Opvolgingen vandaag'}
      </button>
    </div>
  );
}
