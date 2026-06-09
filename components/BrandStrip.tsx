import { site } from '@/content/site';

export function BrandStrip() {
  return (
    <section className="border-y border-line bg-white">
      <div className="container-x py-10">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-warm">
          Wij werken met gerenommeerde merken
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {site.brands.map((b) => (
            <span key={b} className="text-base font-semibold text-ink-300">{b}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
