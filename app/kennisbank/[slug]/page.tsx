import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { artikelen, artikelenBySlug } from '@/content/kennisbank';
import { branchesBySlug } from '@/content/branches';
import { site } from '@/content/site';
import { CtaBand } from '@/components/CtaBand';
import { JsonLd } from '@/components/JsonLd';
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/jsonld';
import { Pijl } from '@/components/Pijl';

const MND = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
function fmtDate(d: string) { const t = d.split('-'); return parseInt(t[2],10) + ' ' + MND[parseInt(t[1],10)-1] + ' ' + t[0]; }

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
    openGraph: { title: a.metaTitle, description: a.metaDescription, url: `${site.url}/kennisbank/${a.slug}`, type: 'article', images: ['/Bedrijfskleding-bedrukken-en-borduren.jpg'] },
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

      <section className="border-b border-line bg-ink-900 text-white">
        <div className="border-t-2 border-dashed border-amber-500" aria-hidden="true" />
        <div className="container-x py-9 sm:py-12">
          <nav className="text-xs text-ink-300" aria-label="Kruimelpad">
            <Link href="/" className="hover:text-white">Home</Link>
            <span className="px-1.5">/</span>
            <Link href="/kennisbank" className="hover:text-white">Kennisbank</Link>
          </nav>
          <p className="eyebrow mt-4 text-amber-400">{a.category}</p>
          <h1 className="kop-1 mt-3 max-w-3xl text-balance text-white">{a.title}</h1>
          <p className="mt-4 text-sm text-ink-200">Door {site.owner}, eigenaar van Frederiks Bedrijfskleding · {fmtDate(a.date)}</p>
        </div>
      </section>

      <article className="container-x grid gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <p className="text-lg font-medium leading-relaxed text-ink-800">{a.intro}</p>
          {a.sections.map((s) => (
            <div key={s.h} className="mt-8">
              <h2 className="kop-2">{s.h}</h2>
              <div className="prose-nl mt-3">
                {s.p.map((par, i) => <p key={i}>{par}</p>)}
              </div>
            </div>
          ))}
        </div>
        <aside>
          <div className="sticky top-24 space-y-4">
            <div className="rounded-xl border-2 border-amber-500 bg-white p-6 shadow-card">
              <h2 className="text-lg font-extrabold text-ink-900">Vraag advies aan {site.owner.split(' ')[0]}</h2>
              <p className="mt-2 text-sm text-warm">Liever even sparren over jouw situatie? We denken vrijblijvend mee en komen langs om te passen.</p>
              <Link href="/kledingadvies" className="btn-primary mt-4 w-full">Gratis kledingadvies</Link>
              <a href={`tel:${site.phoneIntl}`} className="btn-outline mt-2 w-full">Bel {site.phone}</a>
            </div>
            {branche && (
              <Link href={`/branches/${branche.slug}`} className="block rounded-xl bg-mist p-5 hover:bg-ink-50">
                <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Bekijk ook</span>
                <span className="mt-1 block font-bold text-ink-900">{branche.name}</span>
              </Link>
            )}
          </div>
        </aside>
      </article>

      {meer.length > 0 && (
        <section className="border-t border-line bg-mist">
          <div className="container-x sec-md">
            <h2 className="kop-2">Meer over {a.category.toLowerCase()}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {meer.map((x) => (
                <Link key={x.slug} href={`/kennisbank/${x.slug}`} className="group flex items-center justify-between gap-3 rounded-xl border-2 border-ink-200 bg-white px-5 py-4 transition hover:-translate-y-0.5 hover:border-ink-900 hover:shadow-card h-full">
                  <h3 className="font-display text-[1.0625rem] font-extrabold leading-snug text-ink-900">{x.title}</h3>
                  <Pijl />
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
