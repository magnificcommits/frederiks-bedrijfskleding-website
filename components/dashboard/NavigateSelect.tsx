'use client';

import { useRouter } from 'next/navigation';

type Optie = { value: string; label: string };

/**
 * Dropdown die meteen navigeert bij een keuze — geen aparte "Tonen"-knop nodig.
 * Navigeert naar `${basePath}?${param}=<waarde>` (of `basePath` bij lege keuze).
 */
export default function NavigateSelect({
  options,
  value,
  basePath,
  param,
  placeholder,
  className,
}: {
  options: Optie[];
  value?: string | null;
  basePath: string;
  param: string;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <select
      defaultValue={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v ? `${basePath}?${param}=${encodeURIComponent(v)}` : basePath);
      }}
      className={
        className ??
        'w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200'
      }
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
