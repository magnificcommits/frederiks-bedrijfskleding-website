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
import { vakgebieden } from '@/content/vakgebieden';
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
        <div className="container-x py-16 sm:py-20">
          <p className="eyebrow">Voor jouw vak</p>
          <h2 className="kop-2 mt-3">We weten wat jouw werk met kleding doet</h2>
          <p className="mt-4 max-w-2xl text-lg text-warm">
            Een hovenier sleept door de doornstruiken, een schilder zit op zijn knieën en een lasser heeft
            met vonken te maken. Wat er dan misgaat verschilt per vak, en dat bepaalt wat je moet hebben.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vakgebieden.map((v) => (
              <Link
                key={v.slug}
                href={`/voor/${v.slug}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-5 py-4 transition hover:border-amber-400 hover:shadow-card"
              >
                <span className="font-semibold text-ink-900">{v.naam}</span>
                <span aria-hidden="true" className="text-amber-700 transition group-hover:translate-x-0.5">&rarr;</span>
              </Link>
            ))}
          </div>
          <h3 className="kop-3 mt-12 text-ink-900">Of zoek op soort kleding</h3>
          <ul className="mt-4 flex flex-wrap gap-2">
            {aanbod.map((c) => (
              <li key={c.href}>
                <Link href={c.href} className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink-800 transition hover:border-amber-400 hover:text-amber-800">
                  {c.t}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pakketsamensteller */}
      <section className="bg-ink-900 text-white">
        <div className="container-x grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="eyebrow text-amber-500">Pakketsamensteller</p>
            <h2 className="kop-2 mt-3">Stel je pakket samen en zie je logo meteen op de kleding</h2>
            <p className="mt-4 max-w-[54ch] text-lg text-white/80">Kies de kleding en kleuren die bij je werk passen. Upload je logo en bekijk live hoe het op de polo, jas of broek staat. Geen webshop, geen verplichtingen.</p>
            <p className="mt-4 text-white/80">Tevreden over je pakket? Vraag het in één klik vrijblijvend als offerte aan. Jessi kijkt mee, denkt mee over maten en aantallen en belt je terug.</p>
            {/* Wit omlijnd in plaats van oranje: oranje is gereserveerd voor de
                offerte, en de samensteller eindigt zelf ook in een offerte. */}
            <div className="mt-6 flex flex-wrap gap-3" data-plek="pakket-sectie">
              <Link href="/pakket-samenstellen" className="btn border-2 border-white bg-white text-ink-900 hover:bg-transparent hover:text-white" data-cta="pakket">Stel je pakket samen</Link>
              <Link href="/bedrukken-borduren" className="btn border-2 border-white/40 text-white hover:border-white">Over ons logowerk</Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-6">
            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-ink-900">1</span>
                <p className="text-white/80"><span className="font-bold text-white">Kies je kleding.</span> Stel je set samen uit polo’s, jassen, broeken en schoenen.</p>
              </li>
              <li className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-ink-900">2</span>
                <p className="text-white/80"><span className="font-bold text-white">Zet je logo erop.</span> Upload je logo en zie direct hoe het op de kleding staat.</p>
              </li>
              <li className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-ink-900">3</span>
                <p className="text-white/80"><span className="font-bold text-white">Vraag je offerte aan.</span> Wij rekenen het uit en nemen contact op. Vrijblijvend.</p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Leadtool */}
      <section className="border-y border-line bg-mist">
        <div className="container-x grid gap-10 py-16 sm:py-24 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="eyebrow">Kledingadvies in 1 minuut</p>
            <h2 className="kop-2 mt-3">Niet zeker wat je nodig hebt?</h2>
            <p className="mt-4 max-w-[54ch] text-lg text-warm">Beantwoord vier korte vragen. We bellen je binnen 24 uur terug (op werkdagen) met advies dat past bij je werk. Vrijblijvend.</p>
            <p className="mt-4 text-sm text-warm" data-plek="kledingadvies-sectie">
              Liever eerst praten?{' '}
              <Link href="/afspraak" className="font-semibold text-amber-700 underline underline-offset-2" data-cta="afspraak">Plan een adviesgesprek</Link>
              {' '}of bel <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-700 hover:underline">{site.phone}</a>.
            </p>
          </div>
          <div className="lg:col-span-3">
            <KledingadviesWizard />
          </div>
        </div>
      </section>

      <JsonLd data={faqJsonLd(homeFaq)} />
      <Faq items={homeFaq} />
      <CtaBand />
    </>
  );
}
