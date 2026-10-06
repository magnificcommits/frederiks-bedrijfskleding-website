import Link from 'next/link';

/**
 * Paginakop voor alle subpagina's.
 *
 * Zelfde raster als de homepage-hero: één grid over de volle breedte met een
 * meeschalende linkermarge, en een optionele beeldhelft die in zijn eigen kolom
 * doorloopt tot de schermrand. Daardoor begint de h1 op elke pagina op dezelfde
 * plek als op de homepage.
 *
 * De tekstkolom is apart afgetopt op 36rem. Het kader is breed, de leesregel
 * niet: een kop of intro die over 800 px doorloopt is niet leesbaarder, alleen
 * langer.
 *
 * Bewust NIET overal een beeld: op een normpagina wil de bezoeker binnen twee
 * seconden zijn antwoord, niet eerst 400 pixels beeld wegscrollen. Laat `beeld`
 * daar gewoon leeg; dan blijft het een compacte kop.
 */
export function PageHero({
  eyebrow,
  title,
  intro,
  kruimels,
  beeld,
  donker = true,
  acties,
  punten,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  /** Kruimelpad, bijvoorbeeld [{ label: 'Assortiment', href: '/assortiment' }] */
  kruimels?: { label: string; href: string }[];
  /** Loopt vanaf lg door tot de rechter schermrand. Laat leeg voor een compacte kop. */
  beeld?: React.ReactNode;
  /** Standaard donker: één herkenbare kop op elke subpagina. Zet op false voor een lichte kop. */
  donker?: boolean;
  /**
   * Knoppen direct onder de intro, boven de vouw. Meestal <CtaKnoppen plek="..." />.
   * Laat leeg op pagina's waar het formulier zelf al bovenaan staat.
   */
  acties?: React.ReactNode;
  /** Drie korte zekerheden onder de intro (reactietijd, vrijblijvend). Voor pagina's met een formulier. */
  punten?: string[];
}) {
  const vlak = donker ? 'bg-ink-900 text-white' : 'bg-mist';
  const kop = donker ? 'text-white' : 'text-ink-900';
  const tekst = donker ? 'text-ink-100' : 'text-warm';
  const kruimel = donker ? 'text-ink-300 hover:text-white' : 'text-warm hover:text-ink-900';

  const tekstblok = (
    <>
      {kruimels && kruimels.length > 0 && (
        <nav aria-label="Kruimelpad" className={`mb-4 text-xs ${tekst}`}>
          {kruimels.map((k, i) => (
            <span key={k.href}>
              {i > 0 && <span className="mx-1.5 opacity-50">/</span>}
              <Link href={k.href} className={kruimel}>{k.label}</Link>
            </span>
          ))}
        </nav>
      )}
      {eyebrow && <p className={`eyebrow ${donker ? 'text-amber-400' : ''}`}>{eyebrow}</p>}
      <h1 className={`mt-3 text-balance font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1] ${kop}`}>
        {title}
      </h1>
      {intro && <p className={`mt-4 text-lg leading-relaxed ${tekst}`}>{intro}</p>}
      {punten && punten.length > 0 && (
        <ul className={`mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold ${donker ? 'text-white' : 'text-ink-900'}`}>
          {punten.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <svg className={`h-4 w-4 shrink-0 ${donker ? 'text-amber-400' : 'text-amber-600'}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" /></svg>
              {p}
            </li>
          ))}
        </ul>
      )}
      {acties && <div className="mt-7">{acties}</div>}
    </>
  );

  return (
    <section className={`${vlak} overflow-hidden border-b border-line`}>
      <div className="border-t-2 border-dashed border-amber-500" aria-hidden="true" />

      {beeld ? (
        <div className="mx-auto grid grid-cols-1 w-full max-w-[110rem] lg:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col justify-center px-5 py-12 sm:px-6 sm:py-16 lg:min-h-[26rem] lg:py-16 lg:pl-[clamp(2rem,5.5vw,6rem)] lg:pr-16">
            <div className="max-w-[36rem]">{tekstblok}</div>
          </div>
          <div className="flex items-center px-5 pb-10 sm:px-6 lg:px-0 lg:py-10 lg:pr-8">{beeld}</div>
        </div>
      ) : (
        <div className="container-x py-9 sm:py-12">
          <div className="max-w-[46rem]">{tekstblok}</div>
        </div>
      )}
    </section>
  );
}
