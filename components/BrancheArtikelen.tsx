import Link from 'next/link';
import { ProductKaart } from '@/components/ProductKaart';
import { brancheArtikelen } from '@/lib/brancheAssortiment';
import { naarKaart } from '@/lib/kms/catalogus';

/**
 * Artikelen uit de echte catalogus voor een branche (zie lib/brancheAssortiment.ts).
 * Server component: de pagina die hem gebruikt draait op ISR, dus dit is één
 * catalogusquery per revalidatie. Zonder artikelen (catalogus onbereikbaar)
 * rendert hij niets, zodat er nooit een leeg raster staat.
 */
export async function BrancheArtikelen({
  brancheSlug,
  titel,
  intro,
  max = 8,
}: {
  brancheSlug: string;
  titel: string;
  intro?: string;
  max?: number;
}) {
  const producten = await brancheArtikelen(brancheSlug, max);
  if (producten.length === 0) return null;
  return (
    <section className="container-x py-14 sm:py-16" aria-labelledby={`artikelen-${brancheSlug}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="eyebrow">Uit het assortiment</p>
          <h2 id={`artikelen-${brancheSlug}`} className="kop-2 mt-3">{titel}</h2>
          {intro && <p className="mt-3 text-warm">{intro}</p>}
        </div>
        <Link href="/assortiment" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-amber-700 hover:underline">
          Hele assortiment bekijken <span aria-hidden="true" className="ml-1">&rarr;</span>
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {producten.map((p) => (
          <ProductKaart key={p.id} p={naarKaart(p)} />
        ))}
      </div>
      <p className="mt-5 text-sm text-warm">
        Geen prijzen online: die hangen af van aantallen en logowerk. Zet artikelen in je offerte met de knop
        &lsquo;+ Offerte&rsquo; op de kaart, of laat ons een voorstel maken.
      </p>
    </section>
  );
}
