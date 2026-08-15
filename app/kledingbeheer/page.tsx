import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { PortaalDemo, PortaalFragmenten } from '@/components/PortaalDemo';
import { ContactSectie } from '@/components/ContactSectie';
import { JsonLd } from '@/components/JsonLd';
import { Uitklap } from '@/components/Uitklap';
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
        eyebrow="Kledingbeheer"
        title="Het duurste aan bedrijfskleding is niet de kleding. Het zijn de uren."
        intro="Wie heeft wat, wie moet nog, wie is nieuw, past het binnen budget. Elke maand kost dat iemand tijd die eigenlijk ander werk heeft."
      />

      <section className="container-x py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="prose-nl text-lg">
              De jas is zelden het probleem, het geregel eromheen wel. In het kledingportaal bestellen je collega’s
              zelf binnen jouw functies, budgetten en maten. Jij kijkt alleen nog naar wat écht jouw akkoord nodig
              heeft.
            </p>
            <ul className="mt-7 grid grid-cols-3 gap-3 sm:gap-5">
              {cijfers.map((c) => (
                <li key={c.label} className="rounded-lg border-l-2 border-amber-500 bg-white py-3 pl-4 shadow-soft">
                  <span className="block font-display text-4xl font-extrabold leading-none tabular-nums text-ink-900 sm:text-5xl">
                    {c.getal}
                  </span>
                  <span className="mt-2 block text-[13px] font-semibold leading-snug text-warm">{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <p className="text-sm font-semibold text-ink-900">Twee manieren om verder te gaan</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link href="/offerte" className="btn-primary flex-1">
                Laat het mij zien in 15 minuten
              </Link>
              <Link href="/portaal" className="btn-outline flex-1">
                Ik ben al klant — inloggen
              </Link>
            </div>
            <p className="mt-4 text-sm text-warm">Demo online of bij jou op de zaak.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-mist">
        <div className="container-x py-14 sm:py-16">
          <p className="eyebrow">Zo ziet het eruit</p>
          <h2 className="mt-3 kop-2">Dit is het scherm waar jij op inlogt</h2>
          <div className="mt-8">
            <PortaalDemo />
          </div>
          <PortaalFragmenten className="mt-12" />
          <p className="mt-6 text-sm text-warm">Jouw logo, jouw functies. De namen hierboven zijn een voorbeeld.</p>
        </div>
      </section>

      <section className="container-x py-14 sm:py-16">
        <p className="eyebrow">Wat het je oplevert</p>
        <h2 className="mt-3 kop-2">Zes dingen die je niet meer zelf doet</h2>

        <div className="mt-10 overflow-hidden rounded-xl border border-line">
          <div className="hidden grid-cols-2 border-b border-line bg-mist text-[13px] font-bold uppercase tracking-[0.14em] sm:grid">
            <p className="px-5 py-3 text-warm">Hoe het nu gaat</p>
            <p className="border-l border-line px-5 py-3 text-ink-900">Met het kledingportaal</p>
          </div>
          <ul className="divide-y divide-line">
            {vergelijking.map((v) => (
              <li key={v.straks} className="grid sm:grid-cols-2">
                <p className="bg-mist px-5 py-4 text-sm leading-relaxed text-warm sm:bg-transparent">
                  <span className="mr-2 font-bold text-ink-300 sm:hidden">Nu</span>
                  {v.nu}
                </p>
                <p className="flex gap-3 border-t border-line px-5 py-4 text-sm leading-relaxed text-ink-800 sm:border-l sm:border-t-0">
                  <span className="mt-0.5 shrink-0 text-amber-600">
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
        <div className="container-x py-14 sm:py-16">
          <p className="eyebrow">Hoe het werkt</p>
          <h2 className="mt-3 kop-2">In drie stappen geregeld</h2>
          <ol className="mt-8 border-y border-line">
            {stappen.map((s, i) => (
              <li
                key={s.t}
                className="grid gap-x-6 gap-y-1 border-b border-line py-6 last:border-b-0 sm:grid-cols-[5rem_minmax(0,1fr)]"
              >
                <p className="pt-1 font-display text-xl font-extrabold tabular-nums leading-none text-amber-600">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <div>
                  <h3 className="kop-3 text-ink-900">{s.t}</h3>
                  <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-warm">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-[62ch] text-warm">
            Je hoeft niets voor te bereiden. Eén gesprek van een half uur is genoeg om te bepalen welke functies er
            zijn en wat daarbij hoort; de rest doen wij.
          </p>
        </div>
      </section>

      <section className="container-x py-14 sm:py-16">
        <figure className="mx-auto max-w-3xl rounded-lg border-l-2 border-amber-500 bg-white p-6 shadow-card sm:p-8">
          <blockquote className="font-display text-xl font-extrabold leading-snug text-ink-900 sm:text-2xl">
            “Binnen een paar dagen een duidelijke offerte en een week later kreeg ik een belletje dat alles al
            klaarlag.”
          </blockquote>
          <figcaption className="mt-4 text-sm text-warm">Klant uit Hengelo Gld, Google-recensie</figcaption>
        </figure>
      </section>

      <section className="border-t border-line">
        <div className="container-x py-14 sm:py-16">
          <p className="eyebrow">Meer weten</p>
          <h2 className="mt-3 kop-2">Wat inkopers ons vragen</h2>
          <div className="mt-6 max-w-3xl border-t border-line">
            {faq.map((f, i) => (
              <Uitklap key={f.q} titel={f.q} samenvatting={i === 0 ? 'Nee.' : undefined}>
                <p>{f.a}</p>
              </Uitklap>
            ))}
            <Uitklap titel="Hoe richten jullie het in?">
              <p>
                Je vertelt ons wie welk werk doet en wat daarbij hoort. Wij bouwen dat na in het portaal: per functie
                een pakket, per functie een budget, met jouw logo en kleuren erin. Je hoeft geen bestandje aan te
                leveren dat je zelf nog moet uitzoeken.
              </p>
              <p>
                Daarna komen we langs voor de passessie. Iedereen past, wij noteren de maat en zetten die per persoon
                vast. Vanaf dat moment klopt elke bestelling meteen en komt er niets terug omdat het net niet zat.
              </p>
              <p>
                Wil iemand iets buiten zijn pakket, dan komt die vraag eerst bij jou langs en niet pas op de factuur.
                Alles gaat per medewerker verpakt de deur uit, met de naam op de doos, zodat uitdelen geen halve
                ochtend meer kost.
              </p>
            </Uitklap>
          </div>
        </div>
      </section>

      <ContactSectie
        title="Kijk een keer mee in het portaal"
        intro="In een kwartier zie je hoe het er voor jouw bedrijf uitziet."
      />
    </>
  );
}
