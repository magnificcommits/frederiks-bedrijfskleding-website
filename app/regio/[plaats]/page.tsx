import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { plaatsen, plaatsenBySlug } from '@/content/plaatsen';
import { branchesBySlug } from '@/content/branches';
import { artikelen } from '@/content/kennisbank';
import { werkwijze } from '@/content/werkwijze';
import { site } from '@/content/site';
import { ContactSectie } from '@/components/ContactSectie';
import { Reviews } from '@/components/Reviews';
import { PageHero } from '@/components/PageHero';
import { Faq } from '@/components/Faq';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, faqJsonLd, serviceJsonLd } from '@/lib/jsonld';

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
  const populair = p.populair.map((s) => branchesBySlug[s]).filter(Boolean);
  const stats = [
    { v: p.afstand.replace('Ongeveer ', '').replace('Onze thuisbasis', 'Thuisbasis'), l: 'vanaf onze showroom' },
    { v: 'Op locatie', l: 'wij komen langs om te passen' },
    { v: 'Eigen huis', l: 'bedrukken en borduren' },
  ];

  return (
    <>
      <JsonLd data={serviceJsonLd({ name: `Bedrijfskleding in ${p.name}`, description: p.metaDescription, url })} />
      <JsonLd data={faqJsonLd(p.faq)} />
      <JsonLd data={breadcrumbJsonLd([
        { name: 'Home', url: site.url },
        { name: 'Regio', url: `${site.url}/#regio` },
        { name: p.name, url },
      ])} />

      <PageHero eyebrow={`Bedrijfskleding ${p.name}`} title={`Bedrijfskleding in ${p.name}`} intro={p.intro} />

      {/* Statstrook */}
      <section className="border-b border-line bg-white">
        <div className="container-x grid gap-4 py-8 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.l} className="rounded-lg border-l-2 border-amber-500 bg-mist px-5 py-4">
              <p className="font-display text-lg font-extrabold text-ink-900">{s.v}</p>
              <p className="text-sm text-warm">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-x py-16">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="prose-nl text-lg">
              {p.body.map((par, i) => <p key={i}>{par}</p>)}
            </div>

            <h2 className="mt-10 text-2xl font-extrabold">Waar we werken in en rond {p.name}</h2>
            <p className="mt-3 text-warm">We komen door de hele omgeving langs, onder andere:</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {p.gebieden.map((g) => (
                <span key={g} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink-700">{g}</span>
              ))}
            </div>

            <h2 className="mt-10 text-2xl font-extrabold">Populair in {p.name}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {populair.map((b) => (
                <Link key={b.slug} href={`/branches/${b.slug}`} className="group rounded-lg border border-line bg-white p-5 shadow-soft transition hover:-translate-y-1 hover:border-amber-400">
                  <h3 className="text-base font-bold text-ink-900 group-hover:text-amber-800">{b.navLabel}</h3>
                  <p className="mt-2 text-sm text-warm line-clamp-2">{b.heroIntro}</p>
                </Link>
              ))}
            </div>

            <div className="mt-10 rounded-xl bg-mist p-6">
              <p className="text-sm font-bold uppercase tracking-wide text-amber-700">Handig om te weten</p>
              <ul className="mt-3 space-y-2">
                {tips.map((a) => (
                  <li key={a.slug}><Link href={`/kennisbank/${a.slug}`} className="font-semibold text-ink-800 hover:text-amber-800">{a.title}</Link></li>
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
                <Link href={`/kledingadvies`} className="btn-primary mt-4 w-full">Gratis kledingadvies</Link>
                <Link href="/pakket-samenstellen" className="btn-outline mt-2 w-full">Stel je pakket samen</Link>
                <a href={`tel:${site.phoneIntl}`} className="mt-2 block text-center text-sm font-bold text-ink-900 hover:text-amber-800">{site.phone}</a>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Werkwijze */}
      <section className="border-y border-line bg-mist">
        <div className="container-x py-16">
          <p className="eyebrow">Zo werken we</p>
          <h2 className="mt-3 kop-2">Van eerste gesprek tot nabestelling</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {werkwijze.map((s) => (
              <li key={s.nr} className="rounded-xl border border-line bg-white p-5">
                <span className="font-display text-2xl font-extrabold text-amber-500">{s.nr}</span>
                <h3 className="mt-2 text-base font-bold text-ink-900">{s.title}</h3>
                <p className="mt-2 text-sm text-warm">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Faq items={p.faq} title={`Veelgestelde vragen over bedrijfskleding in ${p.name}`} />

      <Reviews limit={3} />

      <section className="container-x py-12">
        <p className="text-sm text-warm">We werken door de hele Achterhoek. Ook actief in:{' '}
          {andere.map((x, i, arr) => (
            <span key={x.slug}>
              <Link href={`/regio/${x.slug}`} className="text-amber-700 hover:underline">{x.name}</Link>{i < arr.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      </section>

      <ContactSectie title={`Bedrijfskleding nodig in ${p.name}?`} />
    </>
  );
}
