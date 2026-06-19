import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { BrandStrip } from '@/components/BrandStrip';
import { CrossLinks } from '@/components/CrossLinks';
import { ContactSectie } from '@/components/ContactSectie';
import { Faq } from '@/components/Faq';
import { JsonLd } from '@/components/JsonLd';
import { serviceJsonLd, faqJsonLd } from '@/lib/jsonld';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Bedrukken en borduren',
  description: 'Werkkleding, shirts en textiel laten bedrukken of borduren in de Achterhoek. Je logo strak, kleurecht en slijtvast aangebracht, in eigen huis en met persoonlijk advies.',
  alternates: { canonical: '/bedrukken-borduren' },
};

const stappen = [
  { nr: '01', t: 'Logo aanleveren', d: 'Stuur je logo, het liefst als vectorbestand (AI, EPS of PDF). Heb je dat niet, dan maken we het samen in orde.' },
  { nr: '02', t: 'Techniek kiezen', d: 'We adviseren per kledingstuk: bedrukken voor kleur en grote oplagen, borduren voor een verzorgde, duurzame look.' },
  { nr: '03', t: 'Proef en plaatsing', d: 'We bepalen positie en grootte en laten je het resultaat zien voordat de hele order de deur uit gaat.' },
  { nr: '04', t: 'Aanbrengen in eigen huis', d: 'Omdat we het zelf doen, schakelen we snel en houden we de kwaliteit in de hand.' },
];

const faq = [
  { q: 'Wat is het verschil tussen bedrukken en borduren?', a: 'Bedrukken is ideaal voor kleurrijke logo’s en grotere oplagen en geeft een haarscherp, kleurecht resultaat. Borduren oogt verzorgd en luxe, heeft diepte en gaat uitstekend door de was, ook op hogere temperaturen. Per kledingstuk bekijken we wat het mooiste resultaat geeft.' },
  { q: 'Op welk textiel kunnen jullie aanbrengen?', a: 'Op vrijwel alle bedrijfskleding: werkbroeken, jassen, softshells, polo’s, shirts, sweaters, koksbuizen en bodywarmers. We stemmen de techniek af op de stof, zodat de afwerking hecht en lang mooi blijft.' },
  { q: 'Hoe lang gaat de bedrukking of borduring mee?', a: 'Onze prints zijn kleurecht, slijtvast en bestand tegen wassen, en borduurwerk gaat zelfs bij intensief gebruik en veelvuldig wassen lang mee. In ons kennisbankartikel over wassen lees je hoe je het zo lang mogelijk mooi houdt.' },
  { q: 'Kan ik een kleine oplage of zelfs één stuk laten doen?', a: 'Ja. Van één jas voor een nieuwe medewerker tot een complete teamuitrusting, we draaien er onze hand niet voor om. Omdat we in eigen huis werken, kunnen we ook klein en snel leveren.' },
  { q: 'Kunnen jullie ook kleding bedrukken die ik al heb?', a: 'In veel gevallen wel. Neem contact op met wat je hebt, dan kijken we of de stof en het type zich lenen voor bedrukken of borduren.' },
];

const pijlers = [
  { t: 'Maatwerk en precisie', d: 'We brengen je logo haarscherp en op de juiste plek aan, afgestemd op het kledingstuk.' },
  { t: 'Service en meedenken', d: 'Je hebt één aanspreekpunt dat met je meedenkt over techniek, plaatsing en kleur.' },
  { t: 'Kwaliteit en identiteit', d: 'Een verzorgd logo maakt je team herkenbaar en straalt professionaliteit uit.' },
];

export default function BedrukkenPage() {
  return (
    <>
      <JsonLd data={serviceJsonLd({ name: 'Bedrukken en borduren van werkkleding', description: metadata.description as string, url: `${site.url}/bedrukken-borduren` })} />
      <JsonLd data={faqJsonLd(faq)} />

      <PageHero eyebrow="Maatwerk en branding" title="Dé Achterhoekse partner voor bedrukken en borduren"
        intro="Geef je bedrijfskleding een eigen gezicht. Met een bedrukt of geborduurd logo wordt je team herkenbaar en straalt het professionaliteit uit. We doen het in eigen huis in Hengelo, dus snel en met grip op de kwaliteit." />

      <section className="container-x py-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line shadow-card">
            <Image src="/Bedrijfskleding-bedrukken-en-borduren.jpg" alt="Bedrukte en geborduurde bedrijfskleding van Frederiks Bedrijfskleding"
              fill sizes="(max-width: 1024px) 90vw, 45vw" className="object-cover" />
          </div>
          <div className="prose-nl text-lg">
            <p>Bij Frederiks helpen we je om je bedrijfskleding een unieke, professionele uitstraling te geven. Of het nu gaat om één jas of een complete teamuitrusting, we zorgen dat je logo, bedrijfsnaam of slogan strak en duidelijk zichtbaar is.</p>
            <p>Omdat we het bedrukken en borduren zelf doen, zie je vooraf hoe het eruitkomt en kunnen we snel schakelen, ook bij een spoedklus. Geen tussenpartij, gewoon iemand die met je meedenkt.</p>
          </div>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border-l-2 border-dashed border-amber-500 bg-white p-6 shadow-soft">
            <h2 className="text-xl font-extrabold text-ink-900">Bedrukken</h2>
            <p className="mt-2 text-warm">Wil je een strak en kleurrijk logo? Met hoogwaardige druktechnieken brengen we je ontwerp haarscherp aan op uiteenlopend textiel. De prints zijn kleurecht, slijtvast en bestand tegen wassen, en het is voordelig bij grotere aantallen.</p>
          </div>
          <div className="rounded-xl border-l-2 border-dashed border-amber-500 bg-white p-6 shadow-soft">
            <h2 className="text-xl font-extrabold text-ink-900">Borduren</h2>
            <p className="mt-2 text-warm">Ga je voor een luxe en duurzame afwerking? Met onze borduurmachines brengen we je logo met precisie en diepte aan. Borduring is extra stevig en gaat lang mee, zelfs bij intensief gebruik en veel wassen. Vaak de keuze voor polo’s, jassen en horecakleding.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-mist">
        <div className="container-x py-16">
          <p className="eyebrow">Voor elk soort bedrijf</p>
          <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Waarom bedrijven voor ons kiezen</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {pijlers.map((p) => (
              <div key={p.t} className="rounded-xl border border-line bg-white p-6">
                <h3 className="text-base font-bold text-ink-900">{p.t}</h3>
                <p className="mt-2 text-sm text-warm">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x py-16">
        <h2 className="text-2xl font-extrabold sm:text-3xl">Hoe het werkt</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stappen.map((s) => (
            <li key={s.nr} className="rounded-xl border border-line bg-white p-5 shadow-soft">
              <span className="font-display text-2xl font-extrabold text-amber-500">{s.nr}</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">{s.t}</h3>
              <p className="mt-2 text-sm text-warm">{s.d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-warm">Lever je logo het liefst als vectorbestand aan (AI, EPS of PDF). Heb je alleen een afbeelding, <Link href="/kledingadvies" className="font-semibold text-amber-600 hover:underline">vraag dan even advies</Link>, dan kijken we naar de beste oplossing.</p>
      </section>

      <section className="container-x pb-4">
        <p className="eyebrow">Compleet assortiment</p>
        <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">A-merken die we personaliseren</h2>
        <p className="mt-3 max-w-2xl text-warm">We bedrukken en borduren op werkkleding van gerenommeerde merken, zodat functie en uitstraling allebei kloppen.</p>
      </section>
      <BrandStrip />

      <section className="border-y border-line bg-mist">
        <div className="container-x py-16">
          <p className="eyebrow">In 3 stappen</p>
          <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Van logo naar herkenbaar team</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            <li className="rounded-xl border-l-2 border-dashed border-amber-500 bg-white p-6 shadow-soft">
              <span className="font-display text-2xl font-extrabold text-amber-500">1</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">Vraag gratis advies aan</h3>
              <p className="mt-2 text-sm text-warm">Stuur je logo of vertel wat je zoekt. {site.owner.split(' ')[0]} neemt binnen 1 werkdag persoonlijk contact op.</p>
            </li>
            <li className="rounded-xl border-l-2 border-dashed border-amber-500 bg-white p-6 shadow-soft">
              <span className="font-display text-2xl font-extrabold text-amber-500">2</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">We komen langs en passen op locatie</h3>
              <p className="mt-2 text-sm text-warm">Samen kiezen we techniek, plaatsing en kleur, en bepalen we de juiste maten voor je team.</p>
            </li>
            <li className="rounded-xl border-l-2 border-dashed border-amber-500 bg-white p-6 shadow-soft">
              <span className="font-display text-2xl font-extrabold text-amber-500">3</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">Wij regelen bedrukking en levering</h3>
              <p className="mt-2 text-sm text-warm">Je logo brengen we in eigen huis aan. Je ziet vooraf het resultaat en nabestellen gaat met een belletje.</p>
            </li>
          </ol>
          <p className="mt-6 max-w-2xl text-warm">Je offerte is vrijblijvend en op maat. Of het nu om één jas of een compleet team gaat, we denken mee over techniek én budget. Geen kleine lettertjes, gewoon een eerlijk voorstel.</p>
          <div className="mt-6">
            <Link href="/kledingadvies" className="btn-primary">Vraag gratis kledingadvies aan</Link>
          </div>
        </div>
      </section>

      <Faq items={faq} />
      <CrossLinks exclude="/bedrukken-borduren" />
      <ContactSectie title="Je logo op de kleding? Laten we het bespreken"
        intro="Stuur je logo of vertel wat je zoekt. We laten je zien wat het mooiste resultaat geeft en maken een vrijblijvende offerte op maat." />
    </>
  );
}
