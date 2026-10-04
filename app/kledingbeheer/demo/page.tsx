import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { DemoPoort } from '@/components/DemoPoort';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { site } from '@/content/site';
import { demoVideo } from '@/content/demo';

const heeftVideo = Boolean(demoVideo.video);

export const metadata: Metadata = {
  title: heeftVideo ? 'Demo van het kledingportaal bekijken' : 'Het kledingportaal bekijken',
  description:
    'Zie hoe je collega’s in het kledingportaal van Frederiks Bedrijfskleding zelf bestellen binnen hun functie, budget en maat, en hoe jij alleen de uitzonderingen goedkeurt.',
  alternates: { canonical: '/kledingbeheer/demo' },
};

export default function DemoPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: site.url },
          { name: 'Kledingbeheer', url: `${site.url}/kledingbeheer` },
          { name: 'Demo', url: `${site.url}/kledingbeheer/demo` },
        ])}
      />
      <PageHero
        eyebrow="Kledingbeheer"
        title={heeftVideo ? `Zie het kledingportaal in ${demoVideo.duur}` : 'Kijk zelf rond in het kledingportaal'}
        intro="Hoe je collega’s zelf bestellen binnen hun functie, budget en maat, en hoe jij alleen nog de uitzonderingen goedkeurt."
        kruimels={[{ label: 'Home', href: '/' }, { label: 'Kledingbeheer', href: '/kledingbeheer' }]}
        punten={['Geen app en geen wachtwoord', 'Inbegrepen bij je bedrijfskleding', 'Binnen vier weken ingericht']}
      />
      <section className="bg-mist">
        <div className="container-x sec-md">
          <DemoPoort />
        </div>
      </section>
    </>
  );
}
