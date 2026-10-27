import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import VoorwaardenTekst from '@/components/VoorwaardenTekst';

export const metadata: Metadata = {
  title: 'Algemene voorwaarden',
  description: 'De algemene voorwaarden van Frederiks Bedrijfskleding voor zakelijke offertes, bestellingen, leveringen en het online kledingportaal.',
  alternates: { canonical: '/algemene-voorwaarden' },
  robots: { index: false, follow: true },
};

export default function VoorwaardenPage() {
  return (
    <>
      <PageHero eyebrow="Juridisch" title="Algemene voorwaarden" />
      <section className="container-lees py-16">
        <VoorwaardenTekst />
      </section>
    </>
  );
}
