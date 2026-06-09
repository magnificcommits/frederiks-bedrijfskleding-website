import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { PageHero } from '@/components/PageHero';
import { BrandStrip } from '@/components/BrandStrip';
import { CtaBand } from '@/components/CtaBand';
import { werkwijze } from '@/content/werkwijze';
import { branches } from '@/content/branches';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Werkkleding',
  description: 'Werkkleding voor elke branche: werkbroeken, jassen, hi-vis, polo’s en meer. Topmerken, persoonlijk advies en eigen bedrukken in de Achterhoek.',
  alternates: { canonical: '/werkkleding' },
};

const categorieen = [
  { t: 'Werkbroeken', d: 'Met kniezakken, stevig dubbeldoek en een snit waarin je de hele dag werkt.' },
  { t: 'Jassen en softshells', d: 'Van lichte softshell tot gevoerde winterjas. Voor binnen, buiten en alles ertussenin.' },
  { t: 'Hi-vis kleding', d: 'Zichtbaarheidskleding volgens EN ISO 20471, in de juiste klasse voor jouw werk.' },
  { t: 'Shirts, polo’s en sweaters', d: 'Comfortabel en herkenbaar, met je logo bedrukt of geborduurd.' },
  { t: 'Bodywarmers en vesten', d: 'Een laag extra zonder dat je armen vastzitten.' },
  { t: 'Horeca- en zorgkleding', d: 'Koksbuizen, schorten, tunieken en jassen die de hete was aankunnen.' },
];

export default function WerkkledingPage() {
  return (
    <>
      <PageHero eyebrow="Assortiment" title="Werkkleding voor elke branche"
        intro="Van stevige werkbroeken en jassen tot hi-vis, polo’s en representatieve kleding. We kiezen niet de duurste of de goedkoopste, maar wat past bij jouw werk." />
      <BrandStrip />

      <section className="container-x py-16">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold sm:text-3xl">We kiezen op gebruik, niet op folder</h2>
            <div className="prose-nl mt-4 text-lg">
              <p>Werkkleding ziet er in de winkel allemaal prima uit. Het verschil merk je pas na een paar maanden wassen en werken. Daarom werken we met merken die zich bewezen hebben, zoals Tricorp, Snickers, Mascot en U-Power.</p>
              <p>We kijken eerst naar wat je doet. Een dakdekker heeft andere kleding nodig dan een kok of een buitendienstmedewerker. Op basis daarvan stellen we een set samen die klopt, in maten die echt passen. Grote maten regelen we zonder gedoe.</p>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line shadow-card">
            <Image src="/Bedrijfskleding-bedrukken-en-borduren.jpg" alt="Levering van bedrijfskleding bij Frederiks Bedrijfskleding in Hengelo"
              fill sizes="(max-width: 1024px) 90vw, 45vw" className="object-cover" />
          </div>
        </div>

        <h2 className="mt-16 text-2xl font-extrabold sm:text-3xl">Wat we leveren</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categorieen.map((c) => (
            <div key={c.t} className="seam-card">
              <h3 className="text-base font-bold text-ink-900">{c.t}</h3>
              <p className="mt-2 text-sm text-warm">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-mist">
        <div className="container-x py-16">
          <p className="eyebrow">Kies je branche</p>
          <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Bekijk wat we per sector leveren</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {branches.map((b) => (
              <Link key={b.slug} href={`/branches/${b.slug}`} className="group flex items-center justify-between rounded-xl border border-line bg-white px-5 py-4 transition hover:border-amber-400">
                <span className="font-semibold text-ink-900 group-hover:text-amber-600">{b.navLabel}</span>
                <span className="text-amber-600" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x py-16">
        <p className="eyebrow">Zo werken we</p>
        <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Van eerste gesprek tot nabestelling</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {werkwijze.map((s) => (
            <li key={s.nr} className="rounded-xl border border-line bg-white p-5 shadow-card">
              <span className="font-display text-2xl font-extrabold text-amber-500">{s.nr}</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">{s.title}</h3>
              <p className="mt-2 text-sm text-warm">{s.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-warm">Niet zeker wat je nodig hebt? <Link href="/kledingadvies" className="font-semibold text-amber-600 hover:underline">Vraag gratis kledingadvies aan</Link>, dan denken we met je mee. Of bel {site.phone}.</p>
      </section>

      <CtaBand />
    </>
  );
}
