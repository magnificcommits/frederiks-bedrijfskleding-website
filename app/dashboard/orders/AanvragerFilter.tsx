'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { AanvragerOptie } from '@/lib/kms/personen';

/**
 * Filter "Aangevraagd door" op de orderlijst. Houdt zoekterm, status en
 * sortering vast; alleen de paginering gaat terug naar het begin.
 */
export default function AanvragerFilter({ opties, waarde }: { opties: AanvragerOptie[]; waarde: string }) {
  const router = useRouter();
  const pad = usePathname();
  const params = useSearchParams();

  if (opties.length === 0 && !waarde) return null;
  const bekend = opties.some((o) => o.waarde === waarde);

  return (
    <label className="flex items-center gap-2 text-[13px] text-warm">
      <span className="whitespace-nowrap">Aangevraagd door</span>
      <select
        value={waarde}
        onChange={(e) => {
          const p = new URLSearchParams(params.toString());
          if (e.target.value) p.set('aanvrager', e.target.value);
          else p.delete('aanvrager');
          p.delete('pagina');
          const qs = p.toString();
          router.push(qs ? `${pad}?${qs}` : pad);
        }}
        className="veld w-64"
      >
        <option value="">Iedereen</option>
        {waarde && !bekend && <option value={waarde}>Gekozen persoon</option>}
        {opties.map((o) => (
          <option key={o.waarde} value={o.waarde}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
