import Link from 'next/link';
import Image from 'next/image';
import type { PubliekProduct } from '@/lib/kms/catalogus';

/** Eén artikel in een overzicht. Geen prijs: die is voorbehouden aan ingelogde klanten. */
export function ProductKaart({ p }: { p: PubliekProduct }) {
  return (
    <Link
      href={`/assortiment/${p.categorieSlug}/${p.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white transition hover:border-amber-300 hover:shadow-card"
    >
      <div className="relative aspect-square bg-mist">
        {p.foto && (
          <Image
            src={p.foto}
            alt={p.naam}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-3 transition group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="flex grow flex-col p-4">
        {p.merk && <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">{p.merk}</p>}
        <p className="mt-1 font-semibold leading-snug text-ink-900">{p.naam}</p>
        <p className="mt-auto pt-3 text-xs text-warm">
          {[p.maten.length ? `${p.maten.length} maten` : null, p.kleuren.length ? `${p.kleuren.length} kleuren` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </Link>
  );
}
