import Link from 'next/link';
import Image from 'next/image';
import { homeBranches, type Branche } from '@/content/branches';

/** Branchetegel: gelijke afmetingen, foto met de naam eronder. */
export function BrancheTegel({ b }: { b: Branche }) {
  return (
    <Link href={`/branches/${b.slug}`}
      className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl bg-ink-900 shadow-card transition hover:-translate-y-1 sm:rounded-2xl">
      <div className={`relative aspect-[4/3] overflow-hidden ${b.fit === 'contain' ? 'bg-ink-900' : 'bg-mist'}`}>
        <Image src={b.image} alt={b.navLabel} fill sizes="(max-width: 640px) 46vw, (max-width: 1024px) 45vw, 32vw"
          className={b.fit === 'contain' ? 'object-contain p-2' : 'object-cover transition duration-500 group-hover:scale-105'} />
      </div>
      <div className="flex grow items-center justify-between gap-2 p-3 sm:gap-3 sm:p-4">
        <h3 className="min-w-0 font-display text-[15px] font-extrabold leading-tight text-white [overflow-wrap:anywhere] sm:text-lg">{b.navLabel}</h3>
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition group-hover:bg-amber-500 group-hover:text-ink-900 sm:flex" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h12M11 5l5 5-5 5" /></svg>
        </span>
      </div>
    </Link>
  );
}

/** Homepage: zes branches in twee rijen van drie, met een knop naar het overzicht. */
export function BrancheGrid() {
  return (
    <section id="branches" className="scroll-mt-20 border-y border-line bg-mist">
      <div className="container-x sec-md">
        <div className="max-w-2xl">
          <h2 className="kop-2">Bedrijfskleding voor iedere branche</h2>
          <p className="mt-3 max-w-[60ch] text-lg text-warm">
            Van bouw en techniek tot horeca en sport. Wij helpen je de juiste kleding te vinden die past bij
            jouw werkzaamheden én de uitstraling van je bedrijf.
          </p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {homeBranches.map((b) => <BrancheTegel key={b.slug} b={b} />)}
        </div>
        <div className="mt-6 text-center">
          <Link href="/branches" className="btn-outline bg-white">Bekijk alle branches</Link>
        </div>
      </div>
    </section>
  );
}
