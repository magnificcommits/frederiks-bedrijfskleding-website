import Link from 'next/link';
import Image from 'next/image';
import { site } from '@/content/site';

/**
 * Hero met de dienstbelofte boven de vouw: binnen 24 uur een offerte en passen
 * op locatie.
 *
 * INDELING. De hero heeft bewust een ánder raster dan de rest van de pagina.
 * Eerder stond de tekst in `container-x` (gecentreerd, max 1152 px) terwijl de
 * foto absoluut naar de rechter schermrand liep. Op een breed scherm gaf dat
 * links een gat van ~250 px leegte naast een tekstkolom van ~550 px, tegenover
 * een beeldvlak van ~800 px: optisch scheef, ook al sloot de naad in het midden
 * precies aan.
 *
 * Nu is het één grid over de volle breedte, met een meeschalende linkermarge
 * (clamp). De tekst begint dus dicht bij de schermrand in plaats van bij de
 * containerrand, en het beeld vult zijn eigen kolom. Links marge, rechts beeld,
 * geen gat ertussen.
 */
export function Hero() {
  const voornaam = site.owner.split(' ')[0];

  return (
    <section className="bg-ink-900 text-white">
      {/* Gestikte naad als merkaccent (kleding), geen hazard-streep of gradient-blob */}
      <div className="border-t-2 border-dashed border-amber-500" aria-hidden="true" />

      <div className="mx-auto grid w-full max-w-[110rem] lg:grid-cols-[1.05fr_1fr]">
        {/* TEKST */}
        <div className="px-5 py-14 sm:px-6 sm:py-20 lg:py-24 lg:pl-[clamp(2rem,5.5vw,6rem)] lg:pr-16">
          <div className="max-w-[36rem]">
            <p className="eyebrow text-amber-400">Bedrijfskleding in de Achterhoek · sinds {site.foundedYear}</p>
            <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
              Binnen 24 uur een offerte.<br className="hidden sm:inline" />{' '}
              Passen doen we <span className="text-amber-500">bij jou op de zaak</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-ink-100">
              Geen webshop waar je het zelf uitzoekt. Je krijgt {voornaam}, die je bedrijf leert kennen,
              langskomt om iedereen te laten passen en je logo in eigen huis aanbrengt.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/offerte" className="btn-primary">
                Vraag een offerte aan
              </Link>
              <Link
                href="/kledingbeheer"
                className="btn border-2 border-white bg-transparent text-white hover:bg-white hover:text-ink-900"
              >
                Bekijk het kledingportaal
              </Link>
            </div>
            <p className="mt-3 text-sm text-ink-200">
              Meestal 5 tot 50 medewerkers. Maar één jas voor een nieuwe kracht regelen we net zo goed.
            </p>

            <p className="mt-6 text-sm text-ink-100">
              <a
                href={`tel:${site.phoneIntl}`}
                className="font-display text-xl font-extrabold text-white underline decoration-amber-500 decoration-2 underline-offset-4 hover:text-amber-300"
              >
                {site.phone}
              </a>
              <span className="ml-2 align-middle text-ink-200">Je krijgt {voornaam} zelf aan de lijn.</span>
            </p>
          </div>
        </div>

        {/* BEELD - vult de eigen kolom en loopt daarmee vanzelf tot de schermrand */}
        <div className="relative h-72 sm:h-[26rem] lg:h-auto lg:min-h-[34rem]">
          <Image
            src="/Frederiks-bedrijfskleding-1.jpg"
            alt={`${voornaam} geeft persoonlijk kledingadvies bij Frederiks Bedrijfskleding`}
            fill priority sizes="(max-width: 1024px) 100vw, 48vw" className="object-cover object-[60%_center]"
          />
          {/* Zachte overgang naar de tekstkolom, zodat de rand niet als een naad oogt. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-40 bg-gradient-to-r from-ink-900 via-ink-900/55 to-transparent lg:block"
          />
          {/* Een bijschrift, linksonder op de gradient. Twee chips in dezelfde
              bovenhoek vochten om dezelfde ruimte en overlapten op mobiel. */}
          <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-[3px] border-r-2 border-dashed border-amber-500 bg-white/95 px-3 py-1.5 text-xs font-bold text-ink-900 shadow-card lg:bottom-8 lg:left-8">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            {voornaam} komt bij je langs om te passen
          </span>
        </div>
      </div>
    </section>
  );
}
