import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { ContactSectie } from '@/components/ContactSectie';
import { JsonLd } from '@/components/JsonLd';
import { NormIcoon } from '@/components/NormIcoon';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { site } from '@/content/site';
import { normen, normenPerCategorie } from '@/content/normen';

export const revalidate = 3600;

const titel = 'Normen voor werkkleding en veiligheidsschoenen';
const omschrijving =
  'EN ISO 20471, EN ISO 11612, EN 343, EN ISO 20345 en meer: per norm de klassen op een rij, met één beslisregel die je vertelt welke je nodig hebt.';

export const metadata: Metadata = {
  title: titel,
  description: omschrijving,
  alternates: { canonical: '/normen' },
  openGraph: { title: titel, description: omschrijving, url: `${site.url}/normen` },
};

/** Vier regels waarmee je elk label leest. Kort genoeg om te scannen. */
const labelRegels = [
  { kop: 'De code', tekst: 'Zegt op welke norm getest is.' },
  { kop: 'Het cijfer of de letter', tekst: 'Zegt hoe zwaar.' },
  { kop: 'Het wassymbool', tekst: 'Zegt hoe lang die bescherming meegaat.' },
  { kop: 'Staat er niets op', tekst: 'Dan is er niets getest.' },
];

export default function NormenPagina() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: site.url },
          { name: 'Normen', url: `${site.url}/normen` },
        ])}
      />

      <PageHero
        eyebrow="Normen"
        title={titel}
        intro="Een norm is geen keurmerk maar een testrapport: hij vertelt wat kleding of een schoen aankan. Hieronder de normen die je in de Achterhoek het vaakst tegenkomt, elk met de klassen naast elkaar en één vraag die bepaalt welke bij jouw werk hoort."
      />

      <section className="container-x py-12">
        <nav className="text-xs text-warm" aria-label="Kruimelpad">
          <Link href="/" className="hover:text-amber-800">Home</Link>
          <span className="px-1.5">/</span>
          <span className="text-ink-700">Normen</span>
        </nav>

        {/* Zo lees je een label: vier blokjes in plaats van een alinea. */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {labelRegels.map((r, i) => (
            <div key={r.kop} className="seam-card">
              <span className="font-display text-2xl font-extrabold text-amber-500">{i + 1}</span>
              <p className="mt-1 font-bold text-ink-900">{r.kop}</p>
              <p className="mt-1 text-sm text-warm">{r.tekst}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm font-semibold uppercase tracking-wide text-warm">
          {normen.length} normen, gegroepeerd naar risico
        </p>

        <div className="mt-6 space-y-10">
          {normenPerCategorie.map((groep) => (
            <div key={groep.key}>
              <div className="flex items-center gap-4 border-b border-line pb-4">
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-line bg-mist text-amber-700">
                  <NormIcoon soort={groep.key} className="h-9 w-9" />
                </span>
                <div className="min-w-0">
                  <h2 className="kop-2">{groep.titel}</h2>
                  <p className="mt-1 text-sm text-warm">{groep.intro}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groep.items.map((n) => (
                  <Link
                    key={n.slug}
                    href={`/normen/${n.slug}`}
                    className="group flex flex-col rounded-xl border border-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-amber-400"
                  >
                    <span className="flex items-center gap-3">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 transition group-hover:bg-amber-500 group-hover:text-white">
                        <NormIcoon soort={n.categorie} className="h-7 w-7" />
                      </span>
                      <span className="eyebrow">{n.code}</span>
                    </span>
                    <span className="mt-3 font-display text-lg font-extrabold text-ink-900 group-hover:text-amber-800">
                      {n.korteTitel}
                    </span>
                    <span className="mt-2 text-sm text-warm">{n.eenRegel}</span>
                    <span className="mt-auto pt-4 text-sm font-bold uppercase tracking-wide text-amber-700">
                      Klassen bekijken &rarr;
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-12 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">
          Prijzen staan niet online. Klanten zien hun eigen prijzen in het{' '}
          <Link href="/portaal" className="font-semibold text-amber-700 underline underline-offset-2">
            klantportaal
          </Link>
          ; vraag anders een offerte aan.
        </p>
      </section>

      <ContactSectie
        title="Welke norm en welke klasse heb jij nodig?"
        intro="Vertel wat je mensen doen en waar ze staan, dan zoeken we uit welke norm erbij hoort en welke klasse genoeg is. Passen doe je in Hengelo Gld of we komen bij jullie langs."
      />
    </>
  );
}
