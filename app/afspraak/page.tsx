import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { AfspraakKiezer } from '@/components/AfspraakKiezer';
import { JessiPaneel } from '@/components/JessiPaneel';
import { Uitklap } from '@/components/Uitklap';
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
        donker
        eyebrow="Afspraak maken"
        title="Prik zelf een moment met Jessi"
        intro="Bellen, langskomen in de showroom of passen bij jou op de zaak. In drie stappen staat het in je agenda."
        punten={['Direct bevestigd', 'Gratis en vrijblijvend', 'Zelf te verzetten']}
      />
      <section className="bg-mist">
        <div className="container-x sec-md grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8">
          <AfspraakKiezer standaardSoort={isSoort(soort) ? soort : undefined} bron="Afsprakenpagina" />
          <aside className="space-y-4 self-start lg:sticky lg:top-28">
            <JessiPaneel
              plek="afspraak-zijbalk"
              afspraak={false}
              kop="Liever meteen bellen?"
              tekst="Dat kan ook. Je krijgt Jessi zelf aan de lijn en prikt samen een moment."
              punten={[]}
            />
            <div className="rounded-2xl border border-line bg-white px-5">
              <Uitklap titel="Waar is de showroom?">
                <p>{site.address.street}, {site.address.postalCode} {site.address.city}. {site.address.locationNote}</p>
              </Uitklap>
              <Uitklap titel="Hoe werkt een pasdag?">
                <p>
                  Jessi komt met pasmaten van de kleding die jullie overwegen. Iedereen past op zijn eigen moment, wij noteren de maten.
                  Zo voorkom je retouren en hoeft niemand een middag naar Hengelo.
                </p>
              </Uitklap>
              <Uitklap titel="Kan ik verzetten?">
                <p>Ja. In de bevestigingsmail staat een link waarmee je zelf een ander moment kiest of annuleert.</p>
              </Uitklap>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
