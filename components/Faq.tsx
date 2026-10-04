import { site } from '@/content/site';

/**
 * Veelgestelde vragen over de volle breedte: links de kop met de directe lijn,
 * rechts de vragen. De eerste vraag staat open, zodat je ziet dat er antwoorden
 * achter zitten. <details> zonder JavaScript; zoekmachines lezen alles mee.
 */
export function Faq({ items, title = 'Veelgestelde vragen' }: { items: { q: string; a: string }[]; title?: string }) {
  if (!items.length) return null;
  return (
    <section className="border-t border-line bg-white">
      <div className="container-x sec-md grid gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <h2 className="kop-2">{title}</h2>
          <div className="mt-6 rounded-xl bg-mist p-5" data-plek="faq">
            <p className="font-semibold text-ink-900">Staat je vraag er niet bij?</p>
            <p className="mt-1 text-sm text-warm">Bel of app {site.owner.split(' ')[0]}. Meestal weet je het binnen vijf minuten.</p>
            <a href={`tel:${site.phoneIntl}`} className="mt-3 inline-flex min-h-[44px] items-center font-display text-xl font-extrabold text-ink-900 underline decoration-amber-500 decoration-2 underline-offset-4 hover:text-amber-800" data-cta="telefoon">
              {site.phone}
            </a>
          </div>
        </div>
        <div className="divide-y divide-line border-y border-line">
          {items.map((f, i) => (
            <details key={f.q} open={i === 0} className="group">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-[1.0625rem] font-bold text-ink-900 hover:text-amber-800 [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink-200 text-ink-900 transition group-open:rotate-45 group-open:border-amber-500 group-open:bg-amber-500" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 2v10M2 7h10" /></svg>
                </span>
              </summary>
              <p className="max-w-[70ch] pb-5 leading-relaxed text-warm">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
