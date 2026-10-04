import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { ContactSectie } from '@/components/ContactSectie';
import { JsonLd } from '@/components/JsonLd';
import { NormIcoon } from '@/components/NormIcoon';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { site } from '@/content/site';
import { normen, normenPerCategorie } from '@/content/normen';
import { Pijl } from '@/components/Pijl';

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

        <h2 className="kop-2 mt-10">{normen.length} normen, gegroepeerd naar risico</h2>

        {/* Elke risicogroep is een paneel; de panelen staan in twee kolommen, zodat een groep met één norm geen halflege rij oplevert. */}
        <div className="mt-6 gap-5 lg:columns-2">
          {normenPerCategorie.map((groep) => (
            <section key={groep.key} className="mb-5 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              <div className="flex items-center gap-4 bg-ink-900 px-5 py-4 text-white">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700">
                  <NormIcoon soort={groep.key} className="h-8 w-8" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-extrabold text-white">{groep.titel}</h3>
                  <p className="text-sm text-ink-200">{groep.intro}</p>
                </div>
              </div>
              <ul className="divide-y divide-line">
                {groep.items.map((n) => (
                  <li key={n.slug}>
                    <Link href={`/normen/${n.slug}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-mist">
                      <span className="min-w-0 flex-1">
                        <span className="inline-block rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-700">{n.code}</span>
                        <span className="mt-1 block font-display text-[1.0625rem] font-extrabold text-ink-900">{n.korteTitel}</span>
                        <span className="mt-0.5 block text-sm leading-snug text-warm">{n.eenRegel}</span>
                      </span>
                      <Pijl />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-2 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">
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
