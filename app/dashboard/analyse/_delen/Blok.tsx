import Link from 'next/link';

/**
 * Eén blok op de analysepagina: kop, één zin uitleg (wat zie je, waar komt het
 * vandaan) en rechtsboven de link naar de lijst of het rapport erachter.
 */
export default function Blok({
  titel,
  uitleg,
  link,
  children,
  className = '',
}: {
  titel: string;
  uitleg?: React.ReactNode;
  link?: { href: string; label: string } | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel flex min-w-0 flex-col p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-ink-900">{titel}</h2>
          {uitleg && <p className="mt-0.5 text-[12px] leading-snug text-warm">{uitleg}</p>}
        </div>
        {link && (
          <Link href={link.href} className="knop-tekst -mr-2 shrink-0">
            {link.label} <span aria-hidden>&rarr;</span>
          </Link>
        )}
      </div>
      <div className="mt-3 flex-1">{children}</div>
    </section>
  );
}
