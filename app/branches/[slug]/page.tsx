import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { branches, branchesBySlug } from '@/content/branches';
import { Werkwijze } from '@/components/Werkwijze';
import { site } from '@/content/site';
import { Faq } from '@/components/Faq';
import { ContactSectie } from '@/components/ContactSectie';
import { Uitklap } from '@/components/Uitklap';
import { JsonLd } from '@/components/JsonLd';
import { serviceJsonLd, faqJsonLd, breadcrumbJsonLd } from '@/lib/jsonld';
import { CtaKnoppen } from '@/components/CtaKnoppen';
import { BrancheArtikelen } from '@/components/BrancheArtikelen';
import { BrancheVerdieping } from '@/components/BrancheVerdieping';
import { verdiepingBySlug } from '@/content/branche-verdieping';

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
  const v = verdiepingBySlug[b.slug];
  const faq = v ? [...b.faq, ...v.extraFaq] : b.faq;
  return (
    <>
      <JsonLd data={serviceJsonLd({ name: b.name, description: b.metaDescription, url })} />
      {faq.length > 0 && <JsonLd data={faqJsonLd(faq)} />}
      {/* Geen tussenstap "Branches": daar is geen eigen pagina voor, en een
          #anker als kruimel-URL keurt Google af. */}
      <JsonLd data={breadcrumbJsonLd([
        { name: 'Home', url: site.url },
        { name: b.navLabel, url },
      ])} />

      {/* Split-hero */}
      <section className="border-b border-line bg-ink-900 text-white">
        <div className="mx-auto grid w-full max-w-[110rem] lg:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col justify-center px-5 py-10 sm:px-6 lg:py-14 lg:pl-[clamp(2rem,5.5vw,6rem)] lg:pr-14">
            <nav className="text-xs text-ink-300" aria-label="Kruimelpad">
              <Link href="/" className="hover:text-white">Home</Link>
              <span className="px-1.5">/</span>
              <Link href="/#branches" className="hover:text-white">Branches</Link>
              <span className="px-1.5">/</span>
              <span className="text-white">{b.navLabel}</span>
            </nav>
            <h1 className="kop-1 mt-4 max-w-[18ch] text-balance text-white">{b.name}</h1>
            <p className="mt-4 max-w-[52ch] text-lg text-ink-100">{b.heroIntro}</p>
            <CtaKnoppen
              plek="branche-hero"
              donker
              className="mt-7"
              offerteHref={`/offerte?branche=${encodeURIComponent(b.navLabel)}`}
              afspraakHref={`/afspraak?branche=${encodeURIComponent(b.navLabel)}`}
            />
          </div>
          <div className={`relative min-h-[16rem] lg:min-h-[26rem] ${b.fit === 'contain' ? 'bg-ink-800' : ''}`}>
            <Image src={b.image} alt={b.name} fill priority sizes="(max-width: 1024px) 100vw, 50vw"
              className={b.fit === 'contain' ? 'object-contain p-3' : 'object-cover object-top'} />
          </div>
        </div>
      </section>

      {/* In het kort: wat je krijgt, in vier tegels. De lange tekst staat eronder, ingeklapt. */}
      <section className="container-x sec-md">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
          <div>
            <h2 className="kop-2">Wat we voor je verzorgen</h2>
            <p className="mt-3 max-w-[68ch] text-lg text-warm">{b.body[0]}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {b.levering.map((l) => (
                <li key={l.title} className="flex gap-4 rounded-xl border border-line bg-white p-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-ink-900" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3.2L13 5" /></svg>
                  </span>
                  <span>
                    <span className="block font-display text-[1.0625rem] font-extrabold text-ink-900">{l.title}</span>
                    <span className="mt-1 block text-sm leading-snug text-warm">{l.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            {b.body.length > 1 && (
              <div className="mt-4 rounded-xl border border-line px-5">
                <Uitklap titel={`Meer over werken met ${b.navLabel.toLowerCase()}`} samenvatting="Hoe we kiezen, grote maten en nieuwe medewerkers">
                  {b.body.slice(1).map((p, i) => <p key={i}>{p}</p>)}
                </Uitklap>
              </div>
            )}
          </div>

          <aside>
            <div className="sticky top-28 space-y-4">
              <div className="rounded-2xl border-2 border-amber-500 bg-white p-6 shadow-card">
                <h2 className="font-display text-xl font-extrabold text-ink-900">Kleding voor {b.navLabel.toLowerCase()}</h2>
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
                <figure className="rounded-2xl bg-ink-900 p-6 text-white">
                  <svg className="h-6 w-6 text-amber-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 18v-5c0-4 2-7 6-8l1 2c-2 1-3 2.500-3 4h3v7zm9 0v-5c0-4 2-7 6-8l1 2c-2 1-3 2.500-3 4h3v7z" /></svg>
                  <blockquote className="mt-3 text-[15px] leading-relaxed">{b.voorbeeld.quote}</blockquote>
                  <figcaption className="mt-3 text-sm font-bold text-amber-400">{b.voorbeeld.author}</figcaption>
                </figure>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* Specificaties: wat we leveren, welke normen, welke merken. Eén donkere band in kolommen. */}
      <section className="bg-ink-900 text-white">
        <div className={`container-x sec-md grid gap-8 ${b.normen && b.normen.length > 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          <div>
            <h2 className="font-display text-xl font-extrabold text-white">Wat we vaak leveren</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {b.items.map((i) => (
                <li key={i} className="rounded-md border border-white/25 px-3 py-1.5 text-sm font-medium text-white">{i}</li>
              ))}
            </ul>
          </div>
          {b.normen && b.normen.length > 0 && (
            <div className="lg:border-l lg:border-white/15 lg:pl-8">
              <h2 className="font-display text-xl font-extrabold text-white">Veiligheidsnormen</h2>
              <ul className="mt-4 space-y-2 text-sm text-ink-100">
                {b.normen.map((n) => (
                  <li key={n} className="flex gap-2.5">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 1.500l5.500 2v4.500c0 3-2.300 5.500-5.500 6.500-3.200-1-5.500-3.500-5.500-6.500V3.500z" /></svg>
                    {n}
                  </li>
                ))}
              </ul>
              <Link href="/normen" className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-amber-400 underline underline-offset-2 hover:text-amber-300">Alle normen uitgelegd</Link>
            </div>
          )}
          <div className="lg:border-l lg:border-white/15 lg:pl-8">
            <h2 className="font-display text-xl font-extrabold text-white">Merken die we voeren</h2>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-display text-lg font-extrabold text-ink-200">
              {b.brands.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {v && <BrancheVerdieping v={v} label={b.navLabel} pakketHref={`/pakket-samenstellen?branche=${encodeURIComponent(b.navLabel)}`} />}

      {/* Eén foto: naast een donker vlak met de pakketsamensteller, zodat er geen halve witte rij overblijft.
          Twee of meer: naast elkaar over de volle breedte. */}
      {b.gallery && b.gallery.length > 0 && (
        <section className="container-x pt-10 sm:pt-14">
          {b.gallery.length === 1 ? (
            <div className="grid overflow-hidden rounded-2xl bg-ink-900 shadow-card lg:grid-cols-2">
              <div className="relative min-h-[16rem] lg:min-h-[22rem]">
                <Image src={b.gallery[0]} alt={`${b.name} bij Frederiks Bedrijfskleding`} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              </div>
              <div className="flex flex-col justify-center p-6 sm:p-10" data-plek="branche-foto">
                <h2 className="font-display text-2xl font-extrabold text-white">Zie je logo meteen op de kleding</h2>
                <p className="mt-3 max-w-[48ch] text-ink-200">
                  Kies een kledingstuk en een kleur, zet je logo erop en vraag het pakket in één klik als offerte aan.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={`/pakket-samenstellen?branche=${encodeURIComponent(b.navLabel)}`} className="btn-primary" data-cta="pakket">
                    Stel je pakket samen
                  </Link>
                  <a href={`tel:${site.phoneIntl}`} className="btn border-2 border-white/60 text-white hover:border-white hover:bg-white hover:text-ink-900" data-cta="telefoon">
                    Bel {site.phone}
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {b.gallery.map((src) => (
                <div key={src} className="relative aspect-[16/9] overflow-hidden rounded-2xl">
                  <Image src={src} alt={`${b.name} bij Frederiks Bedrijfskleding`} fill sizes="(max-width: 1024px) 90vw, 45vw" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <BrancheArtikelen
        brancheSlug={b.slug}
        titel={`Uit ons assortiment voor ${b.navLabel.toLowerCase()}`}
        intro="Een greep uit de catalogus. Bij het passen kijken we wat bij jouw werk past; dit is een startpunt, geen vaste lijst."
      />

      <Werkwijze />

      <Faq items={faq} title={`Veelgestelde vragen over ${b.navLabel.toLowerCase()}`} />

      <ContactSectie defaultBranche={b.navLabel} title={`Kleding voor ${b.navLabel.toLowerCase()}? Vertel wat je zoekt`} />

      <section className="container-x py-8">
        <ul className="flex flex-wrap items-center gap-2 text-sm">
          <li className="mr-1 font-semibold text-ink-900">Andere branches</li>
          {branches.filter((x) => x.slug !== b.slug).map((x) => (
            <li key={x.slug}>
              <Link href={`/branches/${x.slug}`} className="inline-flex min-h-[40px] items-center rounded-md border border-line px-3 font-medium text-ink-800 hover:border-ink-900">{x.navLabel}</Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
