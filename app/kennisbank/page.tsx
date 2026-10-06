import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { CtaBand } from '@/components/CtaBand';
import { artikelen, categorieen } from '@/content/kennisbank';
import { Pijl } from '@/components/Pijl';

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
      <section className="bg-mist">
        <div className="container-x sec-md gap-5 lg:columns-2">
          {categorieen.map((cat) => {
            const items = artikelen.filter((a) => a.category === cat);
            if (!items.length) return null;
            return (
              <section key={cat} className="mb-5 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                <h2 className="bg-ink-900 px-5 py-4 font-display text-xl font-extrabold text-white">
                  {cat} <span className="ml-1 text-sm font-semibold text-ink-300">{items.length}</span>
                </h2>
                <ul className="divide-y divide-line">
                  {items.map((a) => (
                    <li key={a.slug}>
                      <Link href={`/kennisbank/${a.slug}`} className="group flex min-h-[52px] items-center gap-4 px-5 py-3 transition hover:bg-mist sm:py-4">
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-[1.0625rem] font-extrabold leading-snug text-ink-900">{a.title}</span>
                          <span className="mt-1 block text-sm leading-snug text-warm line-clamp-2 max-sm:hidden">{a.intro}</span>
                        </span>
                        <Pijl />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </section>
      <CtaBand title="Vraag het ons gewoon" text="Staat je vraag er niet bij? Bel of vraag gratis advies aan, we denken met je mee." />
    </>
  );
}
