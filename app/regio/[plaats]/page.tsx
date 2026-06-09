import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { plaatsen, plaatsenBySlug } from '@/content/plaatsen';
import { branches } from '@/content/branches';
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
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([
        { name: 'Home', url: site.url },
        { name: 'Regio', url: `${site.url}/#regio` },
        { name: p.name, url },
      ])} />

      <PageHero eyebrow={`Bedrijfskleding ${p.name}`} title={`Bedrijfskleding in ${p.name}`} intro={p.intro} />

      <section className="container-x py-16">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2 prose-nl">
            <p>{site.name} levert werkkleding, veiligheidsschoenen en maatwerk aan bedrijven in {p.name} en omgeving. U krijgt persoonlijk advies, we komen langs om te passen en uw logo brengen we in eigen beheer aan. Bedrukt of geborduurd.</p>
            <p><strong>Afstand:</strong> {p.afstand}.</p>
            <h2>Voor elke branche in {p.name}</h2>
            <p>We stemmen de kleding af op uw sector:</p>
            <ul>
              {branches.map((b) => (
                <li key={b.slug}><Link href={`/branches/${b.slug}`}>{b.name}</Link></li>
              ))}
            </ul>
          </div>
          <aside>
            <div className="card sticky top-24">
              <h3 className="text-lg font-semibold text-ink-800">Bedrijfskleding nodig in {p.name}?</h3>
              <p className="mt-2 text-sm text-warm">Vraag vrijblijvend advies aan. We nemen snel persoonlijk contact op.</p>
              <Link href="/offerte" className="btn-primary mt-4 w-full">Vraag advies aan</Link>
              <a href={`tel:${site.phoneIntl}`} className="btn-outline mt-2 w-full">Bel {site.phone}</a>
            </div>
          </aside>
        </div>
      </section>

      <Reviews limit={3} />
      <CtaBand title={`Klaar voor bedrijfskleding in ${p.name}?`} />
    </>
  );
}
