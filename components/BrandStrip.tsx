import { merken } from '@/content/merken';

/**
 * Merkenrij met echte logo's, gelijk formaat in witte kaders. De kaders
 * neutraliseren de verschillende achtergronden en formaten van de logo's.
 */
export function BrandStrip() {
  return (
    <section className="border-y border-line bg-mist">
      <div className="container-x py-12">
        <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-warm">
          Wij werken met gerenommeerde A-merken
        </p>
        <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {merken.map((m) => (
            <div key={m.name} className="flex h-24 items-center justify-center rounded-lg border border-line bg-white px-3 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.src} alt={`${m.name} logo`} loading="lazy" className="h-16 w-full object-contain" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
