import Link from 'next/link';
import { AfspraakKiezer } from '@/components/AfspraakKiezer';
import type { AfspraakSoort } from '@/lib/afspraken/soorten';

/**
 * Blok met de AfspraakKiezer voor branche-, regio- en contactpagina's.
 * De kiezer haalt zijn tijden pas in de browser op, dus statische pagina's blijven statisch.
 */
export function AfspraakSectie({
  titel = 'Liever eerst even praten of passen?',
  intro = 'Plan zelf een moment met Jessi. Een kort belgesprek, een bezoek aan de showroom in Hengelo of een pasdag bij jou op het bedrijf.',
  bron,
  defaultBranche,
  standaardSoort,
}: {
  titel?: string;
  intro?: string;
  bron: string;
  defaultBranche?: string;
  standaardSoort?: AfspraakSoort;
}) {
  return (
    <section className="border-t border-line bg-white" id="afspraak">
      <div className="container-x sec-md">
        <div>
          <h2 className="kop-2">{titel}</h2>
          <p className="mt-3 max-w-[60ch] text-warm">
            {intro}{' '}
            <Link href="/afspraak" className="text-amber-700 underline underline-offset-2 hover:text-amber-800">
              Meer over de afspraken
            </Link>
          </p>
          <div className="mt-6">
            <AfspraakKiezer bron={bron} defaultBranche={defaultBranche} standaardSoort={standaardSoort} />
          </div>
        </div>
      </div>
    </section>
  );
}
