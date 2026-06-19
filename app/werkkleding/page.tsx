import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { PageHero } from '@/components/PageHero';
import { BrandStrip } from '@/components/BrandStrip';
import { CrossLinks } from '@/components/CrossLinks';
import { ContactSectie } from '@/components/ContactSectie';
import { werkwijze } from '@/content/werkwijze';
import { branches } from '@/content/branches';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Werkkleding',
  description: 'Hoogwaardige werkkleding in de Achterhoek voor bouw, techniek, horeca, zorg en meer. A-merken, persoonlijk advies, passen op locatie en eigen bedrukken.',
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
      <PageHero eyebrow="Assortiment" title="De werkkledingspecialist in de Achterhoek"
        intro="Hoogwaardige werkkleding die voldoet aan de eisen op het gebied van kwaliteit, comfort en veiligheid. Of je nu zzp’er bent of een groot team aanstuurt, we helpen je de juiste keuze te maken." />
      <BrandStrip />

      <section className="container-x py-16">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold sm:text-3xl">Een compleet assortiment A-merken</h2>
            <div className="prose-nl mt-4 text-lg">
              <p>Goede werkkleding is meer dan een outfit, het is onderdeel van je werkdag. Onze collectie bestaat uit producten van topmerken die staan voor duurzaamheid, comfort en veiligheid: werkbroeken met extra sterke stiksels, ademende veiligheidskleding en schoeisel dat je voeten de hele dag ondersteunt.</p>
              <p>We werken met merken als Tricorp, Snickers Workwear, Mascot en U-Power. We kiezen niet de duurste of de goedkoopste, maar wat past bij jouw werk. Grote maten regelen we zonder gedoe, en past een model net niet, dan bestellen we een pasmaat.</p>
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
            <div key={c.t} className="rounded-lg border-l-2 border-dashed border-amber-500 bg-white p-5 shadow-soft">
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
              <Link key={b.slug} href={`/branches/${b.slug}`} className="group flex items-center justify-between rounded-lg border border-line bg-white px-5 py-4 transition hover:border-amber-400">
                <span className="font-semibold text-ink-900 group-hover:text-amber-600">{b.navLabel}</span>
                <span className="text-amber-600" aria-hidden="true">&rarr;</span>
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
            <li key={s.nr} className="rounded-xl border border-line bg-white p-5 shadow-soft">
              <span className="font-display text-2xl font-extrabold text-amber-500">{s.nr}</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">{s.title}</h3>
              <p className="mt-2 text-sm text-warm">{s.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-warm">Niet zeker wat je nodig hebt? <Link href="/kledingadvies" className="font-semibold text-amber-600 hover:underline">Vraag gratis kledingadvies aan</Link> of bel {site.phone}.</p>
      </section>

      <section className="border-y border-line bg-mist">
        <div className="container-x py-16">
          <p className="eyebrow">In 3 stappen</p>
          <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Zo komt jouw werkkleding rond</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            <li className="rounded-xl border-l-2 border-dashed border-amber-500 bg-white p-6 shadow-soft">
              <span className="font-display text-2xl font-extrabold text-amber-500">1</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">Vraag gratis advies aan</h3>
              <p className="mt-2 text-sm text-warm">Vertel ons wat je zoekt. {site.owner.split(' ')[0]} neemt binnen 1 werkdag persoonlijk contact op.</p>
            </li>
            <li className="rounded-xl border-l-2 border-dashed border-amber-500 bg-white p-6 shadow-soft">
              <span className="font-display text-2xl font-extrabold text-amber-500">2</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">We komen langs en passen op locatie</h3>
              <p className="mt-2 text-sm text-warm">Bij jou op de zaak bepalen we samen de juiste modellen en maten. Jij raakt geen werktijd kwijt.</p>
            </li>
            <li className="rounded-xl border-l-2 border-dashed border-amber-500 bg-white p-6 shadow-soft">
              <span className="font-display text-2xl font-extrabold text-amber-500">3</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">Wij regelen bedrukking en levering</h3>
              <p className="mt-2 text-sm text-warm">Je logo brengen we in eigen huis aan. Nabestellen gaat daarna met een belletje.</p>
            </li>
          </ol>
          <p className="mt-6 max-w-2xl text-warm">Je offerte is vrijblijvend en op maat. We kijken naar wat past bij je werk én denken mee over je budget. Geen kleine lettertjes, gewoon een eerlijk voorstel.</p>
          <div className="mt-6">
            <Link href="/kledingadvies" className="btn-primary">Vraag gratis kledingadvies aan</Link>
          </div>
        </div>
      </section>

      <CrossLinks exclude="/werkkleding" />
      <ContactSectie />
    </>
  );
}
