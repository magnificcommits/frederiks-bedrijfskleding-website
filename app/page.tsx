import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { BrandStrip } from '@/components/BrandStrip';
import { BrancheGrid } from '@/components/BrancheGrid';
import { Reviews } from '@/components/Reviews';
import { CtaBand } from '@/components/CtaBand';
import { Faq } from '@/components/Faq';
import { KledingadviesWizard } from '@/components/KledingadviesWizard';
import { PortaalUsp } from '@/components/PortaalUsp';
import { BewijsBalk } from '@/components/BewijsBalk';
import { HoeWerktHet } from '@/components/HoeWerktHet';
import { VakTegels } from '@/components/VakTegels';
import { PakketProef } from '@/components/PakketProef';
import { site } from '@/content/site';
import { JsonLd } from '@/components/JsonLd';
import { faqJsonLd } from '@/lib/jsonld';
import { WieJeKrijgt, SpaarTeaser } from '@/components/Vertrouwen';

// De bewijsbalk leest het aantal merken en artikelen uit de catalogus; met ISR
// is dat een query per uur in plaats van een per bezoeker.
export const revalidate = 3600;

const homeFaq = [
  { q: 'Leveren jullie ook aan zzp’ers?', a: 'Ja. Van zzp’er tot bedrijven met meer dan vijftig medewerkers, iedereen is welkom. We denken ook mee bij kleine aantallen.' },
  { q: 'Komen jullie langs om te passen?', a: 'Zeker. Passen op locatie is juist onze kracht. Zo raak je geen werktijd kwijt en zit iedereen goed in z’n kleding.' },
  { q: 'Kunnen jullie ons logo aanbrengen?', a: 'Ja, we bedrukken en borduren in eigen huis. Daardoor gaat het snel en is de kwaliteit slijtvast.' },
  { q: 'In welke regio zijn jullie actief?', a: 'We zitten in Hengelo (Gld) en werken door de hele Achterhoek, waaronder Doetinchem, Zutphen, Doesburg, Lichtenvoorde en Winterswijk.' },
  { q: 'Hoe snel heb ik de kleding?', a: 'Op een aanvraag reageren we binnen 24 uur, op werkdagen. Na de pasafspraak en je akkoord ligt de kleding er meestal binnen een tot twee weken, afhankelijk van voorraad en logowerk. Haast? Zeg het meteen, dan kijken we wat er kan.' },
  { q: 'Waarom staan er geen prijzen op de site?', a: 'Omdat de prijs afhangt van aantallen, maten en het logowerk. Je krijgt na het passen een offerte waar alles in staat, zonder verrassingen achteraf. Klanten met een kledingportaal zien hun eigen prijzen online.' },
];

const aanbod = [
  { t: 'Werkkleding', href: '/werkkleding' },
  { t: 'Werkschoenen', href: '/werkschoenen' },
  { t: 'Bedrukken en borduren', href: '/bedrukken-borduren' },
  { t: 'Normen en klassen', href: '/normen' },
  { t: 'Maattabellen', href: '/maattabellen' },
  { t: 'Hele assortiment', href: '/assortiment' },
];

/**
 * Volgorde van de homepage, bewust zo:
 *  1. Hero met de belofte en twee knoppen (offerte, adviesgesprek).
 *  2. Bewijs en werkwijze: wat kost het me, hoe gaat het.
 *  3. Branches: "is dit voor mij?" zo vroeg mogelijk beantwoorden.
 *  4. Reviews en wie je krijgt: vertrouwen vlak voor de beslissing.
 *  5. Merken, portaal en sparen: voor wie al verder kijkt.
 *  6. Vakgebieden en soorten kleding als interne links (SEO).
 *  7. Pakketsamensteller en het korte adviesformulier voor de twijfelaars.
 *  8. FAQ en een afsluitende band.
 * De oude "over ons"-sectie met vier USP-kaarten is opgegaan in WieJeKrijgt;
 * die stond er dubbel met de bewijsbalk en de werkwijze.
 */

export default async function HomePage() {
  return (
    <>
      <Hero />
      <BewijsBalk />
      <HoeWerktHet />
      <BrancheGrid />
      <Reviews limit={6} />
      <WieJeKrijgt />
      <BrandStrip />
      <PortaalUsp />
      <SpaarTeaser />

      {/* Vakgebied x streek: hier win je van landelijke webshops, die alleen
          op plaatsnaam schalen en niets met beroepen doen. */}
      <section className="bg-white">
        <div className="container-x sec-md grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-10">
          <div>
            <h2 className="kop-2">We weten wat jouw werk met kleding doet</h2>
            <p className="mt-3 max-w-[62ch] text-lg text-warm">
              Een hovenier sleept door de doornstruiken, een schilder zit op zijn knieën en een lasser heeft
              met vonken te maken. Kies je vak en zie wat je nodig hebt.
            </p>
            <VakTegels className="mt-6" />
          </div>
          <div className="paneel-donker self-start p-6 lg:sticky lg:top-28">
            <h3 className="font-display text-xl font-extrabold text-white">Of zoek op soort kleding</h3>
            <ul className="mt-4 divide-y divide-white/15 border-y border-white/15">
              {aanbod.map((c) => (
                <li key={c.href}>
                  <Link href={c.href} className="group flex min-h-[48px] items-center justify-between gap-3 py-2 font-semibold text-white hover:text-amber-400">
                    {c.t}
                    <svg className="h-5 w-5 shrink-0 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-amber-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" /></svg>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Pakketsamensteller */}
      <section className="bg-ink-900 text-white">
        <div className="container-x sec grid items-center gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14">
          <div>
            <h2 className="kop-2">Stel je pakket samen en zie je logo meteen op de kleding</h2>
            <p className="mt-4 max-w-[54ch] text-lg text-white/80">Probeer het zelf: kies een kledingstuk en een kleur, zet je logo erop en zie meteen hoe het staat. Tevreden? Vraag het pakket in één klik als offerte aan.</p>
            {/* Wit omlijnd in plaats van oranje: oranje is gereserveerd voor de
                offerte, en de samensteller eindigt zelf ook in een offerte. */}
            <div className="mt-6 flex flex-wrap gap-3" data-plek="pakket-sectie">
              <Link href="/pakket-samenstellen" className="btn border-2 border-white bg-white text-ink-900 hover:bg-transparent hover:text-white" data-cta="pakket">Stel je pakket samen</Link>
              <Link href="/bedrukken-borduren" className="btn border-2 border-white/40 text-white hover:border-white">Over ons logowerk</Link>
            </div>
          </div>
          <PakketProef />
        </div>
      </section>

      {/* Leadtool */}
      <section className="border-y border-line bg-mist" id="kledingadvies">
        <div className="container-x sec grid items-start gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-12">
          <div className="lg:sticky lg:top-28">
            <h2 className="kop-2">Niet zeker wat je nodig hebt?</h2>
            <p className="mt-3 max-w-[48ch] text-lg text-warm">Vier korte vragen, een minuut werk. Jessi belt je binnen 24 uur terug met advies dat bij je werk past.</p>
            <ul className="mt-5 space-y-2 text-[15px] font-semibold text-ink-900">
              {['Geen verplichtingen', 'Advies van iemand die de kleding kent', 'Passen bij jou op de zaak'].map((p) => (
                <li key={p} className="flex items-center gap-2.5">
                  <svg className="h-4 w-4 shrink-0 text-amber-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" /></svg>
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-warm" data-plek="kledingadvies-sectie">
              Liever eerst praten?{' '}
              <Link href="/afspraak" className="font-semibold text-amber-700 underline underline-offset-2" data-cta="afspraak">Plan een adviesgesprek</Link>
              {' '}of bel <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-700 hover:underline">{site.phone}</a>.
            </p>
          </div>
          <KledingadviesWizard />
        </div>
      </section>

      <JsonLd data={faqJsonLd(homeFaq)} />
      <Faq items={homeFaq} />
      <CtaBand />
    </>
  );
}
