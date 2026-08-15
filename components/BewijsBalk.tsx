import { site } from '@/content/site';
import { catalogusOverzicht } from '@/lib/kms/catalogus';

/**
 * Smalle bewijsbalk direct onder de hero: vier harde punten die de belofte boven
 * de vouw onderbouwen.
 *
 * Twee dingen bewust anders dan eerst:
 *
 *  1. Het aantal merken en artikelen komt uit de catalogus, niet uit een vaste
 *     tekst. Er stond "11 merken, ruim 500 artikelen" terwijl er inmiddels 13
 *     merken en 428 artikelen op de site staan. Een tegenstrijdig getal kost een
 *     bedrijf dat het van vertrouwen moet hebben meer dan een lelijke sectie.
 *     De pagina draait op ISR, dus dit is één query per uur, geen per pageview.
 *
 *  2. Het aantal beoordelingen staat er niet meer bij. 5,0 uit 8 reviews leest
 *     als "acht", niet als "vijf sterren". Zodra het er twintig of meer zijn,
 *     zet je het aantal er weer bij - dan werkt het juist vóór je.
 */
export async function BewijsBalk() {
  const { merken, totaal } = await catalogusOverzicht();

  const punten = [
    {
      waarde: `${site.rating.value.toFixed(1).replace('.', ',')}★`,
      label: 'op Google',
      srOnly: `${site.rating.value.toFixed(1).replace('.', ',')} van 5 sterren`,
    },
    { waarde: '< 24 uur', label: 'reactietijd op elke aanvraag, op werkdagen' },
    { waarde: `${merken.length} merken`, label: `${totaal} artikelen om uit te kiezen` },
    { waarde: 'In eigen huis', label: 'bedrukken en borduren in Hengelo Gld' },
  ];

  return (
    <section className="bg-ink-900 text-white" aria-label="Waar we op afgerekend mogen worden">
      <div className="container-x grid grid-cols-2 gap-x-6 gap-y-8 border-t border-white/10 py-10 sm:py-12 lg:grid-cols-4">
        {punten.map((p) => (
          <div key={p.label} className="border-l-2 border-amber-500 pl-4">
            <p className="font-display text-2xl font-extrabold leading-none text-white sm:text-3xl">
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
