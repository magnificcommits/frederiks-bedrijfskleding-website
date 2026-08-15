import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { PageHero } from '@/components/PageHero';
import { ProductMozaiek } from '@/components/ProductMozaiek';
import { ContactSectie } from '@/components/ContactSectie';
import { CrossLinks } from '@/components/CrossLinks';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { catalogusOverzicht, listPubliekeProducten } from '@/lib/kms/catalogus';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Merken werkkleding — waar we dealer van zijn',
  description:
    'Snickers Workwear, Fristads, Hydrowear, Tricorp en meer. Frederiks Bedrijfskleding in Hengelo Gld is dealer: je past het hier, wij regelen het logo en de levering.',
  alternates: { canonical: '/merk' },
};

export default async function MerkOverzicht() {
  const [{ merken, totaal }, alle] = await Promise.all([catalogusOverzicht(), listPubliekeProducten()]);

  // Per merk één foto als gezicht van de kaart. Logo's van leveranciers mogen we
  // niet zomaar plaatsen, een eigen productfoto wel — en die zegt ook meer.
  const merkenMetBeeld = merken.map((m) => ({
    ...m,
    foto: alle.find((p) => p.merk && p.merkSlug === m.slug && p.foto)?.foto ?? null,
  }));

  // Voor de kop: uit elk merk het eerste artikel met foto, zodat het mozaïek
  // vier verschillende merken laat zien in plaats van vier keer hetzelfde.
  const dwarsdoorsnede = merkenMetBeeld
    .map((m) => alle.find((p) => p.merkSlug === m.slug && p.foto))
    .filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Merken', url: '/merk' }])} />
      <PageHero
        eyebrow="Merken"
        title="De merken waar we dealer van zijn"
        intro={`${merken.length} merken, ${totaal} artikelen. Geen webshopvoorraad die we doorverkopen, maar collecties die we zelf op de werkvloer hebben getest.`}
        kruimels={[{ label: 'Assortiment', href: '/assortiment' }]}
        beeld={<ProductMozaiek producten={dwarsdoorsnede} />}
      />

      <section className="container-x py-14">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {merkenMetBeeld.map((m) => (
            <Link
              key={m.slug}
              href={`/merk/${m.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-card"
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-mist">
                {m.foto && (
                  <Image src={m.foto} alt="" fill sizes="80px" className="object-contain p-2" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-ink-900">{m.naam}</p>
                <p className="mt-0.5 text-sm text-warm">{m.aantal} artikelen</p>
                <p className="mt-1.5 text-xs font-bold uppercase tracking-wide text-amber-700 group-hover:underline">
                  Bekijk collectie
                </p>
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-8 max-w-2xl text-warm">
          Zit jouw merk er niet bij? Vraag het gerust. We leveren meer dan hier staat — dit is wat we online
          hebben staan, niet wat we kunnen bestellen.
        </p>
      </section>

      <CrossLinks />
      <ContactSectie
        title="Welk merk past bij jouw werk?"
        intro="Vertel wat je mensen doen en onder welke omstandigheden. Dan leggen we twee of drie opties naast elkaar, met de prijs erbij."
      />
    </>
  );
}
