import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { PakketConfigurator } from '@/components/PakketConfigurator';
import { TrustStrip } from '@/components/TrustStrip';
import { OnbelastCalculator } from '@/components/OnbelastCalculator';

export const metadata: Metadata = {
  title: 'Stel je werkkleding samen',
  description: 'Stel online je eigen bedrijfskledingpakket samen: kies kledingstuk, kleur en je logo, zie het direct, en vraag het als offerte aan bij Frederiks Bedrijfskleding.',
  alternates: { canonical: '/pakket-samenstellen' },
};

export default async function PakketPage({ searchParams }: { searchParams: Promise<{ branche?: string }> }) {
  const { branche } = await searchParams;
  return (
    <>
      <PageHero eyebrow="Stel je pakket samen" title="Ontwerp je werkkleding en zie je logo erop"
        intro="Kies een kledingstuk, een kleur en upload je logo om te zien hoe het eruitziet. Stel het pakket voor je team samen en vraag het vrijblijvend als offerte aan. Wij denken mee en komen langs om te passen." />
      <TrustStrip />
      <section className="container-x sec-md">
        <PakketConfigurator defaultBranche={branche ?? ''} />
      </section>
      <section id="onbelast" className="container-x scroll-mt-28 pb-16">
        <h2 className="kop-2">Onbelast of niet?</h2>
        <p className="mt-2 max-w-[62ch] text-warm">Kleding met een logo van minimaal 70 cm² mag je als werkgever onbelast geven. Zonder dat logo gaat het af van je vrije ruimte. Zo zie je wat dat voor jouw team scheelt.</p>
        <div className="mt-6"><OnbelastCalculator /></div>
      </section>
    </>
  );
}
