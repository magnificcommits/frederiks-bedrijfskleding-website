import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHero } from '@/components/PageHero';
import { ProductMozaiek } from '@/components/ProductMozaiek';
import { ContactSectie } from '@/components/ContactSectie';
import { Assortimentslijst } from '@/components/Assortimentslijst';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { catalogusOverzicht, listPubliekeProducten, naarKaart } from '@/lib/kms/catalogus';

export const revalidate = 3600;

export async function generateStaticParams() {
  const { merken } = await catalogusOverzicht();
  return merken.map((m) => ({ merk: m.slug }));
}

async function merkVanSlug(slug: string) {
  const { merken } = await catalogusOverzicht();
  return merken.find((m) => m.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ merk: string }> }): Promise<Metadata> {
  const { merk } = await params;
  const m = await merkVanSlug(merk);
  if (!m) return {};
  return {
    title: `${m.naam} werkkleding`,
    description: `${m.naam} bij Frederiks Bedrijfskleding in Hengelo Gld: ${m.aantal} artikelen, met jouw logo geborduurd of bedrukt. Passen op locatie, levering door heel de Achterhoek.`,
    alternates: { canonical: `/merk/${m.slug}` },
  };
}

export default async function MerkPagina({ params }: { params: Promise<{ merk: string }> }) {
  const { merk } = await params;
  const m = await merkVanSlug(merk);
  if (!m) notFound();
  const producten = await listPubliekeProducten({ merkSlug: merk });

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: 'Assortiment', url: '/assortiment' },
          { name: 'Merken', url: '/merk' },
          { name: m.naam, url: `/merk/${m.slug}` },
        ])}
      />
      <PageHero
        eyebrow="Merk"
        title={`${m.naam} bij Frederiks`}
        intro={`${m.aantal} artikelen uit de collectie van ${m.naam}, met jouw logo erop. Wij zijn dealer, dus je past het hier en wij regelen de rest.`}
        kruimels={[{ label: 'Assortiment', href: '/assortiment' }, { label: 'Merken', href: '/merk' }]}
        beeld={<ProductMozaiek producten={producten} />}
      />
      <section className="container-x py-12">
        <Assortimentslijst producten={producten.map(naarKaart)} toonMerkfilter={false} />
      </section>
      <ContactSectie title={`Vraag over ${m.naam}?`} />
    </>
  );
}
