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
  donker = false,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  /** Kruimelpad, bijvoorbeeld [{ label: 'Assortiment', href: '/assortiment' }] */
  kruimels?: { label: string; href: string }[];
  /** Loopt vanaf lg door tot de rechter schermrand. Laat leeg voor een compacte kop. */
  beeld?: React.ReactNode;
  donker?: boolean;
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
    </>
  );

  return (
    <section className={`${vlak} overflow-hidden border-b border-line`}>
      <div className="border-t-2 border-dashed border-amber-500" aria-hidden="true" />

      {beeld ? (
        <div className="mx-auto grid w-full max-w-[110rem] lg:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col justify-center px-5 py-12 sm:px-6 sm:py-16 lg:min-h-[26rem] lg:py-16 lg:pl-[clamp(2rem,5.5vw,6rem)] lg:pr-16">
            <div className="max-w-[36rem]">{tekstblok}</div>
          </div>
          <div className="flex items-center px-5 pb-10 sm:px-6 lg:px-0 lg:py-10 lg:pr-8">{beeld}</div>
        </div>
      ) : (
        <div className="container-x py-12 sm:py-16">
          <div className="max-w-[42rem]">{tekstblok}</div>
        </div>
      )}
    </section>
  );
}
