import Image from 'next/image';
import type { PubliekProduct } from '@/lib/kms/catalogus';

/**
 * Mozaïek van echte productfoto's, als beeld in een paginakop.
 *
 * Dit is het enige "fotomateriaal" dat we al hebben — 414 leveranciersfoto's op
 * transparante of witte achtergrond. Los zijn ze saai; in een raster met
 * verspringende breedtes worden ze een beeld. Geen fotograaf nodig, en het toont
 * meteen wát je verkoopt.
 *
 * Belangrijk voor de kop: vanaf lg staat dit mozaïek in een absoluut
 * gepositioneerde rechterhelft die precies zo hoog is als de kop zelf. Daarom
 * géén vaste tegelhoogtes op lg — twee rijen van elk 1fr, en `h-full` op het
 * raster. Zo kan het beeld nooit boven de kop uit kruipen (onder de sticky
 * header) of eronder over de volgende sectie heen vallen. Op mobiel staat het
 * gewoon in de flow en gelden er wél vaste hoogtes.
 *
 * Puur decoratief, dus `aria-hidden`: de artikelen staan verderop op de pagina
 * gewoon als doorklikbare kaarten.
 */
export function ProductMozaiek({ producten }: { producten: PubliekProduct[] }) {
  const beelden = producten.filter((p) => p.foto).slice(0, 4);
  if (beelden.length < 3) return null;

  // Vier tegels vullen twee rijen exact; bij drie loopt de onderste door.
  const spans =
    beelden.length >= 4
      ? ['col-span-2', 'col-span-1', 'col-span-1', 'col-span-2']
      : ['col-span-2', 'col-span-1', 'col-span-3'];

  return (
    <div
      aria-hidden="true"
      className="mx-auto grid w-full max-w-xl grid-cols-3 gap-3 lg:mx-0 lg:max-w-none lg:grid-rows-2"
    >
      {beelden.map((p, i) => (
        <div
          key={p.id}
          className={`relative h-32 overflow-hidden rounded-xl border border-line bg-white sm:h-40 lg:h-44 xl:h-52 ${spans[i] ?? 'col-span-1'}`}
        >
          <Image
            src={p.foto as string}
            alt=""
            fill
            sizes="(max-width: 1024px) 33vw, 320px"
            className="object-contain p-3"
          />
        </div>
      ))}
    </div>
  );
}
