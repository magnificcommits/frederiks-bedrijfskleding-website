import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContactSectie } from '@/components/ContactSectie';
import { ProductKaart } from '@/components/ProductKaart';
import { ProductKoop } from '@/components/ProductKoop';
import { getPrijsindicatie, klasseVan } from '@/lib/kms/prijsindicatieData';
import { PrijsBlok } from '@/components/PrijsBlok';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { env } from '@/lib/env';
import { categorieVanSlug, getPubliekProduct, listPubliekeProducten, alleProductPaden, naarKaart, kleurFotosPubliek } from '@/lib/kms/catalogus';

export const revalidate = 3600;

export async function generateStaticParams() {
  return alleProductPaden();
}

export async function generateMetadata({ params }: { params: Promise<{ categorie: string; slug: string }> }): Promise<Metadata> {
  const { categorie, slug } = await params;
  const p = await getPubliekProduct(categorie, slug);
  if (!p) return {};
  const kort = (p.omschrijving ?? '').replace(/\s+/g, ' ').slice(0, 150).trim();
  return {
    title: `${p.merk ? `${p.merk} ` : ''}${p.naam}`,
    description: `${kort}${kort.length === 150 ? '…' : ''} Bij Frederiks Bedrijfskleding in Hengelo Gld, met jouw logo.`,
    alternates: { canonical: `/assortiment/${categorie}/${slug}` },
    openGraph: p.foto ? { images: [p.foto] } : undefined,
  };
}

export default async function ProductPagina({ params }: { params: Promise<{ categorie: string; slug: string }> }) {
  const { categorie, slug } = await params;
  const c = categorieVanSlug(categorie);
  const p = await getPubliekProduct(categorie, slug);
  const prijsInfo = await getPrijsindicatie();
  if (!c || !p) notFound();
  const kleurFotos = await kleurFotosPubliek(p.id);

  const verwant = (await listPubliekeProducten({ categorieSlug: categorie }))
    .filter((x) => x.id !== p.id && (p.merk ? x.merk === p.merk : true))
    .slice(0, 4);

  const specs: { label: string; waarde: string }[] = [
    p.merk ? { label: 'Merk', waarde: p.merk } : null,
    p.subcategorie ? { label: 'Soort', waarde: p.subcategorie } : null,
    p.geslacht ? { label: 'Uitvoering', waarde: p.geslacht } : null,
    p.materiaal ? { label: 'Materiaal', waarde: p.materiaal } : null,
    p.normeringen ? { label: 'Normen', waarde: p.normeringen } : null,
  ].filter((s): s is { label: string; waarde: string } => !!s);

  // Kruimel-URL's moeten absoluut zijn; relatieve ('/assortiment') keurt de Rich Results Test af.
  const basis = env.siteUrl.replace(/\/$/, '');

  // Product-schema zonder `offers`: er staat bewust geen publieke prijs op de
  // pagina, en een offers-blok zonder prijs is misleidend richting Google.
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.naam,
    description: p.omschrijving ?? undefined,
    image: p.fotos.length ? p.fotos : undefined,
    brand: p.merk ? { '@type': 'Brand', name: p.merk } : undefined,
    material: p.materiaal ?? undefined,
    category: p.categorie ?? undefined,
    url: `${basis}/assortiment/${categorie}/${slug}`,
  };

  return (
    <>
      <JsonLd data={productJsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: basis },
          { name: 'Assortiment', url: `${basis}/assortiment` },
          { name: c.titel, url: `${basis}/assortiment/${c.slug}` },
          { name: p.naam, url: `${basis}/assortiment/${categorie}/${slug}` },
        ])}
      />

      <div className="container-x pt-6">
        <nav aria-label="Kruimelpad" className="text-xs text-warm">
          <Link href="/assortiment" className="hover:text-ink-800">Assortiment</Link>
          <span className="mx-1.5">/</span>
          <Link href={`/assortiment/${c.slug}`} className="hover:text-ink-800">{c.titel}</Link>
        </nav>
      </div>

      <section className="container-x py-8">
        <ProductKoop
          p={{
            id: p.id, naam: p.naam, merk: p.merk, categorieSlug: p.categorieSlug, slug: p.slug,
            foto: p.foto, fotos: p.fotos, kleuren: p.kleuren, maten: p.maten, matenPerKleur: p.matenPerKleur,
          }}
          kleurFotos={kleurFotos}
          kop={
            <>
              {p.merk && (
                <Link href={`/merk/${p.merkSlug}`} className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700 hover:text-amber-800">
                  {p.merk}
                </Link>
              )}
              <h1 className="mt-2 text-2xl font-bold text-balance sm:text-3xl">{p.naam}</h1>
              {p.omschrijving && <p className="mt-4 text-warm leading-relaxed">{p.omschrijving}</p>}
              <div className="mt-6"><PrijsBlok productId={p.id} /></div>
            </>
          }
          onder={
            <>
              <p className="mt-3 text-xs text-warm">
                Bedrukken en borduren doen we in eigen huis in Hengelo Gld. Levering door heel de Achterhoek.
                Twijfel je over maat of model?{' '}
                <Link href="/afspraak" className="font-semibold text-amber-700 underline underline-offset-2" data-cta="afspraak">
                  Plan een adviesgesprek
                </Link>
                , dan nemen we pasmodellen mee.
              </p>

              {specs.length > 0 && (
                <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
                  {specs.map((s) => (
                    <div key={s.label} className="flex gap-4 py-2.5">
                      <dt className="w-32 shrink-0 text-warm">{s.label}</dt>
                      <dd className="text-ink-900">{s.waarde}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {(() => {
                const k = prijsInfo ? klasseVan(prijsInfo, p.id) : null;
                if (!k) return null;
                const tekst = { 1: 'voordelig binnen deze categorie', 2: 'middensegment', 3: 'topsegment' }[k];
                return (
                  <p className="mt-6 flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-warm">Prijsklasse</span>
                    <span className="font-display text-lg font-extrabold tracking-wider text-ink-900" aria-label={`${k} van 3`}>
                      {'€'.repeat(k)}
                      <span className="text-line">{'€'.repeat(3 - k)}</span>
                    </span>
                    <span className="text-warm">{tekst}. Jouw prijs zie je na inloggen of in je offerte.</span>
                  </p>
                );
              })()}
            </>
          }
        />
      </section>

      {verwant.length > 0 && (
        <section className="border-t border-line bg-mist">
          <div className="container-x py-12">
            <h2 className="text-xl font-extrabold">Ook uit deze categorie</h2>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {verwant.map((v) => <ProductKaart key={v.id} p={naarKaart(v)} />)}
            </div>
          </div>
        </section>
      )}

      <ContactSectie title="Past dit bij je team?" intro="Vertel ons met hoeveel mensen je werkt en waar ze mee bezig zijn. Wij komen met een voorstel, en passen doe je voordat je bestelt." />
    </>
  );
}
