import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHero } from '@/components/PageHero';
import { ProductMozaiek } from '@/components/ProductMozaiek';
import { ContactSectie } from '@/components/ContactSectie';
import { Assortimentslijst } from '@/components/Assortimentslijst';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { CATEGORIEEN, categorieVanSlug, listPubliekeProducten, naarKaart } from '@/lib/kms/catalogus';

export const revalidate = 3600;
export function generateStaticParams() {
  return CATEGORIEEN.map((c) => ({ categorie: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ categorie: string }> }): Promise<Metadata> {
  const { categorie } = await params;
  const c = categorieVanSlug(categorie);
  if (!c) return {};
  return {
    title: `${c.titel} met eigen logo`,
    description: `${c.intro} Van Frederiks Bedrijfskleding in Hengelo Gld — advies, passen op locatie en bedrukken of borduren in eigen huis.`,
    alternates: { canonical: `/assortiment/${c.slug}` },
  };
}

export default async function CategoriePagina({ params }: { params: Promise<{ categorie: string }> }) {
  const { categorie } = await params;
  const c = categorieVanSlug(categorie);
  if (!c) notFound();
  const producten = await listPubliekeProducten({ categorieSlug: categorie });
  if (producten.length === 0) notFound();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: 'Assortiment', url: '/assortiment' },
          { name: c.titel, url: `/assortiment/${c.slug}` },
        ])}
      />
      <PageHero
        eyebrow="Assortiment"
        title={c.titel}
        intro={c.intro}
        kruimels={[{ label: 'Assortiment', href: '/assortiment' }]}
        beeld={<ProductMozaiek producten={producten} />}
      />

      <section className="container-x py-12">
        <Assortimentslijst producten={producten.map(naarKaart)} />

        <p className="mt-8 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">
          Prijzen staan niet online. Klanten zien hun eigen prijzen in het{' '}
          <Link href="/portaal" className="font-semibold text-amber-700 underline underline-offset-2">klantportaal</Link>; vraag anders een offerte aan — dan reken je meteen met je staffel en je bedrukking.
        </p>
      </section>

      <ContactSectie
        title={`Advies over ${c.titel.toLowerCase()}?`}
        intro="Vertel waar je mee werkt en met hoeveel mensen, dan zoeken we uit wat past. Passen doe je bij ons op locatie of we komen naar je toe."
      />
    </>
  );
}
