import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContactSectie } from '@/components/ContactSectie';
import { ProductKaart } from '@/components/ProductKaart';
import { JsonLd } from '@/components/JsonLd';
import { NormIcoon } from '@/components/NormIcoon';
import { Uitklap } from '@/components/Uitklap';
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/jsonld';
import { listPubliekeProducten, type PubliekProduct } from '@/lib/kms/catalogus';
import { site } from '@/content/site';
import { normen, normenBySlug, voldoetAanNorm, type Norm } from '@/content/normen';

export const revalidate = 3600;

const MAX_PRODUCTEN = 8;

export function generateStaticParams() {
  return normen.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const n = normenBySlug[slug];
  if (!n) return {};
  return {
    title: n.titel,
    description: n.metaDescription,
    alternates: { canonical: `/normen/${n.slug}` },
    openGraph: {
      title: n.titel,
      description: n.metaDescription,
      url: `${site.url}/normen/${n.slug}`,
    },
  };
}

/**
 * Artikelen bij de norm. Eerst de artikelen die de norm zelf in hun
 * normeringsveld noemen, daarna de rest uit dezelfde categorieën — zodat de
 * bovenste rij altijd de meest relevante is en de pagina niet leeg blijft.
 */
async function productenBijNorm(n: Norm): Promise<{ lijst: PubliekProduct[]; metNorm: number }> {
  const perCategorie = await Promise.all(
    n.productCategorieSlugs.map((categorieSlug) => listPubliekeProducten({ categorieSlug })),
  );
  const gezien = new Set<string>();
  const uniek: PubliekProduct[] = [];
  perCategorie.flat().forEach((p) => {
    if (gezien.has(p.id)) return;
    gezien.add(p.id);
    uniek.push(p);
  });
  const metNorm = uniek.filter((p) => voldoetAanNorm(p.normeringen, n));
  const overig = uniek.filter((p) => !voldoetAanNorm(p.normeringen, n));
  return {
    lijst: [...metNorm, ...overig].slice(0, MAX_PRODUCTEN),
    metNorm: metNorm.length,
  };
}

/** Eerste zin als bijschrift onder het beeld; de tabel blijft de volledige tekst. */
function eersteZin(tekst: string): string {
  const m = tekst.match(/^[^.]+\./);
  return m ? m[0] : tekst;
}

/**
 * Kledingsilhouet voor zichtbaarheidsnormen.
 *
 * Meer strepen en mouwen naarmate de klasse hoger is, zodat je klasse 1, 2 en 3
 * naast elkaar ziet in plaats van leest. Een suggestie van een hesje, geen
 * kopie van een officieel pictogram.
 */
function HesjeSilhouet({ stap }: { stap: number }) {
  const metMouwen = stap >= 2;
  const banden = stap === 0 ? [64] : [54, 78];

  return (
    <svg viewBox="0 0 120 132" className="h-28 w-auto" aria-hidden="true" focusable="false">
      {metMouwen && (
        <g fill="#f8bd97" stroke="#d4541a" strokeWidth="2" strokeLinejoin="round">
          <path d="M36 36 18 44 10 92l14 4 12-36z" />
          <path d="M84 36l18 8 8 48-14 4-12-36z" />
        </g>
      )}

      <path
        d="M44 22h32l10 12v82a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4V34z"
        fill="#f8bd97"
        stroke="#d4541a"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M52 22q8 12 16 0" fill="#ffffff" stroke="#d4541a" strokeWidth="2" strokeLinejoin="round" />

      <g fill="#e4e2e0" stroke="#828282" strokeWidth="1.5">
        {banden.map((y) => (
          <rect key={y} x="34" y={y} width="52" height="8" />
        ))}
        {metMouwen && (
          <>
            <path d="M13.6 70.4 28.5 79.8l-1.7 6.1-14.6-7.3z" />
            <path d="M106.4 70.4 91.5 79.8l1.7 6.1 14.6-7.3z" />
          </>
        )}
      </g>
    </svg>
  );
}

/** Oplopende balkjes voor de normen zonder kledingbeeld: verschil zonder tekst. */
function KlasseBalkjes({ stap, totaal }: { stap: number; totaal: number }) {
  return (
    <div className="flex h-28 items-end justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: totaal }).map((_, i) => (
        <span
          key={i}
          className={`w-3 rounded-t-sm ${i <= stap ? 'bg-amber-500' : 'bg-line'}`}
          style={{ height: `${28 + (i * 56) / Math.max(totaal - 1, 1)}px` }}
        />
      ))}
    </div>
  );
}

export default async function NormPagina({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const n = normenBySlug[slug];
  if (!n) notFound();

  const url = `${site.url}/normen/${n.slug}`;
  const koppen = n.tabelKoppen ?? ['Klasse', 'Eis', 'Wanneer je die nodig hebt'];
  const { lijst, metNorm } = await productenBijNorm(n);
  const anderen = normen.filter((x) => x.slug !== n.slug && x.categorie === n.categorie).slice(0, 3);
  const isZichtbaarheid = n.categorie === 'zichtbaarheid';

  return (
    <>
      <JsonLd data={faqJsonLd(n.veelgesteld)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: site.url },
          { name: 'Normen', url: `${site.url}/normen` },
          { name: n.code, url },
        ])}
      />

      {/* Kop met het pictogram groot naast de normcode: in één blik herkenbaar. */}
      <section className="border-b border-line bg-mist">
        <div className="container-x py-12 sm:py-16">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
            <span className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-line bg-white text-amber-700 shadow-soft sm:h-28 sm:w-28">
              <NormIcoon soort={n.categorie} className="h-14 w-14 sm:h-16 sm:w-16" />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">{n.code}</p>
              <h1 className="mt-2 max-w-3xl text-3xl font-bold text-balance sm:text-4xl">{n.titel}</h1>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-warm">{n.intro}</p>
        </div>
      </section>

      <section className="container-x py-10">
        <nav className="text-xs text-warm" aria-label="Kruimelpad">
          <Link href="/" className="hover:text-amber-800">Home</Link>
          <span className="px-1.5">/</span>
          <Link href="/normen" className="hover:text-amber-800">Normen</Link>
          <span className="px-1.5">/</span>
          <span className="text-ink-700">{n.code}</span>
        </nav>

        {/* De beslisregel: het hart van de pagina, waar de bezoeker voor komt. */}
        <div className="mt-7 overflow-hidden rounded-2xl border-2 border-amber-500 bg-amber-50 shadow-soft">
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-9">
            <span className="inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-soft sm:h-24 sm:w-24">
              <NormIcoon soort={n.categorie} className="h-11 w-11 sm:h-14 sm:w-14" />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">De beslisregel</p>
              <p className="mt-3 font-display text-xl font-extrabold leading-snug text-ink-900 sm:text-2xl lg:text-[1.7rem]">
                {n.beslisregel}
              </p>
            </div>
          </div>
          <p className="border-t border-amber-200 bg-white/70 px-6 py-3 text-sm font-semibold text-warm sm:px-9">
            Weet je het antwoord, dan weet je je klasse. Twijfel je, bel dan even.
          </p>
        </div>

        {/* Eerst het beeld, daarna de tabel als exacte referentie. */}
        <h2 className="mt-14 kop-2">De klassen naast elkaar</h2>
        <p className="mt-2 max-w-2xl text-warm">
          {isZichtbaarheid
            ? 'Meer fluorescerend oppervlak en meer strepen, van klasse 1 naar klasse 3.'
            : 'Van basis naar uitgebreid, in de volgorde waarop ze op het label staan.'}
        </p>

        <ul
          className={`mt-6 grid gap-4 ${
            n.klassen.length <= 3 ? 'sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
          }`}
        >
          {n.klassen.map((k, i) => (
            <li
              key={k.naam}
              className="flex flex-col items-center rounded-xl border border-line bg-white p-4 text-center shadow-soft"
            >
              {isZichtbaarheid ? (
                <HesjeSilhouet stap={Math.min(i, 2)} />
              ) : (
                <KlasseBalkjes stap={i} totaal={n.klassen.length} />
              )}
              <span className="mt-4 font-display text-lg font-extrabold text-ink-900">{k.naam}</span>
              <span className="mt-1.5 text-[13px] leading-snug text-warm">{eersteZin(k.wanneer)}</span>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-warm">
          Wat er precies getest is
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Klassen van {n.code} met eis en toepassing</caption>
            <thead>
              <tr>
                {koppen.map((k) => (
                  <th
                    key={k}
                    scope="col"
                    className="whitespace-nowrap border-b border-line bg-mist px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-warm"
                  >
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {n.klassen.map((k) => (
                <tr key={k.naam} className="align-top">
                  <th scope="row" className="border-b border-line px-4 py-3 text-left font-bold text-ink-900">
                    {k.naam}
                  </th>
                  <td className="border-b border-line px-4 py-3 text-ink-800">{k.eis}</td>
                  <td className="border-b border-line px-4 py-3 text-warm">{k.wanneer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* De diepgang blijft, maar hij kost geen scherm meer. */}
        <h2 className="mt-14 kop-2">Valkuilen en vragen over {n.code}</h2>
        <div className="mt-5 max-w-3xl rounded-xl border border-line bg-white px-6 shadow-soft">
          <Uitklap
            titel="Waar het in de praktijk misgaat"
            samenvatting="De fouten die een tweede bestelling kosten."
          >
            <p>{n.nuance}</p>
          </Uitklap>
          {n.veelgesteld.map((f) => (
            <Uitklap key={f.q} titel={f.q}>
              <p>{f.a}</p>
            </Uitklap>
          ))}
        </div>
      </section>

      {/* Artikelen uit het echte assortiment. */}
      {lijst.length > 0 && (
        <section className="border-y border-line bg-mist">
          <div className="container-x py-14">
            <p className="eyebrow">Uit ons assortiment</p>
            <h2 className="mt-3 kop-2">
              {n.categorie === 'schoenen' ? 'Schoenen' : 'Kleding'} die bij {n.code} hoort
            </h2>
            <p className="mt-3 max-w-2xl text-warm">
              {metNorm > 0
                ? `De bovenste artikelen noemen ${n.code} in hun normering. Welke klasse of code op het label staat, lees je op de productpagina.`
                : `Dit zijn de categorieën waarin ${n.code} voorkomt. Wat er op een artikel getest is, staat bij de normering op de productpagina.`}
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {lijst.map((p) => (
                <ProductKaart key={p.id} p={p} />
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {n.productCategorieSlugs.map((c) => (
                <Link
                  key={c}
                  href={`/assortiment/${c}`}
                  className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink-700 hover:border-amber-400"
                >
                  Alle {c.replace(/-en-/g, ' en ').replace(/-/g, ' ')}
                </Link>
              ))}
            </div>

            <p className="mt-6 text-sm text-warm">
              Prijzen staan niet online. Klanten zien hun eigen prijzen in het{' '}
              <Link href="/portaal" className="font-semibold text-amber-700 underline underline-offset-2">
                klantportaal
              </Link>
              ; vraag anders een offerte aan.
            </p>
          </div>
        </section>
      )}

      {anderen.length > 0 && (
        <section className="container-x py-14">
          <h2 className="kop-2">Normen die hier vaak bij horen</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {anderen.map((x) => (
              <Link
                key={x.slug}
                href={`/normen/${x.slug}`}
                className="group rounded-lg border border-line bg-white p-5 shadow-soft transition hover:-translate-y-1 hover:border-amber-400"
              >
                <span className="text-amber-700">
                  <NormIcoon soort={x.categorie} className="h-8 w-8" />
                </span>
                <span className="eyebrow mt-3 inline-block">{x.code}</span>
                <h3 className="mt-3 text-base font-bold text-ink-900 group-hover:text-amber-800">{x.korteTitel}</h3>
                <p className="mt-2 text-sm text-warm">{x.eenRegel}</p>
              </Link>
            ))}
          </div>
          <p className="mt-6 text-sm text-warm">
            <Link href="/normen" className="font-semibold text-amber-700 hover:underline">
              Terug naar alle normen
            </Link>
          </p>
        </section>
      )}

      <ContactSectie
        title={`Advies over ${n.code}?`}
        intro={`Vertel wat je mensen doen en waar ze staan, dan bepalen we samen welke klasse genoeg is. Passen doe je in Hengelo Gld of we komen bij jullie op locatie.`}
      />
    </>
  );
}
