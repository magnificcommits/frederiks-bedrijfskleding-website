'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Filter-keuzelijst die één URL-parameter zet en de andere filters laat staan
 * (zoekterm, status, tab). Een open detailpaneel en meldingen gaan dicht: die
 * horen niet meer bij de nieuwe lijst.
 */
export default function UrlKeuze({
  param,
  waarde,
  opties,
  leegLabel,
  label,
}: {
  param: string;
  waarde: string;
  opties: { value: string; label: string }[];
  leegLabel: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [bezig, start] = useTransition();
  return (
    <label className="flex min-w-0 flex-col">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={waarde}
        disabled={bezig}
        onChange={(e) => {
          const p = new URLSearchParams(sp.toString());
          if (e.target.value) p.set(param, e.target.value);
          else p.delete(param);
          for (const k of ['id', 'melding', 'ok', 'fout']) p.delete(k);
          const qs = p.toString();
          start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
        }}
        className={`veld w-auto max-w-[14rem] pr-8 ${waarde ? 'border-ink-900 font-semibold' : ''}`}
      >
        <option value="">{leegLabel}</option>
        {opties.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
