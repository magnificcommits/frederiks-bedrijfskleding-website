import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { branches, branchesBySlug } from '@/content/branches';
import { werkwijze } from '@/content/werkwijze';
import { site } from '@/content/site';
import { Faq } from '@/components/Faq';
import { ContactSectie } from '@/components/ContactSectie';
import { AfspraakSectie } from '@/components/AfspraakSectie';
import { JsonLd } from '@/components/JsonLd';
import { serviceJsonLd, faqJsonLd, breadcrumbJsonLd } from '@/lib/jsonld';
import { CtaKnoppen } from '@/components/CtaKnoppen';
import { BrancheArtikelen } from '@/components/BrancheArtikelen';

// De artikelenrij komt uit de catalogus; met ISR is dat één query per uur.
export const revalidate = 3600;

export function generateStaticParams() {
  return branches.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = branchesBySlug[slug];
  if (!b) return {};
  return {
    title: b.metaTitle,
    description: b.metaDescription,
    alternates: { canonical: `/branches/${b.slug}` },
    openGraph: { title: b.metaTitle, description: b.metaDescription, url: `${site.url}/branches/${b.slug}`, images: [b.image] },
  };
}

export default async function BranchePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = branchesBySlug[slug];
  if (!b) notFound();

  const url = `${site.url}/branches/${b.slug}`;
  return (
    <>
      <JsonLd data={serviceJsonLd({ name: b.name, description: b.metaDescription, url })} />
      {b.faq.length > 0 && <JsonLd data={faqJsonLd(b.faq)} />}
      {/* Geen tussenstap "Branches": daar is geen eigen pagina voor, en een
          #anker als kruimel-URL keurt Google af. */}
      <JsonLd data={breadcrumbJsonLd([
        { name: 'Home', url: site.url },
        { name: b.navLabel, url },
      ])} />

      {/* Split-hero */}
      <section className="border-b border-line bg-mist">
        <div className="container-x grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <nav className="text-xs text-warm" aria-label="Kruimelpad">
              <Link href="/" className="hover:text-amber-800">Home</Link>
              <span className="px-1.5">/</span>
              <Link href="/#branches" className="hover:text-amber-800">Branches</Link>
              <span className="px-1.5">/</span>
              <span className="text-ink-700">{b.navLabel}</span>
            </nav>
            <h1 className="mt-4 text-3xl font-extrabold text-balance sm:text-4xl lg:text-5xl">{b.name}</h1>
            <p className="mt-4 max-w-[52ch] text-lg text-warm">{b.heroIntro}</p>
            <CtaKnoppen
              plek="branche-hero"
              className="mt-7"
              offerteHref={`/offerte?branche=${encodeURIComponent(b.navLabel)}`}
              afspraakHref={`/afspraak?branche=${encodeURIComponent(b.navLabel)}`}
            />
            <p className="mt-2 text-sm text-warm" data-plek="branche-hero">
              Liever bellen? <a href={`tel:${site.phoneIntl}`} className="font-semibold text-ink-900 underline decoration-amber-500 underline-offset-4">{site.phone}</a>
            </p>
          </div>
          <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl border border-line shadow-card ${b.fit === 'contain' ? 'bg-ink-900' : ''}`}>
            <Image src={b.image} alt={b.name} fill priority sizes="(max-width: 1024px) 90vw, 45vw"
              className={b.fit === 'contain' ? 'object-contain p-3' : 'object-cover object-top'} />
          </div>
        </div>
      </section>

      {/* Body + sticky lead */}
      <section className="container-x py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <div className="prose-nl text-lg">
              {b.body.map((p, i) => <p key={i}>{p}</p>)}
            </div>

            <h2 className="mt-12 text-2xl font-extrabold">Wat we voor je verzorgen</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {b.levering.map((l) => (
                <div key={l.title} className="seam-card">
                  <h3 className="text-base font-bold text-ink-900">{l.title}</h3>
                  <p className="mt-2 text-sm text-warm">{l.text}</p>
                </div>
              ))}
            </div>

            <h2 className="mt-12 text-2xl font-extrabold">Wat we vaak leveren</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {b.items.map((i) => (
                <span key={i} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink-700">{i}</span>
              ))}
            </div>

            {b.normen && b.normen.length > 0 && (
              <div className="mt-8 rounded-xl bg-ink-900 p-6 text-white">
                <h3 className="text-sm font-bold uppercase tracking-wide text-amber-400">Veiligheidsnormen</h3>
                <ul className="mt-3 space-y-1 text-sm text-ink-100">
                  {b.normen.map((n) => <li key={n}>{n}</li>)}
                </ul>
                <p className="mt-3 text-sm text-ink-200">We bepalen samen welke norm en klasse bij jouw werk hoort, zodat je niet voor functies betaalt die je niet nodig hebt.</p>
              </div>
            )}

            <h2 className="mt-12 text-2xl font-extrabold">Merken die we voeren</h2>
            <p className="mt-3 text-warm">{b.brands.join(', ')}.</p>

            {b.gallery && b.gallery.length > 0 && (
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {b.gallery.map((src) => (
                  <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line">
                    <Image src={src} alt={`${b.name} bij Frederiks Bedrijfskleding`} fill sizes="(max-width: 1024px) 90vw, 40vw" className="object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside>
            <div className="sticky top-24 space-y-4">
              <div className="rounded-xl border-2 border-amber-500 bg-white p-6 shadow-card">
                <h2 className="text-lg font-extrabold text-ink-900">Kleding voor {b.navLabel.toLowerCase()}</h2>
                <p className="mt-2 text-sm text-warm">Vertel wat je zoekt. We reageren binnen 24 uur (werkdagen) en komen langs om te passen.</p>
                <CtaKnoppen
                  plek="branche-zijbalk"
                  vol
                  bewijs={false}
                  className="mt-4"
                  offerteHref={`/offerte?branche=${encodeURIComponent(b.navLabel)}`}
                  afspraakHref={`/afspraak?branche=${encodeURIComponent(b.navLabel)}`}
                />
                <p className="mt-4 border-t border-line pt-4 text-sm text-warm" data-plek="branche-zijbalk">
                  <Link href={`/pakket-samenstellen?branche=${encodeURIComponent(b.navLabel)}`} className="font-semibold text-amber-700 underline-offset-2 hover:underline" data-cta="pakket">
                    Zelf je pakket samenstellen
                  </Link>
                  <br />
                  of bel <a href={`tel:${site.phoneIntl}`} className="font-semibold text-ink-900">{site.phone}</a>
                </p>
              </div>
              {b.voorbeeld && (
                <figure className="rounded-xl bg-mist p-6">
                  <blockquote className="text-sm leading-relaxed text-ink-800">“{b.voorbeeld.quote}”</blockquote>
                  <figcaption className="mt-3 text-sm font-bold text-ink-900">{b.voorbeeld.author}</figcaption>
                </figure>
              )}
            </div>
          </aside>
        </div>
      </section>

      <BrancheArtikelen
        brancheSlug={b.slug}
        titel={`Uit ons assortiment voor ${b.navLabel.toLowerCase()}`}
        intro="Een greep uit de catalogus. Bij het passen kijken we wat bij jouw werk past; dit is een startpunt, geen vaste lijst."
      />

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

      <Faq items={b.faq} />

      <section className="container-x pb-8">
        <p className="text-sm text-warm">Andere branches:{' '}
          {branches.filter((x) => x.slug !== b.slug).map((x, i, arr) => (
            <span key={x.slug}>
              <Link href={`/branches/${x.slug}`} className="text-amber-700 hover:underline">{x.navLabel}</Link>{i < arr.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      </section>

      <AfspraakSectie bron={`Branchepagina ${b.navLabel}`} defaultBranche={b.navLabel} />

      <ContactSectie defaultBranche={b.navLabel} />
    </>
  );
}
