import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { AfspraakKiezer } from '@/components/AfspraakKiezer';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { site } from '@/content/site';
import { isSoort } from '@/lib/afspraken/soorten';

export const metadata: Metadata = {
  title: 'Afspraak maken: advies, showroom of pasdag op locatie',
  description:
    'Plan online een adviesgesprek, een bezoek aan de showroom in Hengelo (Gld) of een pasdag bij jou op het bedrijf. Kies zelf een moment, je krijgt meteen een bevestiging.',
  alternates: { canonical: '/afspraak' },
};

export default async function AfspraakPage({ searchParams }: { searchParams: Promise<{ soort?: string }> }) {
  const { soort } = await searchParams;
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: site.url },
          { name: 'Afspraak maken', url: `${site.url}/afspraak` },
        ])}
      />
      <PageHero
        eyebrow="Afspraak maken"
        title="Prik zelf een moment met Jessi"
        intro="Bellen, langskomen in de showroom of passen bij jou op de zaak. Kies hieronder wat past en wanneer. Je krijgt direct een bevestiging met de afspraak voor je agenda."
      />
      <section className="container-x sec-md">
        <div className="mx-auto grid max-w-[72rem] gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <AfspraakKiezer standaardSoort={isSoort(soort) ? soort : undefined} bron="Afsprakenpagina" />
          <aside className="space-y-6 text-sm text-warm">
            <div className="kaart-nadruk">
              <h2 className="font-semibold text-ink-900">Liever even bellen?</h2>
              <p className="mt-2">
                Dat kan natuurlijk ook. Bel of app{' '}
                <a href={`tel:${site.phoneIntl}`} className="font-semibold text-ink-900 hover:text-amber-800">
                  {site.phone}
                </a>
                .
              </p>
            </div>
            <div>
              <h2 className="font-semibold text-ink-900">Waar is de showroom?</h2>
              <p className="mt-2">
                {site.address.street}, {site.address.postalCode} {site.address.city}. {site.address.locationNote}
              </p>
            </div>
            <div>
              <h2 className="font-semibold text-ink-900">Hoe werkt een pasdag?</h2>
              <p className="mt-2">
                Jessi komt met pasmaten van de kleding die jullie overwegen. Iedereen past op zijn eigen moment, wij noteren de maten.
                Zo voorkom je retouren en hoeft niemand een middag naar Hengelo.
              </p>
            </div>
            <div>
              <h2 className="font-semibold text-ink-900">Kan ik verzetten?</h2>
              <p className="mt-2">Ja. In de bevestigingsmail staat een link waarmee je zelf een ander moment kiest of annuleert.</p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
