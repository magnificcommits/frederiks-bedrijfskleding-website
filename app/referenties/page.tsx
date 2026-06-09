import type { Metadata } from 'next';
import Link from 'next/link';
import { Reviews } from '@/components/Reviews';
import { CtaBand } from '@/components/CtaBand';
import { PageHero } from '@/components/PageHero';
import { JsonLd } from '@/components/JsonLd';
import { faqJsonLd } from '@/lib/jsonld';
import { reviews } from '@/content/reviews';
import { branches } from '@/content/branches';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Referenties',
  description: 'Wat klanten zeggen over Frederiks Bedrijfskleding: persoonlijk advies, snelle levering en slijtvaste bedrukking. Ervaringen van bedrijven uit de Achterhoek.',
  alternates: { canonical: '/referenties' },
};

const stats = [
  { value: '5,0', label: 'gemiddelde waardering' },
  { value: '5 sterren', label: 'op elke beoordeling' },
  { value: 'Bouw tot horeca', label: 'branches die we kleden' },
];

export default function ReferentiesPage() {
  return (
    <>
      <JsonLd data={faqJsonLd(reviews.map((r) => ({ q: `Ervaring van ${r.author}`, a: r.text })))} />
      <PageHero eyebrow="Referenties" title="Bedrijven die ons al vertrouwen"
        intro="Van Overbeek Bouw en Goossens Melgers tot Café-zaal De Jongens en Getra Transport. Lees in hun eigen woorden hoe de samenwerking bevalt." />

      {/* Eén doorlopend donker blok: cijfers + reviews, geen harde wit-zwart-rand */}
      <section className="bg-ink-900 text-white">
        <div className="container-x pt-16">
          <div className="grid gap-5 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border-l-2 border-dashed border-amber-500 bg-white/5 p-6 text-center">
                <p className="font-display text-3xl font-extrabold text-amber-500">{s.value}</p>
                <p className="mt-1 text-sm text-ink-200">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <Reviews />
        <div className="container-x pb-16 text-center">
          <p className="text-ink-200">Ook zo geholpen worden?{' '}
            <Link href="/kledingadvies" className="font-semibold text-amber-400 hover:underline">Vraag gratis kledingadvies aan</Link>.
          </p>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
