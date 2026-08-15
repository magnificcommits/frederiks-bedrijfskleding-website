import Link from 'next/link';

/**
 * Consistente lege staat voor dashboardlijsten: één vormgeving overal, in plaats van
 * losse zinnetjes per pagina. Optioneel een titel en een actie-link.
 */
export default function EmptyState({
  titel,
  tekst,
  actieHref,
  actieLabel,
}: {
  titel?: string;
  tekst: string;
  actieHref?: string;
  actieLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-mist px-6 py-10 text-center">
      {titel && <p className="font-display text-base font-bold text-ink-900">{titel}</p>}
      <p className={`text-sm text-warm ${titel ? 'mt-1' : ''}`}>{tekst}</p>
      {actieHref && actieLabel && (
        <Link
          href={actieHref}
          className="mt-4 inline-block knop-donker"
        >
          {actieLabel}
        </Link>
      )}
    </div>
  );
}
