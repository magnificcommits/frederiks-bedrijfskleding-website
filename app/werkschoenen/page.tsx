import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { CtaBand } from '@/components/CtaBand';
import { Faq } from '@/components/Faq';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Werkschoenen en veiligheidsschoenen',
  description: 'Veiligheidsschoenen van S1 tot S3 en werkschoenen met persoonlijk pasadvies. Comfortabel voor lange dagen, bij Frederiks Bedrijfskleding in de Achterhoek.',
  alternates: { canonical: '/werkschoenen' },
};

const klassen = [
  { k: 'S1 / S1P', d: 'Lichte, gesloten schoen voor droge binnenomgevingen. S1P heeft een doorstapbescherming.' },
  { k: 'S3', d: 'Waterafstotend, met doorstapbescherming en stevige zool. De meest gekozen klasse voor bouw en buitenwerk.' },
  { k: 'S3S / S7', d: 'Nieuwere normklassen met extra bescherming. We leggen je uit wat het verschil voor jou betekent.' },
  { k: 'Antislip (keuken)', d: 'Voor de horeca: schoenen met antislipzool en demping voor lange diensten.' },
];

const faq = [
  { q: 'Welke veiligheidsklasse heb ik nodig?', a: 'Dat hangt af van je werk. S1 voor droge binnenruimtes, S3 voor buiten en nat werk met doorstapbescherming. We bepalen samen wat past, zodat je niet voor bescherming betaalt die je niet gebruikt.' },
  { q: 'Kan ik schoenen passen voordat ik bestel?', a: 'Ja. Goed passende schoenen zijn het halve werk. Een halve maat verkeerd voel je na acht uur. We zorgen voor passen, ook bij je op locatie.' },
  { q: 'Hebben jullie ook bredere modellen of inlegzolen?', a: 'Ja. Voor brede voeten of mensen met steunzolen kijken we naar modellen met meer ruimte of de mogelijkheid voor eigen inlegzolen.' },
];

export default function WerkschoenenPage() {
  return (
    <>
      <PageHero eyebrow="Assortiment" title="Werkschoenen en veiligheidsschoenen"
        intro="Veilige, comfortabele schoenen die een hele werkdag goed blijven zitten. Met persoonlijk pasadvies en de juiste klasse voor jouw werk." />
      <section className="container-x py-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="prose-nl text-lg">
            <p>Werkschoenen maken het verschil tussen een goede en een lange werkdag. We leveren veiligheidsschoenen van S1 tot S3, van lichte sportieve modellen tot stevige schoenen met doorstapbescherming voor buitenwerk.</p>
            <p>Comfort en pasvorm staan voorop. We helpen je de juiste maat en klasse te kiezen. En als een model net niet zit, bestellen we een pasmaat. Zo werkt je team veilig en zonder pijnlijke voeten.</p>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line shadow-card">
            <Image src="/veiligheidsschoenen-achterhoek-1.jpg" alt="Jessi toont een veiligheidsschoen in de showroom van Frederiks Bedrijfskleding"
              fill sizes="(max-width: 1024px) 90vw, 45vw" className="object-cover" />
          </div>
        </div>

        <h2 className="mt-16 text-2xl font-extrabold sm:text-3xl">De klassen op een rij</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {klassen.map((c) => (
            <div key={c.k} className="rounded-xl border border-line bg-white p-5 shadow-card">
              <h3 className="font-display text-lg font-extrabold text-amber-600">{c.k}</h3>
              <p className="mt-2 text-sm text-warm">{c.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-warm">Onze schoenen voldoen aan EN ISO 20345. Twijfel je over de juiste klasse? <Link href="/kledingadvies" className="font-semibold text-amber-600 hover:underline">Vraag advies aan</Link> of bel {site.phone}.</p>
      </section>
      <Faq items={faq} />
      <CtaBand title="Op zoek naar de juiste werkschoenen?" />
    </>
  );
}
