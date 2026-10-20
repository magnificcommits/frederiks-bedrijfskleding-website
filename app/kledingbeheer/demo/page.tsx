import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { PortaalDemo, PortaalFragmenten } from '@/components/PortaalDemo';
import { CtaBand } from '@/components/CtaBand';
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

/**
 * Demo van het kledingportaal, vrij te bekijken. Eerder zat de demo achter een
 * formulier; Jessi wil geen formulieren (werkdocument 20 okt 2026), dus nu
 * direct zichtbaar met daaronder WhatsApp, mail en bellen.
 */
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
        punten={['Gratis bij je bedrijfskleding', 'Je bepaalt zelf of je het gebruikt', 'Werkt op computer en telefoon']}
      />
      <section className="bg-mist">
        <div className="container-x sec-md">
          <div className="overflow-hidden rounded-2xl bg-ink-900 shadow-card">
            {heeftVideo ? (
              <video className="aspect-video w-full" controls playsInline preload="metadata" poster={demoVideo.poster || undefined} src={demoVideo.video}>
                Je browser kan deze video niet afspelen.
              </video>
            ) : (
              <div className="p-4 sm:p-6">
                <PortaalDemo />
                <PortaalFragmenten className="mt-6" />
              </div>
            )}
          </div>
        </div>
      </section>
      <CtaBand title="Past het kledingportaal bij jullie?" text="Vertel me hoe jullie de bedrijfskleding nu regelen. Ik laat je graag zien wat het portaal voor jullie kan doen." plek="demo" />
    </>
  );
}
