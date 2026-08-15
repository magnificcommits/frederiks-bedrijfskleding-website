import Link from 'next/link';
import { alleMerken } from '@/lib/kms/catalogus';
import { extraMerken } from '@/content/merken';

/**
 * Merkenrij.
 *
 * Drie dingen bewust zo:
 *
 *  1. **Alle merken uit het systeem**, niet alleen de merken waarvan artikelen de
 *     publicatiedrempel halen. FHB, Tricorp en Xirtrum verkoopt Jessi gewoon; die
 *     staan alleen nog zonder foto in het systeem. Ze weglaten uit de merkenrij
 *     zou de belangrijkste namen uit de branche verzwijgen.
 *  2. **Alles als woordmerk, geen mix van logo's en tekst.** We hebben maar van
 *     twee merken een logobestand. Twee logo's tussen dertien namen leest als een
 *     fout; dertien namen in dezelfde letter leest als een keuze. Komen er logo's
 *     van alle merken, dan zetten we het in één keer om.
 *  3. **Alleen doorklikken waar er iets te zien is.** Een merk zonder artikelen op
 *     de site wordt geen link, anders klik je naar een lege pagina.
 */
export async function BrandStrip() {
  const uitKms = await alleMerken();
  const merken = [
    ...uitKms,
    // Merken die Jessi levert maar die nog niet geïmporteerd zijn; zonder doorklik.
    ...extraMerken.map((naam) => ({ naam, slug: naam.toLowerCase().replace(/[^a-z0-9]+/g, '-'), aantal: 0, opDeSite: false })),
  ];
  if (!merken.length) return null;

  const naam = 'font-display text-base font-bold tracking-tight sm:text-lg';

  return (
    <section className="border-y border-line bg-mist">
      <div className="container-x sec-sm">
        <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-warm">
          Wij werken met deze merken
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {merken.map((m) => (
            <li key={m.slug}>
              {m.opDeSite ? (
                <Link href={`/merk/${m.slug}`} className={`${naam} text-ink-700 transition hover:text-amber-700`}>
                  {m.naam}
                </Link>
              ) : (
                <span className={`${naam} text-ink-400`}>{m.naam}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-center text-xs text-warm">
          Klik op een merk om de collectie te zien. Van de merken zonder link leveren we op bestelling — vraag er
          gerust naar.
        </p>
      </div>
    </section>
  );
}
