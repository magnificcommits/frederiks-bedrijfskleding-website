import { site } from '@/content/site';

/**
 * Smalle balk direct onder de hero met vier sterke punten. Geen reactietermijn
 * en geen artikelaantallen meer: Jessi belooft geen vaste termijn en de site
 * heeft geen openbare catalogus (werkdocument 20 okt 2026).
 *
 * Bedrukken doet Frederiks zelf; borduren gaat via een vaste partner. Daarom
 * staat er "wij regelen alles" en niet "in eigen huis".
 */
export function BewijsBalk() {
  const score = site.rating.value.toFixed(1).replace('.', ',');
  const punten = [
    { waarde: `${score}★`, label: 'op Google', srOnly: `${score} van 5 sterren` },
    { waarde: 'Eén aanspreekpunt', label: 'van eerste kennismaking tot nazorg' },
    { waarde: 'Passen', label: 'bij jou op locatie of in onze showroom' },
    { waarde: 'Bedrukken & borduren', label: 'van ontwerp tot afwerking, wij regelen alles' },
  ];

  return (
    <section className="bg-ink-900 text-white" aria-label="Wat je van ons kunt verwachten">
      <div className="container-x grid grid-cols-2 gap-x-6 gap-y-8 border-t border-white/10 py-10 sm:py-12 lg:grid-cols-4">
        {punten.map((p) => (
          <div key={p.label} className="border-l-2 border-amber-500 pl-4">
            <p className="font-display text-xl font-extrabold leading-tight text-white sm:text-2xl">
              {p.srOnly ? <span className="sr-only">{p.srOnly}</span> : null}
              <span aria-hidden={p.srOnly ? true : undefined}>{p.waarde}</span>
            </p>
            <p className="mt-2 text-sm leading-snug text-ink-100">{p.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
