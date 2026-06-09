import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { artikelen, artikelenBySlug } from '@/content/kennisbank';
import { branchesBySlug } from '@/content/branches';
import { site } from '@/content/site';
import { CtaBand } from '@/components/CtaBand';
import { JsonLd } from '@/components/JsonLd';
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/jsonld';

export function generateStaticParams() {
  return artikelen.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = artikelenBySlug[slug];
  if (!a) return {};
  return {
    title: a.metaTitle,
    description: a.metaDescription,
    alternates: { canonical: `/kennisbank/${a.slug}` },
    openGraph: { title: a.metaTitle, description: a.metaDescription, url: `${site.url}/kennisbank/${a.slug}`, type: 'article' },
  };
}

export default async function ArtikelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = artikelenBySlug[slug];
  if (!a) notFound();
  const url = `${site.url}/kennisbank/${a.slug}`;
  const branche = a.relatedBranche ? branchesBySlug[a.relatedBranche] : null;
  const meer = artikelen.filter((x) => x.slug !== a.slug && x.category === a.category).slice(0, 3);

  return (
    <>
      <JsonLd data={articleJsonLd(a)} />
      <JsonLd data={breadcrumbJsonLd([
        { name: 'Home', url: site.url },
        { name: 'Kennisbank', url: `${site.url}/kennisbank` },
        { name: a.title, url },
      ])} />

      <section className="border-b border-line bg-mist">
        <div className="container-x py-12 sm:py-16">
          <nav className="text-xs text-warm" aria-label="Kruimelpad">
            <Link href="/" className="hover:text-amber-600">Home</Link>
            <span className="px-1.5">/</span>
            <Link href="/kennisbank" className="hover:text-amber-600">Kennisbank</Link>
          </nav>
          <p className="eyebrow mt-4">{a.category}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold text-balance sm:text-4xl">{a.title}</h1>
        </div>
      </section>

      <article className="container-x grid gap-12 py-14 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="text-lg font-medium leading-relaxed text-ink-800">{a.intro}</p>
          {a.sections.map((s) => (
            <div key={s.h} className="mt-8">
              <h2 className="text-xl font-extrabold sm:text-2xl">{s.h}</h2>
              <div className="prose-nl mt-3">
                {s.p.map((par, i) => <p key={i}>{par}</p>)}
              </div>
            </div>
          ))}
        </div>
        <aside className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-xl border-2 border-amber-500 bg-white p-6 shadow-card">
              <h2 className="text-lg font-extrabold text-ink-900">Vraag advies aan {site.owner.split(' ')[0]}</h2>
              <p className="mt-2 text-sm text-warm">Liever even sparren over jouw situatie? We denken vrijblijvend mee en komen langs om te passen.</p>
              <Link href="/kledingadvies" className="btn-primary mt-4 w-full">Gratis kledingadvies</Link>
              <a href={`tel:${site.phoneIntl}`} className="btn-outline mt-2 w-full">Bel {site.phone}</a>
            </div>
            {branche && (
              <Link href={`/branches/${branche.slug}`} className="block rounded-xl bg-mist p-5 hover:bg-ink-50">
                <span className="text-xs font-bold uppercase tracking-wide text-amber-600">Bekijk ook</span>
                <span className="mt-1 block font-bold text-ink-900">{branche.name}</span>
              </Link>
            )}
          </div>
        </aside>
      </article>

      {meer.length > 0 && (
        <section className="border-t border-line bg-mist">
          <div className="container-x py-12">
            <h2 className="text-xl font-extrabold sm:text-2xl">Meer over {a.category.toLowerCase()}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {meer.map((x) => (
                <Link key={x.slug} href={`/kennisbank/${x.slug}`} className="group rounded-lg border border-line bg-white p-5 shadow-soft transition hover:-translate-y-1 hover:border-amber-400">
                  <h3 className="text-base font-bold text-ink-900 group-hover:text-amber-600">{x.title}</h3>
                  <span className="mt-3 inline-block text-sm font-bold uppercase tracking-wide text-amber-600">Lees meer &rarr;</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <CtaBand />
    </>
  );
}
