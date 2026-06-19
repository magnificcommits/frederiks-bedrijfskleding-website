import Link from 'next/link';
import Image from 'next/image';
import { branches } from '@/content/branches';

export function BrancheGrid() {
  return (
    <section className="border-y border-line bg-mist">
      <div className="container-x py-16 sm:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">Voor elke branche</p>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Kleding afgestemd op jouw sector</h2>
          <p className="mt-3 text-lg text-warm">We kleden elke sector. Samen kiezen we een pakket dat past bij het werk en bij je uitstraling.</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {branches.map((b) => (
            <Link key={b.slug} href={`/branches/${b.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-card transition hover:-translate-y-1 hover:border-amber-400">
              <div className={`relative aspect-[4/3] overflow-hidden ${b.fit === 'contain' ? 'bg-ink-900' : 'bg-mist'}`}>
                <Image src={b.image} alt={b.name} fill sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 24vw"
                  className={b.fit === 'contain' ? 'object-contain p-2' : 'object-cover transition duration-500 group-hover:scale-105'} />
              </div>
              <div className="flex grow flex-col p-5">
                <h3 className="text-lg font-bold text-ink-900 group-hover:text-amber-600">{b.navLabel}</h3>
                <p className="mt-2 grow text-sm text-warm line-clamp-2">{b.heroIntro}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wide text-amber-600">
                  Bekijk <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          ))}
          {/* Conversie-tegel: vult het grid en vangt overige branches af */}
          <Link href="/kledingadvies"
            className="group flex flex-col justify-between rounded-xl bg-ink-900 p-6 text-white shadow-card transition hover:-translate-y-1">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-400">Maatwerk</p>
              <h3 className="mt-3 text-xl font-extrabold text-white">Staat jouw branche er niet bij?</h3>
              <p className="mt-2 text-sm text-ink-200">We kleden elke sector. Vertel ons wat je zoekt. We denken mee.</p>
            </div>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-400">
              Gratis kledingadvies <span aria-hidden="true">→</span>
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
