import Link from 'next/link';

function initialen(naam: string): string {
  const woorden = naam.trim().split(/\s+/).filter(Boolean);
  const letters = woorden.slice(0, 2).map((w) => w[0] ?? '').join('');
  return (letters || naam.slice(0, 2)).toUpperCase();
}

/**
 * Demo-balk plus de gebrande portaalkop (logo, naam, accentlijn), zoals in het echte portaal.
 * Servercomponent: geen interactie nodig.
 */
export default function DemoKop({
  bedrijfsnaam,
  logoUrl,
  kennismakingHref,
  pasdagHref,
}: {
  bedrijfsnaam: string;
  logoUrl: string | null;
  kennismakingHref: string;
  pasdagHref: string;
}) {
  return (
    <>
      <div className="bg-ink-900 text-white">
        <div className="container-x flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm leading-snug">
            <span className="mt-0.5 inline-flex shrink-0 items-center rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-900">
              Voorbeeld
            </span>
            <span>
              <strong className="font-semibold">Voorbeeldportaal voor {bedrijfsnaam}:</strong>{' '}
              <span className="text-ink-200">zo werkt het als jullie klant zijn bij Frederiks.</span>
            </span>
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href={kennismakingHref}
              className="inline-flex min-h-[40px] items-center rounded-md border border-white/30 px-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              <span aria-hidden="true" className="mr-1.5">&larr;</span>
              Terug naar jullie pagina
            </Link>
            <Link
              href={pasdagHref}
              className="inline-flex min-h-[40px] items-center rounded-md bg-amber-500 px-3 text-sm font-semibold text-ink-900 hover:bg-amber-400"
            >
              Plan een gratis pasdag
            </Link>
          </div>
        </div>
      </div>

      <header className="border-b border-line bg-white">
        <div className="container-x flex items-center justify-between gap-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              <span className="inline-flex shrink-0 items-center rounded-lg border border-line bg-white px-2 py-1 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={`Logo ${bedrijfsnaam}`} className="h-9 w-auto max-w-[140px] object-contain" />
              </span>
            ) : (
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--demo-accent)] font-display text-base font-extrabold text-[color:var(--demo-op-accent)]"
                aria-hidden="true"
              >
                {initialen(bedrijfsnaam)}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--demo-accent-tekst)]">Klantportaal</p>
              <p className="truncate font-display text-lg font-extrabold leading-tight text-ink-900">{bedrijfsnaam}</p>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-ink-700">Beheerder</span>
            <span className="text-xs text-warm">Portaal van Frederiks Bedrijfskleding</span>
          </div>
        </div>
        <div className="h-1 w-full bg-[var(--demo-accent)]" aria-hidden="true" />
      </header>
    </>
  );
}
