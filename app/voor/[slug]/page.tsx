import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { vakgebieden, vakgebiedenBySlug } from '@/content/vakgebieden';
import { site } from '@/content/site';
import { PageHero } from '@/components/PageHero';
import { ContactSectie } from '@/components/ContactSectie';
import { ProductKaart } from '@/components/ProductKaart';
import { JsonLd } from '@/components/JsonLd';
import { RegioKaart } from '@/components/RegioKaart';
import { Uitklap } from '@/components/Uitklap';
import { NormIcoon, type NormSoort } from '@/components/NormIcoon';
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/jsonld';
import { listPubliekeProducten, categorieVanSlug, type PubliekProduct, naarKaart } from '@/lib/kms/catalogus';

export const revalidate = 3600;

export function generateStaticParams() {
  return vakgebieden.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const v = vakgebiedenBySlug[slug];
  if (!v) return {};
  return {
    title: v.titel,
    description: v.metaDescription,
    alternates: { canonical: `/voor/${v.slug}` },
    openGraph: {
      title: v.titel,
      description: v.metaDescription,
      url: `${site.url}/voor/${v.slug}`,
    },
  };
}

/**
 * Acht artikelen uit de categorieën die bij dit vak horen, om en om uit elke
 * categorie. Anders vult de eerste categorie het hele grid en zie je acht
 * broeken op een pagina die ook over jassen en schoenen gaat.
 */
async function haalProducten(categorieSlugs: string[], max = 8): Promise<PubliekProduct[]> {
  const lijsten = await Promise.all(
    categorieSlugs.map((c) => listPubliekeProducten({ categorieSlug: c })),
  );
  const gekozen: PubliekProduct[] = [];
  const gezien = new Set<string>();
  const langste = lijsten.reduce((n, l) => Math.max(n, l.length), 0);
  for (let i = 0; i < langste && gekozen.length < max; i++) {
    for (const lijst of lijsten) {
      const p = lijst[i];
      if (!p || gezien.has(p.id)) continue;
      gezien.add(p.id);
      gekozen.push(p);
      if (gekozen.length >= max) break;
    }
  }
  return gekozen;
}

/**
 * De eerste zin van een alinea. De tweede zin legt op deze pagina's meestal
 * uit wat de eerste al zei; op een kaartje naast een icoon is dat ballast.
 */
function eersteZin(tekst: string): string {
  const m = tekst.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : tekst).trim();
}

/** Normsoort uit de normcode, voor het juiste pictogram naast het kaartje. */
function normSoort(code: string): NormSoort {
  const c = code.replace(/[^0-9]/g, '');
  if (c.includes('20471')) return 'zichtbaarheid';
  if (c.includes('11612') || c.includes('11611') || c.includes('61482')) return 'hitte-en-vlam';
  if (c.includes('20345')) return 'schoenen';
  if (c.includes('343') || c.includes('342')) return 'weer';
  return 'overig';
}

/* ---------------------------------------------------------------------------
 * Lijniconen bij "waarom kleding het hier zwaar heeft".
 *
 * Er zijn nog geen foto's, dus het beeld komt uit tekening en vorm. Welk icoon
 * bij welk punt hoort leiden we af uit de tekst zelf: zo klopt het plaatje ook
 * als er later een vakgebied bij komt.
 * ------------------------------------------------------------------------- */
type PuntSoort = 'slijtage' | 'wassen' | 'temperatuur' | 'lijf' | 'veiligheid';

const puntPaden: Record<PuntSoort, React.ReactNode> = {
  slijtage: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4l-2 4 3 2-3 4 2 6" />
    </>
  ),
  wassen: (
    <>
      <path d="M4 9h16v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M8 9V5a2 2 0 0 1 2-2h4" />
      <path d="M7 14c1.7-1.4 3.3-1.4 5 0s3.3 1.4 5 0" />
    </>
  ),
  temperatuur: (
    <>
      <path d="M14 14.9V5a2 2 0 0 0-4 0v9.9a4 4 0 1 0 4 0z" />
      <path d="M12 8v7" />
      <path d="M18 5h3M18 9h3" />
    </>
  ),
  lijf: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <path d="M6 21v-6a6 6 0 0 1 12 0v6" />
      <path d="M9 21v-4M15 21v-4" />
    </>
  ),
  veiligheid: (
    <>
      <path d="M12 3l7 3v5c0 4.6-3 8-7 10-4-2-7-5.4-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
};

function puntSoort(punt: { title: string; text: string }): PuntSoort {
  const t = `${punt.title} ${punt.text}`.toLowerCase();
  if (/(was|vlek|kleur|hars|verf|vuil|smeer|stof\b|hygi)/.test(t)) return 'wassen';
  if (/(koud|kou|winter|vries|lagen|zweet|warmte|hitte|vlam|vonk|zon)/.test(t)) return 'temperatuur';
  if (/(hak|risico|veilig|gezien|zicht|reflect|snijd|chemi)/.test(t)) return 'veiligheid';
  if (/(knie|rug|schouder|voet|enkel|huid|lijf|bewegen)/.test(t)) return 'lijf';
  return 'slijtage';
}

function PuntIcoon({ soort }: { soort: PuntSoort }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {puntPaden[soort]}
    </svg>
  );
}

export default async function VakgebiedPagina({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = vakgebiedenBySlug[slug];
  if (!v) notFound();

  const url = `${site.url}/voor/${v.slug}`;
  const producten = await haalProducten(v.productCategorieSlugs);
  const categorieen = v.productCategorieSlugs
    .map((c) => categorieVanSlug(c))
    .filter((c): c is NonNullable<ReturnType<typeof categorieVanSlug>> => c !== null);
  const anderen = vakgebieden.filter((x) => x.slug !== v.slug);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: site.url },
          { name: 'Vakgebieden', url: `${site.url}/voor` },
          { name: v.naam, url },
        ])}
      />
      <JsonLd data={faqJsonLd(v.veelgesteld)} />

      {/* 1. Kruimelpad */}
      <nav className="container-x pt-6 text-xs text-warm" aria-label="Kruimelpad">
        <Link href="/" className="hover:text-amber-800">Home</Link>
        <span className="px-1.5">/</span>
        <Link href="/voor" className="hover:text-amber-800">Vakgebieden</Link>
        <span className="px-1.5">/</span>
        <span className="text-ink-700">{v.naam}</span>
      </nav>

      <PageHero
        eyebrow={v.eyebrow}
        title={v.titel}
        kruimels={[{ label: 'Voor jouw vak', href: '/voor' }]}
        beeld={<RegioKaart className="w-full lg:max-w-lg" />}
      />

      {/* 2. Het werk zelf */}
      <section className="container-x py-14">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="eyebrow">Het werk</p>
            <div className="prose-nl mt-4 text-lg">
              <p>{v.intro}</p>
            </div>
          </div>
          <div className="seam-card lg:mt-10">
            <h2 className="text-base font-bold text-ink-900">Even meedenken?</h2>
            <p className="mt-2 text-sm text-warm">Bel {site.owner.split(' ')[0]}, ook zonder bestelling.</p>
            <a href={`tel:${site.phoneIntl}`} className="btn-outline mt-4 w-full">Bel {site.phone}</a>
          </div>
        </div>

        {/* 3. Waarom kleding het hier zwaar heeft */}
        <h2 className="mt-14 kop-2">Waarom kleding het hier zwaar heeft</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {v.waaromAnders.map((w) => (
            <div key={w.title} className="seam-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <PuntIcoon soort={puntSoort(w)} />
              </span>
              <h3 className="mt-4 text-base font-bold text-ink-900">{w.title}</h3>
              <p className="mt-2 text-sm text-warm">{eersteZin(w.text)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Werkgebied: de kaart doet het werk dat de lijst plaatsnamen deed */}
      {/* 5. Wat dit vak meestal bestelt */}
      <section className="container-x py-14">
        <h2 className="kop-2">Wat dit vak meestal bestelt</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {v.meestBesteld.map((m, i) => (
            <li key={m} className="flex items-start gap-3 rounded-lg border border-line bg-white px-4 py-4 shadow-soft">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50 font-display text-sm font-extrabold text-amber-700"
              >
                {i + 1}
              </span>
              <span className="text-sm text-ink-800">{m}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 6. Normen */}
      <section className="border-y border-line bg-mist">
        <div className="container-x py-14">
          <h2 className="kop-2">Welke normen hier spelen</h2>
          {v.normen.length > 0 ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {v.normen.map((n) => (
                  <Link
                    key={n.slug}
                    href={`/normen/${n.slug}`}
                    className="group flex flex-col items-start rounded-lg border border-line bg-white p-5 shadow-soft transition hover:border-amber-400"
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-amber-50 text-amber-700 transition group-hover:bg-amber-100">
                      <NormIcoon soort={normSoort(n.code)} className="h-9 w-9" />
                    </span>
                    <span className="mt-4 block font-display text-sm font-extrabold uppercase tracking-wide text-amber-700">{n.code}</span>
                    <span className="mt-1 block font-bold text-ink-900 group-hover:text-amber-800">{n.naam}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-6 max-w-3xl border-t border-line">
                <Uitklap titel="Waarom deze normen hier spelen">
                  {v.normen.map((n) => (
                    <p key={n.slug}>
                      <strong className="text-ink-900">{n.code}, {n.naam}.</strong> {n.waarom}
                    </p>
                  ))}
                </Uitklap>
              </div>
            </>
          ) : (
            <p className="mt-3 max-w-2xl text-warm">
              Hier spelen geen veiligheidsnormen. Het gaat om pasvorm, kleurvastheid en een logo dat na vijftig
              wasbeurten nog strak op de borst zit.
            </p>
          )}
        </div>
      </section>

      {/* 7. Uit het assortiment */}
      {producten.length > 0 && (
        <section className="container-x py-14">
          <h2 className="kop-2">Artikelen die hierbij passen</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {producten.map((p) => (
              <ProductKaart key={p.id} p={naarKaart(p)} />
            ))}
          </div>
          {categorieen.length > 0 && (
            <p className="mt-6 text-sm text-warm">
              Verder kijken:{' '}
              {categorieen.map((c, i) => (
                <span key={c.slug}>
                  <Link href={`/assortiment/${c.slug}`} className="text-amber-700 hover:underline">{c.naam}</Link>
                  {i < categorieen.length - 1 ? ', ' : '.'}
                </span>
              ))}
            </p>
          )}
        </section>
      )}

      {/* 8. Veelgestelde vragen: uitgeklapt voor wie het nodig heeft, ingeklapt voor de rest */}
      <section className="border-t border-line">
        <div className="container-x py-14">
          <h2 className="kop-2">Vragen die we vaak krijgen</h2>
          <div className="mt-6 max-w-3xl border-t border-line">
            {v.veelgesteld.map((f) => (
              <Uitklap key={f.q} titel={f.q}>
                <p>{f.a}</p>
              </Uitklap>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Afsluitend blok */}
      <section className="bg-ink-900">
        <div className="container-x py-16 sm:py-20">
          <h2 className="max-w-2xl text-2xl font-extrabold text-white text-balance sm:text-3xl">
            Zullen we een keer langskomen om te passen?
          </h2>
          <p className="mt-4 max-w-xl text-ink-200">
            Gratis en vrijblijvend, op een moment dat jou uitkomt.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/offerte?branche=${encodeURIComponent(v.naam)}`} className="btn-primary">
              Plan een pasafspraak
            </Link>
            <a href={`tel:${site.phoneIntl}`} className="btn-outline border-white/40 text-white hover:border-white">
              Bel {site.phone}
            </a>
          </div>
        </div>
      </section>

      <section className="container-x py-10">
        <p className="text-sm text-warm">
          Andere vakgebieden:{' '}
          {anderen.map((x, i) => (
            <span key={x.slug}>
              <Link href={`/voor/${x.slug}`} className="text-amber-700 hover:underline">{x.naam}</Link>
              {i < anderen.length - 1 ? ', ' : '.'}
            </span>
          ))}
        </p>
      </section>

      {/* 10. Contact */}
      <ContactSectie
        title={`Werkkleding voor ${v.naam.toLowerCase()}?`}
        intro="Vertel wat voor werk je doet en met hoeveel mensen. Dan denken we mee."
        defaultBranche={v.naam}
      />
    </>
  );
}
