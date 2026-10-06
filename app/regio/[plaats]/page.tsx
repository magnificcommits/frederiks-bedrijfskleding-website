import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { plaatsen, plaatsenBySlug } from '@/content/plaatsen';
import { branchesBySlug } from '@/content/branches';
import { artikelen } from '@/content/kennisbank';
import { Werkwijze } from '@/components/Werkwijze';
import { site } from '@/content/site';
import { ContactSectie } from '@/components/ContactSectie';
import { Reviews } from '@/components/Reviews';
import { PageHero } from '@/components/PageHero';
import { Faq } from '@/components/Faq';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, faqJsonLd, serviceJsonLd } from '@/lib/jsonld';
import { CtaKnoppen } from '@/components/CtaKnoppen';
import { BrancheArtikelen } from '@/components/BrancheArtikelen';
import { Pijl } from '@/components/Pijl';
import { Uitklap } from '@/components/Uitklap';

// De artikelenrij komt uit de catalogus; met ISR is dat één query per uur.
export const revalidate = 3600;

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
  const andere = plaatsen.filter((x) => x.slug !== p.slug).sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  const tips = artikelen.slice(0, 3);
  const populair = p.populair.map((s) => branchesBySlug[s]).filter(Boolean);
  const stats = [
    p.km
      ? { v: `${String(p.km).replace('.', ',')} km`, l: `hemelsbreed, ${p.afstand.replace('Ongeveer ', 'circa ').replace(' vanaf Hengelo', '')} rijden` }
      : { v: 'Thuisbasis', l: 'showroom in de Brouwersmolen' },
    { v: 'Op locatie', l: 'wij komen langs om te passen' },
    { v: 'Eigen huis', l: 'bedrukken en borduren' },
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
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="max-w-[68ch] text-lg text-warm">{p.body[0]}</p>
            {p.body.length > 1 && (
              <div className="mt-4 rounded-xl border border-line px-5">
                <Uitklap titel={`Meer over bedrijfskleding in ${p.name}`} samenvatting="Hoe we werken in de buurt en wat we leveren">
                  {p.body.slice(1).map((par, i) => <p key={i}>{par}</p>)}
                </Uitklap>
              </div>
            )}

            <h2 className="mt-10 font-display text-xl font-extrabold text-ink-900">Waar we werken in en rond {p.name}</h2>
            <p className="mt-3 text-warm">We komen door de hele omgeving langs, onder andere:</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {p.gebieden.map((g) => (
                <span key={g} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink-700">{g}</span>
              ))}
            </div>

            <h2 className="mt-10 font-display text-xl font-extrabold text-ink-900">Branches die we in {p.name} kleden</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {populair.map((b) => (
                <Link key={b.slug} href={`/branches/${b.slug}`} className="group flex items-center justify-between gap-3 rounded-xl border-2 border-ink-200 bg-white px-5 py-4 transition hover:-translate-y-0.5 hover:border-ink-900 hover:shadow-card">
                  <h3 className="font-display text-[1.0625rem] font-extrabold text-ink-900">{b.navLabel}</h3>
                  <Pijl />
                </Link>
              ))}
            </div>

            <div className="mt-10 rounded-xl bg-mist p-6">
              <h2 className="font-display text-lg font-extrabold text-ink-900">Handig om te weten</h2>
              <ul className="mt-3 space-y-2">
                {tips.map((a) => (
                  <li key={a.slug}><Link href={`/kennisbank/${a.slug}`} className="font-semibold text-ink-900 underline decoration-amber-500 decoration-2 underline-offset-4 hover:text-amber-800">{a.title}</Link></li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="sticky top-28 space-y-4">
              <div className="rounded-2xl border-2 border-amber-500 bg-white p-6 shadow-card">
                <h2 className="text-lg font-extrabold text-ink-900">Bedrijfskleding nodig in {p.name}?</h2>
                <p className="mt-1 text-sm text-warm">{p.afstand}.</p>
                <p className="mt-2 text-sm text-warm">Vrijblijvend. We reageren binnen 24 uur (werkdagen) en komen in {p.name} langs om te passen.</p>
                <CtaKnoppen plek="regio-zijbalk" vol bewijs={false} className="mt-4" />
                <p className="mt-4 border-t border-line pt-4 text-center text-sm text-warm" data-plek="regio-zijbalk">
                  of bel <a href={`tel:${site.phoneIntl}`} className="font-bold text-ink-900 hover:text-amber-800">{site.phone}</a>
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {populair[0] && (
        <BrancheArtikelen
          brancheSlug={populair[0].slug}
          titel={`Uit ons assortiment voor ${populair[0].navLabel.toLowerCase()}`}
          intro={`Een greep uit de catalogus. Ander vak? Bij het passen in ${p.name} kijken we wat bij jouw werk past.`}
        />
      )}

      <Werkwijze />

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
