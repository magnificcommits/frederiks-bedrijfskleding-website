'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Filterkeuze die één URL-parameter zet en de rest laat staan (zoekterm,
 * sortering, andere filters). De paginering gaat terug naar 1, meldingen
 * verdwijnen. Gebruikt door voorraad en inkoop.
 */
function useZetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [bezig, start] = useTransition();
  function zet(param: string, waarde: string) {
    const p = new URLSearchParams(sp.toString());
    if (waarde) p.set(param, waarde);
    else p.delete(param);
    for (const k of ['pagina', 'ok', 'melding', 'aantal', 'fout', 'geteld', 'gewijzigd', 'mislukt']) p.delete(k);
    const qs = p.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  return { zet, bezig, huidig: (param: string) => sp.get(param) ?? '' };
}

export function UrlSelect({
  param,
  label,
  opties,
  leegLabel,
  breedte = 'w-44',
}: {
  param: string;
  label: string;
  opties: { value: string; label: string }[];
  leegLabel: string;
  breedte?: string;
}) {
  const { zet, bezig, huidig } = useZetParam();
  const waarde = huidig(param);
  return (
    <label className={`flex flex-col ${breedte}`}>
      <span className="veld-label">{label}</span>
      <select
        value={waarde}
        onChange={(e) => zet(param, e.target.value)}
        aria-busy={bezig || undefined}
        className={`veld ${waarde ? 'border-ink-400 font-semibold' : ''}`}
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

/** Segmentknop: een paar vaste keuzes naast elkaar, de actieve donker. */
export function UrlSegment({
  param,
  label,
  opties,
  standaard,
}: {
  param: string;
  label: string;
  opties: { value: string; label: string }[];
  /** Waarde die geldt als de parameter ontbreekt; die laten we dan ook weg uit de URL. */
  standaard: string;
}) {
  const { zet, huidig } = useZetParam();
  const waarde = huidig(param) || standaard;
  return (
    <div className="flex flex-col">
      <span className="veld-label">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-mist p-0.5">
        {opties.map((o) => {
          const aan = o.value === waarde;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={aan}
              onClick={() => zet(param, o.value === standaard ? '' : o.value)}
              className={`whitespace-nowrap rounded px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                aan ? 'bg-white text-ink-900 shadow-sm' : 'text-warm hover:text-ink-900'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function UrlVinkje({ param, label }: { param: string; label: string }) {
  const { zet, huidig } = useZetParam();
  const aan = huidig(param) === '1';
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 self-end rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px] font-medium text-ink-700 hover:bg-mist">
      <input type="checkbox" checked={aan} onChange={(e) => zet(param, e.target.checked ? '1' : '')} className="h-4 w-4 accent-ink-900" />
      {label}
    </label>
  );
}
