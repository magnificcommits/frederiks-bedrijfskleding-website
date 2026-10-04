import Link from 'next/link';
import Image from 'next/image';
import { Pijl } from '@/components/Pijl';

type Tile = { href: string; label: string; img: string };
const all: Tile[] = [
  { href: '/werkkleding', label: 'Werkkleding', img: '/Bedrijfskleding-Achterhoek.jpg' },
  { href: '/werkschoenen', label: 'Werkschoenen', img: '/veiligheidsschoenen-achterhoek-1.jpg' },
  { href: '/bedrukken-borduren', label: 'Bedrukken en borduren', img: '/Bedrijfskleding-bedrukken-en-borduren.jpg' },
  { href: '/werkkleding', label: 'Voor elke branche', img: '/Frederiks-bedrijfskleding-1.jpg' },
];

/** Doorverwijstegels met beeld. Sluit de huidige pagina uit met `exclude`. */
export function CrossLinks({ exclude = '', title = 'Bekijk ook' }: { exclude?: string; title?: string }) {
  const tiles = all.filter((t) => t.href !== exclude).slice(0, 3);
  return (
    <section className="container-x sec-md">
      <h2 className="kop-2">{title}</h2>
      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="group relative overflow-hidden rounded-2xl shadow-card transition hover:-translate-y-0.5">
            <div className="relative aspect-[4/3]">
              <Image src={t.img} alt={t.label} fill sizes="(max-width:1024px) 90vw, 30vw" className="object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 to-transparent" aria-hidden="true" />
            </div>
            <span className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 font-display text-lg font-extrabold text-white">{t.label}<Pijl licht /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
