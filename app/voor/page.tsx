import type { Metadata } from 'next';
import Link from 'next/link';
import { vakgebieden } from '@/content/vakgebieden';
import { site } from '@/content/site';
import { PageHero } from '@/components/PageHero';
import { ContactSectie } from '@/components/ContactSectie';
import { JsonLd } from '@/components/JsonLd';
import { RegioKaart } from '@/components/RegioKaart';
import { breadcrumbJsonLd } from '@/lib/jsonld';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Werkkleding per vakgebied in de Achterhoek',
  description:
    'Werkkleding afgestemd op het vak: hoveniers, bouw, schilders, installatie, metaal, transport, agrarisch, horeca, zorg en kantoor. In de Achterhoek en de Liemers, met passen op locatie.',
  alternates: { canonical: '/voor' },
  openGraph: {
    title: 'Werkkleding per vakgebied in de Achterhoek',
    description:
      'Tien vakgebieden, elk met eigen eisen aan werkkleding. Bekijk wat er in jouw vak speelt en welke normen erbij horen.',
    url: `${site.url}/voor`,
  },
};

/* ---------------------------------------------------------------------------
 * Een lijnicoon per vakgebied.
 *
 * Foto's zijn er nog niet, dus het onderscheid tussen de tien kaartjes moet uit
 * de tekening komen. Simpele vormen van 24x24 in currentColor: een blad, een
 * helm, een verfroller. Onbekende slug valt terug op een neutraal icoon.
 * ------------------------------------------------------------------------- */
const vakPaden: Record<string, React.ReactNode> = {
  'hoveniers-en-groenvoorziening': (
    <>
      <path d="M20 4c-9 0-15 4-15 11 0 2 .6 3.6 1.4 4.8C9 16 13 12.5 18 10.5c-4 3-7.5 6.5-9.6 10.4 1 .5 2.2.8 3.3.8 5.5 0 8.3-6 8.3-17.7z" />
      <path d="M4 21c1.5-3.5 3.6-6.4 6-8.6" />
    </>
  ),
  'bouw-en-aannemers': (
    <>
      <path d="M3 18h18" />
      <path d="M5 18v-3a7 7 0 0 1 14 0v3" />
      <path d="M10 4.6V9M14 4.6V9" />
      <path d="M9.5 4h5" />
    </>
  ),
  'schilders-en-afbouw': (
    <>
      <rect x="3" y="4" width="11" height="5" rx="1" />
      <path d="M14 6.5h5v4h-6v2.5" />
      <rect x="10.5" y="13" width="5" height="8" rx="1.2" />
    </>
  ),
  'installatie-en-techniek': (
    <>
      <path d="M13 2 4 13.5h6.5L10 22l9-11.5h-6.5z" />
    </>
  ),
  'metaal-en-industrie': (
    <>
      <path d="M12 3c1.6 4.3-2.6 5.4-2.6 8.9a4.6 4.6 0 0 0 9.2 0c0-2.2-1.5-3.9-3.2-5.4" />
      <path d="M6 6 4 4M6 12H3M7 17l-2 2" />
      <path d="M9 21h9" />
    </>
  ),
  'transport-en-logistiek': (
    <>
      <path d="M2 6h12v10H2z" />
      <path d="M14 9.5h4l3 3.2V16h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  'agrarisch-en-loonwerk': (
    <>
      <path d="M12 21V8" />
      <path d="M12 8c0-2.5 1.6-4.5 4-5 0 2.6-1.7 4.6-4 5z" />
      <path d="M12 8c0-2.5-1.6-4.5-4-5 0 2.6 1.7 4.6 4 5z" />
      <path d="M12 14c0-2.2 1.5-3.9 3.6-4.4 0 2.3-1.5 4-3.6 4.4z" />
      <path d="M12 14c0-2.2-1.5-3.9-3.6-4.4 0 2.3 1.5 4 3.6 4.4z" />
    </>
  ),
  'horeca-en-food': (
    <>
      <path d="M7.5 16.5V21h9v-4.5" />
      <path d="M7.5 17a4 4 0 0 1-1.2-7.8 4 4 0 0 1 6-4.2 4 4 0 0 1 6 4.2A4 4 0 0 1 16.5 17z" />
      <path d="M7.5 19h9" />
    </>
  ),
  'zorg-en-welzijn': (
    <>
      <path d="M12 20.5S4.5 16 4.5 10.5A4 4 0 0 1 12 8.3a4 4 0 0 1 7.5 2.2c0 5.5-7.5 10-7.5 10z" />
      <path d="M12 10v4M10 12h4" />
    </>
  ),
  'kantoor-en-receptie': (
    <>
      <path d="M9 3.5 12 6l3-2.5 5 2v6h-3v9H7v-9H4v-6z" />
      <path d="M12 6.5 10.7 9l1.3 5.5L13.3 9z" />
    </>
  ),
};

const neutraalPad = (
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M9 10v9.5" />
  </>
);

function VakIcoon({ slug }: { slug: string }) {
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
      {vakPaden[slug] ?? neutraalPad}
    </svg>
  );
}

/** Eerste zin van de intro: op een kaartje is dat genoeg om te kiezen. */
function eersteZin(tekst: string): string {
  const m = tekst.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : tekst).trim();
}

export default function VakgebiedenIndex() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: site.url },
          { name: 'Vakgebieden', url: `${site.url}/voor` },
        ])}
      />

      <PageHero
        eyebrow="Vakgebieden"
        title="Werkkleding per vakgebied in de Achterhoek"
        intro="Een lasser vraagt iets anders van zijn kleding dan een hovenier. Kies je vak en lees wat er in de praktijk misgaat en welke normen erbij horen."
        kruimels={[{ label: 'Home', href: '/' }]}
        beeld={<RegioKaart className="w-full lg:max-w-lg" />}
      />

      <section className="container-x py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="max-w-2xl text-balance kop-2">
            Kies je vak
          </h2>
          <p className="text-sm text-warm">
            {vakgebieden.length} vakgebieden · elk met de normen die er in de praktijk toe doen
          </p>
        </div>

        <ul className="mt-8 grid gap-x-8 gap-y-px border-y border-line sm:grid-cols-2 xl:grid-cols-3">
          {vakgebieden.map((v) => (
            <li key={v.slug} className="border-b border-line last:border-b-0 sm:[&:nth-last-child(-n+1)]:border-b-0">
              <Link
                href={`/voor/${v.slug}`}
                className="group flex items-start gap-4 py-6 transition-colors hover:bg-mist"
              >
                <span className="mt-0.5 shrink-0 text-ink-400 transition-colors group-hover:text-amber-800">
                  <VakIcoon slug={v.slug} />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-lg font-semibold text-ink-900">
                    {v.naam}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-warm">
                    {eersteZin(v.intro)}
                  </span>
                  <span className="mt-3 flex flex-wrap gap-1.5">
                    {v.normen.slice(0, 3).map((n) => (
                      <span
                        key={n.slug}
                        className="rounded border border-line bg-mist px-1.5 py-0.5 text-[11px] font-semibold text-warm"
                      >
                        {n.code}
                      </span>
                    ))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-[60ch] text-warm">
          Weet je niet welke normen voor jouw werk gelden?{' '}
          <Link href="/normen" className="font-semibold text-amber-700 underline underline-offset-2">
            Bekijk het normenoverzicht
          </Link>{' '}
          of bel {site.phone} — dan lopen we het samen door.
        </p>
      </section>

      <section className="bg-ink-900">
        <div className="container-x py-16 sm:py-20">
          <h2 className="max-w-2xl text-2xl font-extrabold text-white text-balance sm:text-3xl">
            Zullen we een keer langskomen om te passen?
          </h2>
          <p className="mt-4 max-w-xl text-ink-200">
            Gratis en vrijblijvend, op een moment dat jou uitkomt.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/offerte" className="btn-primary">Plan een pasafspraak</Link>
            <a href={`tel:${site.phoneIntl}`} className="btn-outline border-white/40 text-white hover:border-white">
              Bel {site.phone}
            </a>
          </div>
        </div>
      </section>

      <ContactSectie
        title="Staat jouw vak er niet bij?"
        intro="We leveren aan veel meer bedrijven dan deze tien vakgebieden. Vertel wat voor werk je doet en met hoeveel mensen, dan denken we mee."
      />
    </>
  );
}
