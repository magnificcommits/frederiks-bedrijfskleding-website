import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { BrandStrip } from '@/components/BrandStrip';
import { CrossLinks } from '@/components/CrossLinks';
import { ContactSectie } from '@/components/ContactSectie';
import { Faq } from '@/components/Faq';
import { JsonLd } from '@/components/JsonLd';
import { faqJsonLd } from '@/lib/jsonld';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Werkschoenen en veiligheidsschoenen',
  description: 'Veilige, comfortabele werkschoenen in de Achterhoek voor bouw, logistiek, industrie en agrarisch werk. Klassen S1 tot S7, A-merken en persoonlijk pasadvies.',
  alternates: { canonical: '/werkschoenen' },
};

const klassen = [
  { k: 'S1 / S1P', d: 'Lichte, gesloten schoen voor droge binnenruimtes. S1P heeft een doorstapbescherming.' },
  { k: 'S3', d: 'Waterafstotend, met doorstapbescherming en stevige zool. De meest gekozen klasse voor bouw en buitenwerk.' },
  { k: 'S6 / S7', d: 'Nieuw sinds de norm uit 2022: volledig waterdichte schoenen (S6 op basis van S2, S7 op basis van S3).' },
  { k: 'Antislip (keuken)', d: 'Voor de horeca: schoenen met antislipzool en demping voor lange diensten.' },
];

const faq = [
  { q: 'Welke veiligheidsklasse heb ik nodig?', a: 'Dat hangt af van je werk. S1(P) voor droge binnenruimtes, S3 voor buiten en nat werk met doorstapbescherming, S7 als je volledig waterdicht wilt. We bepalen samen wat past, zodat je niet betaalt voor bescherming die je niet gebruikt. Lees ook ons kennisbankartikel over schoenklassen.' },
  { q: 'Kan ik schoenen passen voordat ik bestel?', a: 'Ja. Goed passende schoenen zijn het halve werk. Een halve maat verkeerd voel je na acht uur. We zorgen voor passen, ook bij je op locatie.' },
  { q: 'Hebben jullie ook bredere modellen of inlegzolen?', a: 'Ja. Voor brede voeten of mensen met steunzolen kijken we naar modellen met meer ruimte of de mogelijkheid voor eigen inlegzolen.' },
  { q: 'Wat betekenen ESD, WR en SR op een schoen?', a: 'WR staat voor een volledig waterdichte schoen, SR voor een geteste antislipzool en ESD voor het afleiden van statische lading, belangrijk in de elektronica. We leggen per model uit wat de markering voor jou betekent.' },
];

export default function WerkschoenenPage() {
  return (
    <>
      <JsonLd data={faqJsonLd(faq)} />
      <PageHero eyebrow="Assortiment" title="Dé specialist in werkschoenen voor de Achterhoek"
        intro="Veilige, comfortabele schoenen die een hele werkdag goed blijven zitten. Met persoonlijk pasadvies en de juiste klasse voor jouw werk, of je nu in de bouw, de logistiek, de agrarische sector of de industrie werkt." />
      <BrandStrip />

      <section className="container-x py-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="prose-nl text-lg">
            <p>In de Achterhoek hechten we waarde aan hard werken, betrouwbaarheid en duurzaamheid. Die waarden zie je terug in onze collectie. We leveren uitsluitend merken die bekendstaan om hun lange levensduur, stevige constructie en goede bescherming: denk aan verstevigde of stalen neuzen, antislipzolen en modellen die tegen extreme temperaturen en ruwe ondergronden kunnen.</p>
            <p>Goede werkschoenen zijn meer dan schoeisel, het is onderdeel van elke werkdag. We helpen je niet alleen aan schoenen die voldoen aan de veiligheidsvoorschriften, maar zorgen ook dat ze comfortabel zitten en passen bij de aard van je werk. Bij ons krijg je een product én een service die past bij de no-nonsense mentaliteit van de regio.</p>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line shadow-card">
            <Image src="/veiligheidsschoenen-achterhoek-1.jpg" alt="Jessi toont een veiligheidsschoen in de showroom van Frederiks Bedrijfskleding"
              fill sizes="(max-width: 1024px) 90vw, 45vw" className="object-cover" />
          </div>
        </div>

        <h2 className="mt-16 text-2xl font-extrabold sm:text-3xl">De klassen op een rij</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {klassen.map((c) => (
            <div key={c.k} className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <h3 className="font-display text-lg font-extrabold text-amber-600">{c.k}</h3>
              <p className="mt-2 text-sm text-warm">{c.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-warm">Onze schoenen voldoen aan EN ISO 20345:2022. Twijfel je over de juiste klasse? <Link href="/kennisbank/veiligheidsklasse-werkschoenen-kiezen" className="font-semibold text-amber-600 hover:underline">Lees ons artikel over schoenklassen</Link> of <Link href="/kledingadvies" className="font-semibold text-amber-600 hover:underline">vraag advies aan</Link>.</p>
      </section>

      <section className="border-y border-line bg-mist">
        <div className="container-x py-16">
          <p className="eyebrow">In 3 stappen</p>
          <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Zo kies je samen met ons de juiste schoen</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            <li className="rounded-xl border-l-2 border-dashed border-amber-500 bg-white p-6 shadow-soft">
              <span className="font-display text-2xl font-extrabold text-amber-500">1</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">Vraag gratis advies aan</h3>
              <p className="mt-2 text-sm text-warm">Vertel ons over je werk. {site.owner.split(' ')[0]} neemt binnen 1 werkdag persoonlijk contact op.</p>
            </li>
            <li className="rounded-xl border-l-2 border-dashed border-amber-500 bg-white p-6 shadow-soft">
              <span className="font-display text-2xl font-extrabold text-amber-500">2</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">We komen langs en passen op locatie</h3>
              <p className="mt-2 text-sm text-warm">Goed passende schoenen zijn het halve werk. We laten je passen, ook bredere modellen of met eigen inlegzolen.</p>
            </li>
            <li className="rounded-xl border-l-2 border-dashed border-amber-500 bg-white p-6 shadow-soft">
              <span className="font-display text-2xl font-extrabold text-amber-500">3</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">Wij regelen de juiste klasse en levering</h3>
              <p className="mt-2 text-sm text-warm">Precies de bescherming die je nodig hebt, niet meer. Nabestellen gaat daarna met een belletje.</p>
            </li>
          </ol>
          <p className="mt-6 max-w-2xl text-warm">Je offerte is vrijblijvend en op maat. We kiezen wat past bij je werk en denken mee over je budget, zodat je niet betaalt voor bescherming die je niet gebruikt.</p>
          <div className="mt-6">
            <Link href="/kledingadvies" className="btn-primary">Vraag gratis kledingadvies aan</Link>
          </div>
        </div>
      </section>

      <Faq items={faq} />
      <CrossLinks exclude="/werkschoenen" />
      <ContactSectie title="Op zoek naar de juiste werkschoenen?" />
    </>
  );
}
