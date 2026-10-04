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

export const revalidate = 3600;

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

      <section className="container-x sec-md">
        <div className="grid items-stretch gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className="flex flex-col justify-center">
            <h2 className="kop-2">Schoenen die na acht uur nog goed zitten</h2>
            <div className="prose-nl mt-5 text-lg">
              <p>We leveren alleen merken die bekendstaan om een lange levensduur en goede bescherming: stalen of composiet neuzen, antislipzolen en modellen voor kou, hitte en ruwe ondergrond.</p>
              <p>Veilig is het minimum. Daarna gaat het om pasvorm en comfort, want een halve maat verkeerd voel je aan het eind van de dag.</p>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { t: 'S1 tot S7', d: 'de juiste klasse voor je werk' },
                { t: 'Passen op locatie', d: 'wij nemen de maten mee' },
                { t: 'A-merken', d: 'Snickers, U-Power, Grisport en meer' },
              ].map((x) => (
                <li key={x.t} className="rounded-xl border-l-4 border-amber-500 bg-mist px-4 py-3">
                  <span className="block font-display font-extrabold text-ink-900">{x.t}</span>
                  <span className="text-sm text-warm">{x.d}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/kledingadvies" className="btn-primary" data-cta="schoenadvies">Vraag pasadvies aan</Link>
              <a href={`tel:${site.phoneIntl}`} className="btn-secondary">Bel {site.phone}</a>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line shadow-card lg:aspect-auto">
            <Image src="/veiligheidsschoenen-achterhoek-1.jpg" alt="Jessi toont een veiligheidsschoen in de showroom van Frederiks Bedrijfskleding"
              fill sizes="(max-width: 1024px) 90vw, 45vw" className="object-cover object-[50%_45%]" />
          </div>
        </div>

        <h2 className="mt-16 kop-2">De klassen op een rij</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {klassen.map((c) => (
            <div key={c.k} className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <h3 className="font-display text-lg font-extrabold text-amber-700">{c.k}</h3>
              <p className="mt-2 text-sm text-warm">{c.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-warm">Onze schoenen voldoen aan EN ISO 20345:2022. Twijfel je over de juiste klasse? <Link href="/kennisbank/veiligheidsklasse-werkschoenen-kiezen" className="font-semibold text-amber-700 hover:underline">Lees ons artikel over schoenklassen</Link> of <Link href="/kledingadvies" className="font-semibold text-amber-700 hover:underline">vraag advies aan</Link>.</p>
      </section>

      <section className="border-y border-line bg-mist">
        <div className="container-x sec-md">
          <h2 className="kop-2">Zo kies je samen met ons de juiste schoen</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            <li className="rounded-xl border-l-2 border-amber-500 bg-white p-6 shadow-soft">
              <span className="font-display text-2xl font-extrabold text-amber-500">1</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">Vraag gratis advies aan</h3>
              <p className="mt-2 text-sm text-warm">Vertel ons over je werk. {site.owner.split(' ')[0]} neemt binnen 24 uur persoonlijk contact op.</p>
            </li>
            <li className="rounded-xl border-l-2 border-amber-500 bg-white p-6 shadow-soft">
              <span className="font-display text-2xl font-extrabold text-amber-500">2</span>
              <h3 className="mt-2 text-base font-bold text-ink-900">We komen langs en passen op locatie</h3>
              <p className="mt-2 text-sm text-warm">Goed passende schoenen zijn het halve werk. We laten je passen, ook bredere modellen of met eigen inlegzolen.</p>
            </li>
            <li className="rounded-xl border-l-2 border-amber-500 bg-white p-6 shadow-soft">
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
