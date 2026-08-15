import { site } from '@/content/site';

/** Smalle vertrouwensstrook. Plaatst bewijs dicht bij de actie (CRO). */
export function TrustStrip() {
  const punten = [
    `${site.rating.value.toFixed(1)} uit 5 sterren`,
    'Passen op locatie',
    'Eigen bedrukkerij',
    'Gratis online kledingbeheer',
    'Binnen 24 uur reactie',
  ];
  return (
    <section className="bg-ink-900 text-white">
      <div className="container-x flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-4 text-sm font-semibold">
        {punten.map((p) => (
          <span key={p} className="inline-flex items-center gap-2">
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-amber-500" fill="currentColor" aria-hidden="true"><path d="M8 13.5l-3.5-3.5 1.4-1.4L8 10.7l5.1-5.1 1.4 1.4z" /></svg>
            {p}
          </span>
        ))}
      </div>
    </section>
  );
}
