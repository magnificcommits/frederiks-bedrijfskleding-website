import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { plaatsen, plaatsenBySlug } from '@/content/plaatsen';
import { branches } from '@/content/branches';
import { artikelen } from '@/content/kennisbank';
import { site } from '@/content/site';
import { CtaBand } from '@/components/CtaBand';
import { Reviews } from '@/components/Reviews';
import { PageHero } from '@/components/PageHero';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';

export function generateStaticParams() {
  return plaatsen.map((p) => ({ plaats: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ plaats: string }> }): Promise<Metadata> {
  const { plaats } = await params;
  const p = plaatsenBySlug[plaats];
  if (!p) return {};
  return {
    title: p.metaTitle,
    description: p.metaDescription,
    alternates: { canonical: `/regio/${p.slug}` },
    openGraph: { title: p.metaTitle, description: p.metaDescription, url: `${site.url}/regio/${p.slug}` },
  };
}

export default async function RegioPage({ params }: { params: Promise<{ plaats: string }> }) {
  const { plaats } = await params;
  const p = plaatsenBySlug[plaats];
  if (!p) notFound();
  const url = `${site.url}/regio/${p.slug}`;
  const andere = plaatsen.filter((x) => x.slug !== p.slug);
  const tips = artikelen.slice(0, 3);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([
        { name: 'Home', url: site.url },
        { name: 'Regio', url: `${site.url}/#regio` },
        { name: p.name, url },
      ])} />

      <PageHero eyebrow={`Bedrijfskleding ${p.name}`} title={`Bedrijfskleding in ${p.name}`} intro={p.intro} />

      <section className="container-x py-16">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="prose-nl text-lg">
              {p.body.map((par, i) => <p key={i}>{par}</p>)}
            </div>

            <h2 className="mt-10 text-2xl font-extrabold">Voor elke branche in {p.name}</h2>
            <p className="mt-3 text-warm">We stemmen de kleding af op je sector. Bekijk wat we per branche leveren:</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {branches.map((b) => (
                <Link key={b.slug} href={`/branches/${b.slug}`} className="group flex items-center justify-between rounded-lg border border-line bg-white px-4 py-3 transition hover:border-amber-400">
                  <span className="font-semibold text-ink-900 group-hover:text-amber-600">{b.navLabel}</span>
                  <span className="text-amber-600" aria-hidden="true">&rarr;</span>
                </Link>
              ))}
            </div>

            <div className="mt-10 rounded-xl bg-mist p-6">
              <p className="text-sm font-bold uppercase tracking-wide text-amber-600">Handig om te weten</p>
              <ul className="mt-3 space-y-2">
                {tips.map((a) => (
                  <li key={a.slug}><Link href={`/kennisbank/${a.slug}`} className="font-semibold text-ink-800 hover:text-amber-600">{a.title}</Link></li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-xl border-2 border-amber-500 bg-white p-6 shadow-card">
                <h2 className="text-lg font-extrabold text-ink-900">Bedrijfskleding nodig in {p.name}?</h2>
                <p className="mt-1 text-sm text-warm">{p.afstand}.</p>
                <p className="mt-2 text-sm text-warm">Vraag vrijblijvend advies aan. We nemen snel persoonlijk contact op.</p>
                <Link href="/kledingadvies" className="btn-primary mt-4 w-full">Gratis kledingadvies</Link>
                <a href={`tel:${site.phoneIntl}`} className="btn-outline mt-2 w-full">Bel {site.phone}</a>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <Reviews limit={3} />

      <section className="container-x py-12">
        <p className="text-sm text-warm">We werken door de hele Achterhoek. Ook actief in:{' '}
          {andere.map((x, i, arr) => (
            <span key={x.slug}>
              <Link href={`/regio/${x.slug}`} className="text-amber-600 hover:underline">{x.name}</Link>{i < arr.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      </section>

      <CtaBand title={`Klaar voor bedrijfskleding in ${p.name}?`} />
    </>
  );
}
