import Link from 'next/link';
import { merkLogos } from '@/content/merken';
import { catalogusOverzicht } from '@/lib/kms/catalogus';

/**
 * Merkenrij.
 *
 * Twee dingen anders dan eerst. De merken komen nu uit de catalogus in plaats van
 * uit een handmatige lijst: er stonden drie merken in de rij waarvan geen enkel
 * artikel op de site te vinden was, en dat merkt een inkoper die erop klikt.
 *
 * En het is een flexrij in plaats van een raster van zeven. Met acht logo's gaf
 * dat 7 + 1: één eenzaam logo op een rij van zeven met zes lege kaders ernaast.
 * Grijs met een hoogtelimiet, zodat de logo's niet met de oranje knop concurreren.
 */
export async function BrandStrip() {
  const { merken } = await catalogusOverzicht();
  if (!merken.length) return null;

  return (
    <section className="border-y border-line bg-mist">
      <div className="container-x sec-sm">
        <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-warm">
          Wij werken met deze merken
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {merken.map((m) => {
            const logo = merkLogos[m.slug];
            return (
              <Link
                key={m.slug}
                href={`/merk/${m.slug}`}
                className="opacity-70 transition hover:opacity-100"
                title={`${m.naam} — ${m.aantal} artikelen`}
              >
                {logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logo}
                    alt={`${m.naam} logo`}
                    loading="lazy"
                    className="h-8 w-auto max-w-[9rem] object-contain grayscale transition hover:grayscale-0 sm:h-9"
                  />
                ) : (
                  <span className="font-display text-lg font-extrabold tracking-tight text-ink-700 sm:text-xl">
                    {m.naam}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
