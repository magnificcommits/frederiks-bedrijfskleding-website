import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { PortaalDemo, PortaalFragmenten } from '@/components/PortaalDemo';
import { ContactSectie } from '@/components/ContactSectie';
import { JsonLd } from '@/components/JsonLd';
import { Faq } from '@/components/Faq';
import { breadcrumbJsonLd, faqJsonLd, serviceJsonLd } from '@/lib/jsonld';
import { site } from '@/content/site';

const beschrijving =
  'Het duurste aan bedrijfskleding zijn de uren eromheen. In het kledingportaal van Frederiks bestellen je collega’s zelf binnen jouw assortiment en budget, met de maten die we bij je op de zaak hebben opgenomen. Geen app, geen wachtwoord.';

export const metadata: Metadata = {
  title: 'Kledingbeheer: het portaal waarin je collega’s zelf bestellen',
  description: beschrijving,
  alternates: { canonical: '/kledingbeheer' },
  keywords: [
    'kledingbeheer', 'bestelportaal werkkleding', 'klantportaal bedrijfskleding',
    'werkkleding budget per functie', 'bedrijfskleding beheer Achterhoek',
  ],
};

/**
 * Eenvoudige lijniconen, 24×24 op currentColor. Bewust geen icoonpakket:
 * zes paden wegen niets en houden de stijl gelijk aan de rest van de site.
 */
function Icoon({ pad }: { pad: React.ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {pad}
    </svg>
  );
}

const iconen = {
  lijst: (
    <>
      <path d="M9.5 3.5h5v2.5h-5z" />
      <path d="M14.5 5h2.5a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 17 21H7a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 7 5h2.5" />
      <path d="M8.5 13.5l2 2 4.5-4.5" />
    </>
  ),
  budget: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h13" />
      <path d="M3 8.5v9A1.5 1.5 0 0 0 4.5 19h14a1.5 1.5 0 0 0 1.5-1.5V11a1.5 1.5 0 0 0-1.5-1.5H4.5" />
      <path d="M16.5 14.25h.01" />
    </>
  ),
  maat: (
    <>
      <path d="M14.1 2.9l7 7a1 1 0 0 1 0 1.4L11.3 21.1a1 1 0 0 1-1.4 0l-7-7a1 1 0 0 1 0-1.4L12.7 2.9a1 1 0 0 1 1.4 0z" />
      <path d="M6.5 12.5l2 2M9.5 9.5l2 2M12.5 6.5l2 2" />
    </>
  ),
  doos: (
    <>
      <path d="M3.5 8.5L12 4l8.5 4.5v7L12 20l-8.5-4.5z" />
      <path d="M3.5 8.5L12 13l8.5-4.5M12 13v7" />
    </>
  ),
  telefoon: (
    <>
      <path d="M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3z" />
      <path d="M9.5 11.5l1.8 1.8 3.4-3.4" />
      <path d="M10.75 17.5h2.5" />
    </>
  ),
  agenda: (
    <>
      <path d="M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" />
      <path d="M8 3.5v4M16 3.5v4M4 10.5h16" />
      <path d="M9.5 15l1.8 1.8 3.7-3.7" />
    </>
  ),
};

/**
 * Nu tegenover straks. Dezelfde zes punten als eerst, maar met het werk dat het
 * nú kost ernaast - want dát is wat een inkoper herkent, niet een lijst features.
 */
const vergelijking = [
  {
    nu: 'Je verzamelt bestellingen per mail, app en post-it.',
    straks: 'Collega’s bestellen zelf, uit het assortiment dat jij hebt vastgezet.',
    i: iconen.lijst,
  },
  {
    nu: 'Iedereen krijgt hetzelfde, of jij houdt per functie een lijstje bij.',
    straks: 'Pakket en budget per functie: de timmerman krijgt iets anders dan de buitendienst.',
    i: iconen.budget,
  },
  {
    nu: 'Bij elke nabestelling weer maten navragen, en soms toch mis.',
    straks: 'Maten liggen vast sinds de passessie. Nabestellen is twee klikken.',
    i: iconen.maat,
  },
  {
    nu: 'Eén grote doos op kantoor die jij zit uit te zoeken.',
    straks: 'Per medewerker verpakt, met de naam op de doos.',
    i: iconen.doos,
  },
  {
    nu: 'Weer een app en een wachtwoord dat niemand onthoudt.',
    straks: 'Eén link. Je collega bestelt vanuit de bus, zonder inloggen.',
    i: iconen.telefoon,
  },
  {
    nu: 'Zelf uitzoeken hoe je zoiets opzet en bijhoudt.',
    straks: 'Wij richten het in. Binnen vier weken staat jouw versie klaar.',
    i: iconen.agenda,
  },
];

const cijfers = [
  { getal: '4', label: 'weken tot het staat' },
  { getal: '0', label: 'apps te installeren' },
  { getal: '1', label: 'vast aanspreekpunt' },
];

const stappen = [
  { t: 'Wij zetten je functies en budgetten op', d: 'Jij vertelt wie welk werk doet, wij bouwen dat na in het portaal.' },
  { t: 'We komen langs voor de passessie', d: 'Eén ochtend bij jou op de zaak, daarna klopt elke bestelling.' },
  { t: 'Je collega’s bestellen zelf', d: 'Jij ziet het terug en tekent alleen voor de uitzonderingen.' },
];

const faq = [
  {
    q: 'Hoe richten jullie het in?',
    a: 'Je vertelt ons wie welk werk doet en wat daarbij hoort. Wij bouwen dat na in het portaal: per functie een pakket en een budget, met jouw logo en kleuren erin. Daarna komen we langs voor de passessie. Iedereen past, wij zetten de maat per persoon vast, en vanaf dat moment klopt elke bestelling meteen. Wil iemand iets buiten zijn pakket, dan komt die vraag eerst bij jou langs en niet pas op de factuur. Alles gaat per medewerker verpakt de deur uit, met de naam op de doos.',
  },
  {
    q: 'Kost het kledingbeheer extra?',
    a: 'Nee. Het hoort bij de samenwerking. Neem je je bedrijfskleding bij Frederiks af, dan richten wij het portaal voor je in en gebruik je het zonder extra kosten. Je betaalt voor de kleding, het overzicht krijg je erbij.',
  },
  {
    q: 'Moeten mijn mensen iets installeren?',
    a: 'Nee. Geen app en geen wachtwoord om te onthouden. Je collega’s krijgen een link per mail en komen daarmee in hun eigen bestelscherm, op de telefoon, tablet of computer. Niemand die belt omdat hij er niet in komt.',
  },
  {
    q: 'Wat als iemand uit dienst gaat?',
    a: 'Dan zet je die persoon op inactief. Het budget stopt meteen en de maten en bestelgeschiedenis blijven bewaard, zodat je precies ziet wat er nog in omloop is en wat je terug wilt hebben. Komt er een opvolger, dan staat het pakket voor die functie al klaar.',
  },
];

export default function KledingbeheerPage() {
  return (
    <>
      <JsonLd
        data={serviceJsonLd({
          name: 'Kledingbeheer en bestelportaal voor bedrijfskleding',
          description: beschrijving,
          url: `${site.url}/kledingbeheer`,
        })}
      />
      <JsonLd data={faqJsonLd(faq)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: site.url },
          { name: 'Kledingbeheer', url: `${site.url}/kledingbeheer` },
        ])}
      />

      <PageHero
        donker
        eyebrow="Kledingbeheer"
        title="Het duurste aan bedrijfskleding is niet de kleding. Het zijn de uren."
        intro="Wie heeft wat, wie is nieuw, past het binnen budget. In het kledingportaal bestellen je collega’s zelf, binnen jouw functies, budgetten en maten. Jij kijkt alleen nog naar wat jouw akkoord nodig heeft."
        acties={
          <div className="flex flex-wrap gap-3" data-plek="kledingbeheer-hero">
            <Link href="/afspraak" className="btn-primary" data-cta="afspraak">Laat het mij zien in 15 minuten</Link>
            <Link href="/portaal" className="btn border-2 border-white/70 text-white hover:border-white hover:bg-white hover:text-ink-900">Ik ben al klant, inloggen</Link>
          </div>
        }
        beeld={
          <ul className="grid w-full grid-cols-3 divide-x divide-dashed divide-white/25 rounded-2xl border border-dashed border-white/25 lg:max-w-xl">
            {cijfers.map((c) => (
              <li key={c.label} className="px-4 py-6 text-center sm:py-8">
                <span className="block font-display text-6xl font-extrabold leading-none tabular-nums text-amber-500 sm:text-7xl">{c.getal}</span>
                <span className="mt-3 block text-sm font-semibold leading-snug text-white">{c.label}</span>
              </li>
            ))}
          </ul>
        }
      />

      <section className="border-b border-line bg-mist">
        <div className="container-x sec-md">
          <h2 className="kop-2">Dit is het scherm waar jij op inlogt</h2>
          <div className="mt-6">
            <PortaalDemo />
          </div>
          <PortaalFragmenten className="mt-8" />
          <p className="mt-6 text-sm text-warm">Jouw logo, jouw functies. De namen hierboven zijn een voorbeeld.</p>
        </div>
      </section>

      <section className="container-x sec-md">
        <h2 className="kop-2">Zes dingen die je niet meer zelf doet</h2>

        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="hidden grid-cols-2 text-sm font-semibold sm:grid" aria-hidden="true">
            <p className="px-5 py-3 text-warm">Hoe het nu gaat</p>
            <p className="bg-ink-900 px-5 py-3 text-white">Met het kledingportaal</p>
          </div>
          <ul>
            {vergelijking.map((v) => (
              <li key={v.straks} className="grid border-t border-line sm:grid-cols-2">
                <p className="flex gap-3 px-5 py-4 text-sm leading-snug text-warm">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                  <span><span className="font-semibold sm:sr-only">Nu: </span>{v.nu}</span>
                </p>
                <p className="flex gap-3 bg-ink-900 px-5 py-4 text-sm font-medium leading-snug text-white">
                  <span className="mt-0.5 shrink-0 text-amber-400">
                    <Icoon pad={v.i} />
                  </span>
                  <span>{v.straks}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-line bg-mist">
        <div className="container-x sec-md grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-10">
          <div>
            <h2 className="kop-2">In drie stappen geregeld</h2>
            <ol className="mt-6 grid gap-6 sm:grid-cols-3">
              {stappen.map((s, i) => (
                <li key={s.t} className="relative">
                  {i < stappen.length - 1 && <span className="absolute left-12 right-0 top-4 hidden border-t-2 border-dashed border-amber-400 sm:block" aria-hidden="true" />}
                  <span className="stap-nr relative" data-stand="nu" aria-hidden="true">{i + 1}</span>
                  <h3 className="mt-3 font-display text-[1.0625rem] font-extrabold text-ink-900">{s.t}</h3>
                  <p className="mt-1 text-sm leading-snug text-warm">{s.d}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 max-w-[62ch] text-warm">
              Je hoeft niets voor te bereiden. Eén gesprek van een half uur is genoeg om te bepalen welke functies er
              zijn en wat daarbij hoort; de rest doen wij.
            </p>
          </div>
          <figure className="paneel-donker self-start p-6 sm:p-7">
            <svg className="h-7 w-7 text-amber-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 18v-5c0-4 2-7 6-8l1 2c-2 1-3 2.500-3 4h3v7zm9 0v-5c0-4 2-7 6-8l1 2c-2 1-3 2.500-3 4h3v7z" /></svg>
            <blockquote className="mt-3 font-display text-xl font-extrabold leading-snug text-white">
              Binnen een paar dagen een duidelijke offerte en een week later kreeg ik een belletje dat alles al klaarlag.
            </blockquote>
            <figcaption className="mt-4 text-sm text-ink-200">Klant uit Hengelo Gld, Google-recensie</figcaption>
          </figure>
        </div>
      </section>

      <Faq items={faq} title="Wat inkopers ons vragen" />

      <ContactSectie
        title="Kijk een keer mee in het portaal"
        intro="In een kwartier zie je hoe het er voor jouw bedrijf uitziet."
      />
    </>
  );
}
