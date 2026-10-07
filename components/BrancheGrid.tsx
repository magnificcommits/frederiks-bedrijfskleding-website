import Link from 'next/link';
import Image from 'next/image';
import { hoofdBranches as branches } from '@/content/branches';

export function BrancheGrid() {
  return (
    <section id="branches" className="scroll-mt-20 border-y border-line bg-mist">
      <div className="container-x sec-md">
        <div className="max-w-2xl">
          <h2 className="kop-2">Kleding afgestemd op jouw sector</h2>
          <p className="mt-3 max-w-[52ch] text-lg text-warm">We kleden elke sector. Samen kiezen we een pakket dat past bij het werk en bij je uitstraling.</p>
        </div>
        {/* Telefoon: twee kolommen met een lagere foto. Eén kolom met grote foto's was bijna drie schermen lang. */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {branches.map((b) => (
            <Link key={b.slug} href={`/branches/${b.slug}`}
              className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl bg-ink-900 shadow-card transition hover:-translate-y-1 sm:rounded-2xl">
              <div className={`relative aspect-square overflow-hidden sm:aspect-[4/3] ${b.fit === 'contain' ? 'bg-ink-900' : 'bg-mist'}`}>
                <Image src={b.image} alt={b.name} fill sizes="(max-width: 640px) 46vw, (max-width: 1024px) 45vw, 24vw"
                  className={b.fit === 'contain' ? 'object-contain p-2' : 'object-cover transition duration-500 group-hover:scale-105'} />
              </div>
              <div className="flex grow items-center justify-between gap-2 p-3 sm:gap-3 sm:p-4">
                <h3 className="min-w-0 font-display text-[15px] font-extrabold leading-tight text-white [overflow-wrap:anywhere] sm:text-lg">{b.navLabel}</h3>
                <span className="hidden h-9 w-9 shrink-0 sm:flex items-center justify-center rounded-full bg-white/10 text-white transition group-hover:bg-amber-500 group-hover:text-ink-900" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h12M11 5l5 5-5 5" /></svg>
                </span>
              </div>
            </Link>
          ))}
          {/* Conversie-tegel: vult het grid en vangt overige branches af */}
          <Link href="/kledingadvies"
            className="group col-span-2 flex flex-col justify-between rounded-2xl border-2 border-dashed border-amber-500 bg-amber-50 p-5 transition hover:-translate-y-1 hover:shadow-card sm:col-span-1 sm:p-6">
            <div>
              <h3 className="font-display text-xl font-extrabold text-ink-900">Staat jouw branche er niet bij?</h3>
              <p className="mt-2 text-sm text-ink-800">We kleden elke sector. Vertel wat je zoekt, dan denken we mee.</p>
            </div>
            <span className="btn-secondary mt-4 self-start sm:mt-6">Vraag gratis kledingadvies</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
