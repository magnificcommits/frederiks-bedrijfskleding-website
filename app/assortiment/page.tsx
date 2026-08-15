import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { ProductMozaiek } from '@/components/ProductMozaiek';
import { ContactSectie } from '@/components/ContactSectie';
import { CrossLinks } from '@/components/CrossLinks';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { catalogusOverzicht, listPubliekeProducten } from '@/lib/kms/catalogus';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Assortiment bedrijfskleding en werkkleding',
  description:
    'Bekijk het assortiment van Frederiks Bedrijfskleding: werkbroeken, jassen, polo’s, truien en veiligheidsschoenen van Snickers Workwear, Fristads, Hydrowear en meer. Kom passen in Hengelo Gld.',
  alternates: { canonical: '/assortiment' },
};

export default async function AssortimentPage() {
  const [{ categorieen, merken, totaal }, alle] = await Promise.all([
    catalogusOverzicht(),
    listPubliekeProducten(),
  ]);
  // Dwarsdoorsnede voor het mozaiek: uit elke categorie het eerste artikel,
  // zodat de kop laat zien hoe breed het assortiment is.
  const dwarsdoorsnede = categorieen
    .map((c) => alle.find((p) => p.categorieSlug === c.slug && p.foto))
    .filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Assortiment', url: '/assortiment' }])} />
      <PageHero
        eyebrow="Assortiment"
        title="Wat we voor je op voorraad en op bestelling hebben"
        intro={`${totaal} artikelen van elf merken. Alles met jouw logo, en je past het bij ons op locatie voordat je bestelt.`}
        beeld={<ProductMozaiek producten={dwarsdoorsnede} />}
      />

      <section className="container-x py-14">
        <h2 className="kop-2">Per categorie</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categorieen.map((c) => (
            <Link
              key={c.slug}
              href={`/assortiment/${c.slug}`}
              className="seam-card transition hover:-translate-y-0.5 hover:shadow-card"
            >
              <p className="font-display text-lg font-bold text-ink-900">{c.titel}</p>
              <p className="mt-1 text-sm text-warm">{c.intro}</p>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-amber-700">{c.aantal} artikelen</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-mist">
        <div className="container-x py-14">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="kop-2">Per merk</h2>
            <Link href="/merk" className="text-sm font-bold text-amber-700 hover:underline">
              Alle merken op een rij
            </Link>
          </div>
          <p className="mt-2 max-w-2xl text-warm">
            We werken met merken die we zelf hebben getest op de werkvloer. Zit jouw merk er niet bij? Vraag het gerust — we leveren meer dan hier staat.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {merken.map((m) => (
              <Link
                key={m.slug}
                href={`/merk/${m.slug}`}
                className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 transition hover:border-amber-400"
              >
                {m.naam}
                <span className="rounded bg-mist px-1.5 py-0.5 text-[11px] font-bold text-warm">{m.aantal}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CrossLinks exclude="/assortiment" />
      <ContactSectie
        title="Niet gevonden wat je zocht?"
        intro="Dit is een selectie. We leveren van elf merken en zoeken graag iets specifieks voor je op. Bel of stuur een bericht, dan komen we met een voorstel."
      />
    </>
  );
}
