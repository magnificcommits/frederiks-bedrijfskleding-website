import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ContactSectie } from '@/components/ContactSectie';
import { ProductKaart } from '@/components/ProductKaart';
import { SelectieKnop } from '@/components/OfferteSelectie';
import { PrijsBlok } from '@/components/PrijsBlok';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { env } from '@/lib/env';
import { categorieVanSlug, getPubliekProduct, listPubliekeProducten, alleProductPaden, naarKaart } from '@/lib/kms/catalogus';

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
  if (!c || !p) notFound();

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
    url: `${env.siteUrl.replace(/\/$/, '')}/assortiment/${categorie}/${slug}`,
  };

  return (
    <>
      <JsonLd data={productJsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: 'Assortiment', url: '/assortiment' },
          { name: c.titel, url: `/assortiment/${c.slug}` },
          { name: p.naam, url: `/assortiment/${categorie}/${slug}` },
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
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-mist">
              {p.foto && (
                <Image src={p.foto} alt={p.naam} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-contain p-6" priority />
              )}
            </div>
            {p.fotos.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-3">
                {p.fotos.slice(1, 5).map((f) => (
                  <div key={f} className="relative aspect-square overflow-hidden rounded-lg border border-line bg-mist">
                    <Image src={f} alt="" fill sizes="25vw" className="object-contain p-2" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            {p.merk && (
              <Link href={`/merk/${p.merkSlug}`} className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700 hover:text-amber-800">
                {p.merk}
              </Link>
            )}
            <h1 className="mt-2 text-2xl font-bold text-balance sm:text-3xl">{p.naam}</h1>
            {p.omschrijving && <p className="mt-4 text-warm leading-relaxed">{p.omschrijving}</p>}

            <div className="mt-6"><PrijsBlok productId={p.id} /></div>

            {p.maten.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-semibold text-ink-900">Maten</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.maten.map((m) => (
                    <span key={m} className="rounded border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink-700">{m}</span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-warm">
                  Twijfel je over de maat? Bekijk de <Link href="/maattabellen" className="font-semibold text-amber-700 underline underline-offset-2">maattabellen</Link> of kom passen.
                </p>
              </div>
            )}

            {p.kleuren.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-ink-900">Kleuren ({p.kleuren.length})</p>
                <p className="mt-1.5 text-sm text-warm">{p.kleuren.slice(0, 12).join(' · ')}{p.kleuren.length > 12 ? ' en meer' : ''}</p>
              </div>
            )}

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

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href={`/offerte?product=${encodeURIComponent(`${p.merk ? p.merk + ' ' : ''}${p.naam}`)}`} className="btn-primary">
                Vraag offerte aan
              </Link>
              {/* Meerdere artikelen verzamelen en er in één keer een offerte voor
                  vragen; de balk onderin telt mee wat je hebt gekozen. */}
              <SelectieKnop
                className="h-11 px-4 text-sm"
                labels={{ uit: 'Meenemen in mijn offerte', aan: 'Staat in je offerte' }}
                item={{ id: p.id, naam: p.naam, merk: p.merk, categorieSlug: p.categorieSlug, slug: p.slug, foto: p.foto }}
              />
              <Link href="/pakket-samenstellen" className="btn-outline">Zet je logo erop</Link>
            </div>
            <p className="mt-3 text-xs text-warm">
              Bedrukken en borduren doen we in eigen huis in Hengelo Gld. Levering door heel de Achterhoek.
            </p>
          </div>
        </div>
      </section>

      {verwant.length > 0 && (
        <section className="border-t border-line bg-mist">
          <div className="container-x py-12">
            <h2 className="text-xl font-extrabold">Ook uit deze categorie</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {verwant.map((v) => <ProductKaart key={v.id} p={naarKaart(v)} />)}
            </div>
          </div>
        </section>
      )}

      <ContactSectie title="Past dit bij je team?" intro="Vertel ons met hoeveel mensen je werkt en waar ze mee bezig zijn. Wij komen met een voorstel, en passen doe je voordat je bestelt." />
    </>
  );
}
