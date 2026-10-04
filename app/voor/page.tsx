import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/content/site';
import { PageHero } from '@/components/PageHero';
import { ContactSectie } from '@/components/ContactSectie';
import { JsonLd } from '@/components/JsonLd';
import { RegioKaart } from '@/components/RegioKaart';
import { VakTegels } from '@/components/VakTegels';
import { breadcrumbJsonLd } from '@/lib/jsonld';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Werkkleding per vakgebied in de Achterhoek',
  description:
    'Werkkleding afgestemd op het vak: hoveniers, bouw, schilders, installatie, metaal, transport, agrarisch, horeca, zorg en kantoor. In de Achterhoek en de Liemers, met passen op locatie.',
  alternates: { canonical: '/voor' },
  openGraph: {
    title: 'Werkkleding per vakgebied in de Achterhoek',
    description:
      'Tien vakgebieden, elk met eigen eisen aan werkkleding. Bekijk wat er in jouw vak speelt en welke normen erbij horen.',
    url: `${site.url}/voor`,
  },
};

export default function VakgebiedenIndex() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: site.url },
          { name: 'Vakgebieden', url: `${site.url}/voor` },
        ])}
      />

      <PageHero
        eyebrow="Vakgebieden"
        title="Werkkleding per vakgebied in de Achterhoek"
        intro="Een lasser vraagt iets anders van zijn kleding dan een hovenier. Kies je vak en lees wat er in de praktijk misgaat en welke normen erbij horen."
        kruimels={[{ label: 'Home', href: '/' }]}
        beeld={<RegioKaart className="w-full lg:max-w-lg" />}
      />

      <section className="container-x sec-md">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
          <h2 className="kop-2">Kies je vak</h2>
          <p className="max-w-[52ch] text-sm text-warm">
            Weet je niet welke normen voor jouw werk gelden?{' '}
            <Link href="/normen" className="font-semibold text-amber-700 underline underline-offset-2">Bekijk het normenoverzicht</Link>{' '}
            of bel {site.phone}.
          </p>
        </div>
        <VakTegels uitgebreid className="mt-6" />
      </section>

      <ContactSectie
        title="Staat jouw vak er niet bij?"
        intro="We leveren aan veel meer bedrijven dan deze tien vakgebieden. Vertel wat voor werk je doet en met hoeveel mensen, dan denken we mee."
      />
    </>
  );
}
