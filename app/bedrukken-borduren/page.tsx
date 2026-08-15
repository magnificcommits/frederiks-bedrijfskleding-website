import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { MethodeKaarten, MethodeTabel, LogoPositieTekening } from '@/components/MethodeKaarten';
import { ContactSectie } from '@/components/ContactSectie';
import { Uitklap } from '@/components/Uitklap';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, faqJsonLd, serviceJsonLd } from '@/lib/jsonld';
import { stappen, logoposities } from '@/content/decoratie';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Bedrukken en borduren',
  description:
    'Je logo op werkkleding, vanaf één stuk. Borduren, transferdruk, zeefdruk en emblemen naast elkaar vergeleken, gedaan in eigen huis in Hengelo Gld. Altijd eerst een drukproef ter goedkeuring.',
  alternates: { canonical: '/bedrukken-borduren' },
};

/**
 * De diepgang op deze pagina zit in <Uitklap>: <details>/<summary> zonder JavaScript.
 * Google leest de inhoud gewoon mee, de bezoeker ziet hem pas na een klik. Zo blijft
 * de pagina kort te scannen zonder dat we informatie weggooien. Zet nieuwe uitleg
 * dus in een uitklapblok, niet in de lopende tekst.
 */
const faq = [
  {
    q: 'Kan ik ook één kledingstuk laten bedrukken of borduren?',
    a: 'Ja. Borduren en transferdruk doen we vanaf één stuk, dus ook voor één nieuwe medewerker. Zeefdruk begint rond 25 stuks, omdat we daarvoor eerst zeven inrichten. Emblemen maken we vanaf zo’n 10 stuks per ontwerp.',
  },
  {
    q: 'Zie ik het resultaat voordat alles gemaakt wordt?',
    a: 'Altijd. Je krijgt een drukproef waarop je positie, formaat en kleur beoordeelt. Pas na jouw goedkeuring gaat de rest van de serie de machine in. Klopt er iets niet, dan passen we het aan.',
  },
  {
    q: 'Ik heb geen logo als vectorbestand, kan het dan toch?',
    a: 'Meestal wel. Een scherpe PNG van minimaal 1000 pixels breed is vaak genoeg. Heb je alleen een klein logo van een website of uit een e-mailhandtekening, laat het zien: we zeggen eerlijk of het bruikbaar is en helpen je anders aan een versie die wel goed uitkomt.',
  },
];

const aanleveren = [
  {
    t: 'Liefst een vectorbestand',
    d: 'AI, EPS, PDF of SVG. Dat schaalt van borstlogo naar ruglogo zonder onscherp te worden.',
  },
  {
    t: 'Anders een scherpe PNG',
    d: 'Minimaal 1000 pixels breed, liefst met transparante achtergrond. Voor borduren zetten we het om naar een borduurbestand.',
  },
  {
    t: 'Heb je geen van beide?',
    d: 'Stuur wat je hebt, ook een logo van de website of het oude briefpapier. Wij zeggen wat ervoor nodig is.',
  },
];

const eigenHuis = [
  { t: 'Eigen machines', d: 'Niet goed is opnieuw.' },
  { t: 'Korte lijn', d: 'Geen kleding heen en weer.' },
  { t: 'Spoed? Loop binnen', d: 'Eén jas voor maandag is bespreekbaar.' },
];

export default function BedrukkenBordurenPage() {
  return (
    <>
      <JsonLd
        data={serviceJsonLd({
          name: 'Bedrukken en borduren van werkkleding',
          description: metadata.description as string,
          url: `${site.url}/bedrukken-borduren`,
        })}
      />
      <JsonLd data={faqJsonLd(faq)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: site.url },
          { name: 'Bedrukken en borduren', url: `${site.url}/bedrukken-borduren` },
        ])}
      />

      <PageHero
        eyebrow="In eigen huis, in Hengelo Gld"
        title="Je logo gaat erop, vanaf één stuk"
        intro="Borduren, transferdruk, zeefdruk en emblemen, gedaan aan de Kruisbergseweg in Hengelo Gld. Eerst een drukproef, dan de serie."
      />

      <section className="container-x py-10">
        <ul className="grid gap-4 sm:grid-cols-3">
          {eigenHuis.map((e) => (
            <li key={e.t} className="seam-card">
              <p className="text-base font-bold text-ink-900">{e.t}</p>
              <p className="mt-1 text-sm text-warm">{e.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-line bg-mist">
        <div className="container-x py-16">
          <p className="eyebrow">Vier technieken</p>
          <h2 className="mt-3 kop-2">Wat past bij jouw kleding?</h2>

          <div className="mt-10">
            <MethodeKaarten />
          </div>

          <div className="mt-10">
            <MethodeTabel />
          </div>

          <p className="mt-4 text-sm text-warm">
            Aantallen en levertijden zijn indicatief: stof en voorraad bepalen mee.
          </p>
        </div>
      </section>

      <section className="container-x py-16">
        <p className="eyebrow">Hoe het gaat</p>
        <h2 className="mt-3 kop-2">Van kledingstuk naar goedgekeurd logo</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stappen.map((s) => (
            <li key={s.nr} className="seam-card h-full">
              <span className="font-display text-2xl font-extrabold text-amber-500">{s.nr}</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">{s.title}</h3>
              <p className="mt-2 text-sm text-warm">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-mist">
        <div className="container-x py-16">
          <p className="eyebrow">Logoposities</p>
          <h2 className="mt-3 kop-2">Waar komt je logo te zitten?</h2>
          <p className="mt-3 max-w-2xl text-warm">Meestal borst links plus een ruglogo. Combineren kan.</p>

          <div className="mt-8">
            <LogoPositieTekening />
          </div>

          <div className="mt-6 rounded-lg border border-line bg-white px-6">
            <Uitklap titel="Wat kies je waar?">
              <dl>
                {logoposities.map((p) => (
                  <div key={p.id} className="mb-2 last:mb-0">
                    <dt className="inline font-semibold text-ink-900">{p.naam}: </dt>
                    <dd className="inline">{p.tekst}</dd>
                  </div>
                ))}
              </dl>
            </Uitklap>
          </div>
        </div>
      </section>

      <section className="container-x py-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow">Meer weten</p>
            <h2 className="mt-3 kop-2">Aanleveren en veelgestelde vragen</h2>
            <p className="mt-4 text-warm">
              Mail je logo naar{' '}
              <a href={`mailto:${site.email}`} className="font-semibold text-amber-700 hover:underline">
                {site.email}
              </a>{' '}
              of bel {site.owner.split(' ')[0]} op{' '}
              <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-700 hover:underline">
                {site.phone}
              </a>
              .
            </p>
          </div>

          <div className="rounded-lg border border-line bg-white px-6 shadow-card">
            <Uitklap titel="Welk bestand lever je aan?">
              <ul>
                {aanleveren.map((a) => (
                  <li key={a.t}>
                    <strong className="text-ink-900">{a.t}</strong> {a.d}
                  </li>
                ))}
              </ul>
            </Uitklap>
            {faq.map((f) => (
              <Uitklap key={f.q} titel={f.q}>
                <p>{f.a}</p>
              </Uitklap>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-mist">
        <div className="container-x py-14">
          <div className="grid items-center gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="eyebrow">Zelf zien</p>
              <h2 className="mt-3 kop-2">Zet je logo live op de kleding</h2>
              <p className="mt-3 max-w-2xl text-warm">
Upload je logo in de pakketsamensteller en zie het meteen op het kledingstuk staan.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/pakket-samenstellen" className="btn-primary">
                Stel je pakket samen
              </Link>
              <Link href="/contact" className="btn-outline">
                Even overleggen
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ContactSectie
        title="Je logo erop? Stuur het even op"
        intro="Mail je logo of vertel wat je zoekt. Wij zeggen welke techniek past."
      />
    </>
  );
}
