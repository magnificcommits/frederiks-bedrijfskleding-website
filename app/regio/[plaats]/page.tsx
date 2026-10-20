import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { plaatsen, plaatsenBySlug } from '@/content/plaatsen';
import { branchesBySlug } from '@/content/branches';
import { site } from '@/content/site';
import { ContactSectie } from '@/components/ContactSectie';
import { PageHero } from '@/components/PageHero';
import { Faq } from '@/components/Faq';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, faqJsonLd, serviceJsonLd } from '@/lib/jsonld';
import { CtaKnoppen } from '@/components/CtaKnoppen';
import { Pijl } from '@/components/Pijl';


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

/**
 * Regiopagina, ingekort op verzoek van Jessi (20 okt 2026): één alinea eigen
 * tekst, de branches, de veelgestelde vragen en contact. Weggehaald wat op elke
 * pagina hetzelfde was (werkwijze, reviews, kennisbanktips, zijbalk) en de
 * artikelen uit de catalogus.
 */
export default async function RegioPage({ params }: { params: Promise<{ plaats: string }> }) {
  const { plaats } = await params;
  const p = plaatsenBySlug[plaats];
  if (!p) notFound();
  const url = `${site.url}/regio/${p.slug}`;
  const andere = plaatsen.filter((x) => x.slug !== p.slug).sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  const populair = p.populair.map((s) => branchesBySlug[s]).filter(Boolean);
  const stats = [
    p.km
      ? { v: `${String(p.km).replace('.', ',')} km`, l: `hemelsbreed, ${p.afstand.replace('Ongeveer ', 'circa ').replace(' vanaf Hengelo', '')} rijden` }
      : { v: 'Thuisbasis', l: 'showroom in de Brouwersmolen' },
    { v: 'Op locatie', l: 'wij komen langs om te passen' },
    { v: 'Logo erop', l: 'bedrukken en borduren geregeld' },
  ];

  return (
    <>
      <JsonLd data={serviceJsonLd({ name: `Bedrijfskleding in ${p.name}`, description: p.metaDescription, url, plaats: p.name })} />
      <JsonLd data={faqJsonLd(p.faq)} />
      <JsonLd data={breadcrumbJsonLd([
        { name: 'Home', url: site.url },
        { name: 'Regio', url: `${site.url}/regio` },
        { name: p.name, url },
      ])} />

      <PageHero
        eyebrow={`Bedrijfskleding ${p.name}`}
        title={`Bedrijfskleding in ${p.name}`}
        intro={p.intro}
        kruimels={[{ label: 'Home', href: '/' }, { label: 'Regio', href: '/regio' }]}
        acties={<CtaKnoppen plek="regio-hero" />}
      />

      {/* Statstrook */}
      <section className="border-b border-line bg-white">
        <div className="container-x grid grid-cols-1 gap-4 py-8 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.l} className="rounded-lg border-l-2 border-amber-500 bg-mist px-5 py-4">
              <p className="font-display text-lg font-extrabold text-ink-900">{s.v}</p>
              <p className="text-sm text-warm">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-x sec-md">
        <div className="max-w-[68ch]">
          <p className="text-lg text-warm">{p.body[0]}</p>

          <h2 className="mt-8 font-display text-xl font-extrabold text-ink-900">Branches die we in {p.name} kleden</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {populair.map((b) => (
              <li key={b.slug}>
                <Link href={`/branches/${b.slug}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-ink-200 bg-white px-4 font-semibold text-ink-900 hover:border-ink-900">
                  {b.navLabel} <Pijl />
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-sm text-warm">
            Ook in de omgeving: {p.gebieden.join(', ')}.
          </p>
        </div>
      </section>

      <Faq items={p.faq} title={`Veelgestelde vragen over bedrijfskleding in ${p.name}`} />

      <section className="container-x pb-10">
        <p className="text-sm text-warm">Ook actief in:{' '}
          {andere.slice(0, 8).map((x, i, arr) => (
            <span key={x.slug}>
              <Link href={`/regio/${x.slug}`} className="text-amber-700 hover:underline">{x.name}</Link>{i < arr.length - 1 ? ', ' : ''}
            </span>
          ))}
          {' '}en <Link href="/regio" className="text-amber-700 hover:underline">meer plaatsen</Link>.
        </p>
      </section>

      <ContactSectie title={`Bedrijfskleding nodig in ${p.name}?`} />
    </>
  );
}
