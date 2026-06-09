import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { CtaBand } from '@/components/CtaBand';
import { artikelen, categorieen } from '@/content/kennisbank';

export const metadata: Metadata = {
  title: 'Kennisbank',
  description: 'Praktische uitleg over werkkleding, veiligheidsnormen, bedrukken, onderhoud en de regels eromheen. Geschreven door Frederiks Bedrijfskleding.',
  alternates: { canonical: '/kennisbank' },
};

export default function KennisbankPage() {
  return (
    <>
      <PageHero eyebrow="Kennisbank" title="Alles over werkkleding, helder uitgelegd"
        intro="Antwoorden op de vragen die we het vaakst krijgen: van veiligheidsklassen en hi-vis tot bedrukken, wassen en de fiscale regels. Praktisch en zonder verkooppraat." />
      {categorieen.map((cat) => {
        const items = artikelen.filter((a) => a.category === cat);
        if (!items.length) return null;
        return (
          <section key={cat} className="container-x py-10">
            <h2 className="text-xl font-extrabold sm:text-2xl">{cat}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((a) => (
                <Link key={a.slug} href={`/kennisbank/${a.slug}`}
                  className="group flex flex-col rounded-lg border border-line bg-white p-5 shadow-soft transition hover:-translate-y-1 hover:border-amber-400">
                  <h3 className="text-base font-bold text-ink-900 group-hover:text-amber-600">{a.title}</h3>
                  <p className="mt-2 grow text-sm text-warm line-clamp-3">{a.intro}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wide text-amber-600">Lees meer <span aria-hidden="true">&rarr;</span></span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      <div className="py-6" />
      <CtaBand title="Vraag het ons gewoon" text="Staat je vraag er niet bij? Bel of vraag gratis advies aan, we denken met je mee." />
    </>
  );
}
