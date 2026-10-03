import Link from 'next/link';

/**
 * Compacte lege staat voor een blok op het overzicht. Geen kale nul, maar een
 * zin over wat hier komt te staan en de stap die het vult.
 */
export default function LegeStaat({
  titel,
  tekst,
  actieHref,
  actieLabel,
}: {
  titel: string;
  tekst: string;
  actieHref?: string;
  actieLabel?: string;
}) {
  return (
    <div className="flex h-full flex-col items-start justify-center rounded-md border border-dashed border-ink-200 bg-mist/60 px-4 py-5">
      <p className="text-[13px] font-semibold text-ink-900">{titel}</p>
      <p className="mt-1 max-w-md text-[13px] leading-snug text-warm">{tekst}</p>
      {actieHref && actieLabel && (
        <Link href={actieHref} className="knop-stil mt-3">
          {actieLabel}
        </Link>
      )}
    </div>
  );
}
