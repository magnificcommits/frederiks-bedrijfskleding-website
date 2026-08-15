'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

/**
 * Sorteerbare kolomkop voor dashboardtabellen. Klikken zet ?sort=<col>&dir=asc|desc in de URL
 * en behoudt alle bestaande filters (status, zoek, enz.). De paginering wordt gereset.
 * De pagina leest sort/dir uit searchParams en geeft ze door aan de ...Paged-helper.
 */
export default function SortableTh({
  label,
  col,
  className = '',
}: {
  label: string;
  col: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const huidigeSort = sp.get('sort');
  const huidigeDir = sp.get('dir') === 'asc' ? 'asc' : 'desc';
  const actief = huidigeSort === col;
  const nieuweDir = actief && huidigeDir === 'asc' ? 'desc' : 'asc';

  function sorteer() {
    const params = new URLSearchParams(sp.toString());
    params.set('sort', col);
    params.set('dir', nieuweDir);
    params.delete('pagina');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <th className={className}>
      <button
        type="button"
        onClick={sorteer}
        className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-ink-900"
        aria-label={`Sorteer op ${label}`}
      >
        {label}
        <span aria-hidden="true" className={`text-[10px] ${actief ? 'text-amber-600' : 'text-ink-300'}`}>
          {actief ? (huidigeDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}
