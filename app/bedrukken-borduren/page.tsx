import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { CtaBand } from '@/components/CtaBand';
import { Faq } from '@/components/Faq';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Bedrukken en borduren',
  description: 'Werkkleding bedrukken of borduren in eigen huis. Je logo strak, slijtvast en snel aangebracht, door Frederiks Bedrijfskleding in de Achterhoek.',
  alternates: { canonical: '/bedrukken-borduren' },
};

const stappen = [
  { nr: '01', t: 'Logo aanleveren', d: 'Stuur je logo, het liefst als vectorbestand (AI, EPS of PDF). Heb je dat niet, dan maken we het samen in orde.' },
  { nr: '02', t: 'Techniek kiezen', d: 'We adviseren per kledingstuk: bedrukken voor kleur en grote oplagen, borduren voor een verzorgde, duurzame look.' },
  { nr: '03', t: 'Proef en plaatsing', d: 'We bepalen de positie en grootte en laten je het resultaat zien voordat de hele order de deur uit gaat.' },
  { nr: '04', t: 'Aanbrengen in eigen huis', d: 'Omdat we het zelf doen, schakelen we snel en houden we de kwaliteit in de hand.' },
];

const faq = [
  { q: 'Wat is het verschil tussen bedrukken en borduren?', a: 'Bedrukken is ideaal voor kleurrijke logo’s en grotere oplagen. Borduren oogt verzorgd en luxe en gaat uitstekend door de was, vaak de keuze voor polo’s, jassen en horecakleding. Per kledingstuk bekijken we wat het mooiste resultaat geeft.' },
  { q: 'Kan ik mijn eigen logo aanleveren?', a: 'Ja. Lever het bij voorkeur als vectorbestand aan (AI, EPS of PDF). Heb je dat niet, dan kijken we samen naar de beste oplossing.' },
  { q: 'Hoe snel is het klaar?', a: 'Omdat we in eigen huis bedrukken en borduren, kunnen we snel schakelen. De levertijd hangt af van het artikel en de oplage. We laten het je vooraf weten.' },
  { q: 'Kunnen jullie ook losse kleding bedrukken die ik al heb?', a: 'In veel gevallen wel. Neem contact op met wat je hebt, dan kijken we of de stof en het type zich lenen voor bedrukken of borduren.' },
];

export default function BedrukkenPage() {
  return (
    <>
      <PageHero eyebrow="Maatwerk en branding" title="Bedrukken en borduren in eigen huis"
        intro="Je kleding wordt een visitekaartje. We brengen je logo strak en slijtvast aan, bedrukt of geborduurd, in eigen huis en dus snel." />
      <section className="container-x py-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line shadow-card">
            <Image src="/Bedrijfskleding-bedrukken-en-borduren.jpg" alt="Bedrukte en geborduurde bedrijfskleding van Frederiks Bedrijfskleding"
              fill sizes="(max-width: 1024px) 90vw, 45vw" className="object-cover" />
          </div>
          <div className="grid gap-5">
            <div className="seam-card p-6">
              <h2 className="text-xl font-extrabold text-ink-900">Bedrukken</h2>
              <p className="mt-2 text-warm">Ideaal voor kleurrijke logo’s, teksten en grotere oplagen. Strak resultaat op shirts, polo’s, sweaters en jassen.</p>
            </div>
            <div className="seam-card p-6">
              <h2 className="text-xl font-extrabold text-ink-900">Borduren</h2>
              <p className="mt-2 text-warm">Verzorgd en duurzaam. Gaat goed door de was en geeft een professionele uitstraling. Vaak de keuze voor representatieve en horecakleding.</p>
            </div>
          </div>
        </div>

        <h2 className="mt-16 text-2xl font-extrabold sm:text-3xl">Hoe het werkt</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stappen.map((s) => (
            <li key={s.nr} className="rounded-xl border border-line bg-white p-5 shadow-card">
              <span className="font-display text-2xl font-extrabold text-amber-500">{s.nr}</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">{s.t}</h3>
              <p className="mt-2 text-sm text-warm">{s.d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-warm">Logo al klaar? <Link href="/kledingadvies" className="font-semibold text-amber-600 hover:underline">Vraag advies aan</Link> of bel {site.phone}, dan laten we je zien wat het mooiste staat.</p>
      </section>
      <Faq items={faq} />
      <CtaBand title="Je logo op de kleding?" text="Stuur je logo of vraag advies. We laten je zien wat het beste resultaat geeft." />
    </>
  );
}
