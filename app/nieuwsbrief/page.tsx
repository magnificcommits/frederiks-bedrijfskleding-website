import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { NieuwsbriefForm } from '@/components/NieuwsbriefForm';

export const metadata: Metadata = {
  title: 'Nieuwsbrief',
  description:
    'Schrijf je in voor de nieuwsbrief van Frederiks Bedrijfskleding: nieuwe collecties, acties en praktische tips over werkkleding en normen. Geen wekelijkse spam.',
  alternates: { canonical: '/nieuwsbrief' },
};

export default function NieuwsbriefPage() {
  return (
    <>
      <PageHero
        eyebrow="Nieuwsbrief"
        title="Af en toe een mail die de moeite waard is"
        intro="Geen wekelijkse reclame. Alleen als er echt iets te melden is: een nieuwe collectie, een actie of een tip die je geld of gedoe scheelt."
      />
      <section className="container-x sec-md">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
          <div className="prose-nl">
            <h2 className="kop-3 text-ink-900">Wat er zoal in staat</h2>
            <ul>
              <li>Nieuwe werkkleding en schoenen die we zelf hebben gepast en goed vinden.</li>
              <li>Wanneer de wintercollectie binnen is, zodat je op tijd kunt bestellen.</li>
              <li>Uitleg over normen, zoals wanneer je echt EN ISO 20471 nodig hebt.</li>
              <li>Een actie of korting, als die er is.</li>
            </ul>
            <p>
              Na het aanmelden krijg je een mail met een bevestigingslink. Pas na die klik sturen we je iets. Afmelden kan onderaan elke
              nieuwsbrief, met één klik. Lees ook ons <Link href="/privacy">privacybeleid</Link>.
            </p>
          </div>
          <div className="self-start rounded-2xl border-2 border-amber-500 bg-white p-6 shadow-card">
            <h2 className="font-semibold text-ink-900">Aanmelden</h2>
            <p className="mt-1 text-sm text-warm">Alleen je e-mailadres, meer hebben we niet nodig.</p>
            <NieuwsbriefForm licht bron="nieuwsbriefpagina" />
          </div>
        </div>
      </section>
    </>
  );
}
