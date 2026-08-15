import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { CtaBand } from '@/components/CtaBand';
import { site } from '@/content/site';
import { catalogusOverzicht } from '@/lib/kms/catalogus';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Over ons',
  description:
    'Frederiks Bedrijfskleding wordt gerund door Jessi Frederiks vanuit de Brouwersmolen in Hengelo (Gld). Persoonlijk advies voor bedrijven in de Achterhoek.',
  alternates: { canonical: '/over-ons' },
};

/**
 * Het verhaal stond hier als drie alinea's van vijf regels naast een foto. Dat
 * leest niemand: op een over-ons-pagina scant een bezoeker of hij deze partij
 * vertrouwt, hij bestudeert hem niet.
 *
 * Nu is dezelfde tekst opgeknipt in drie blokken met elk een kop en een jaartal
 * of label ernaast, met de sterkste zin eruit gelicht als citaat en de branches
 * als losse merktekens. Zelfde inhoud, drie keer zo veel aanknopingspunten voor
 * het oog.
 */
const VERHAAL = [
  {
    label: '2020',
    kop: 'Begonnen naast de winkel, in coronatijd',
    tekst:
      'Het begon klein, naast twee kledingwinkels in het dorp. Wat als bijzaak startte, groeide uit tot een vaste waarde voor bedrijfskleding in de Achterhoek.',
  },
  {
    label: 'Nu',
    kop: 'Showroom en bedrukkerij in een molen uit 1801',
    tekst:
      'De Brouwersmolen in Hengelo. Daar hangt de collectie, daar staat de borduurmachine, en daar kun je gewoon binnenlopen op afspraak.',
  },
  {
    label: 'Aanpak',
    kop: 'Eén aanspreekpunt, van advies tot nalevering',
    tekst:
      'Ik luister naar wat je nodig hebt en denk mee. Je krijgt mij, niet elke keer een ander. Ik kom langs om te passen, stel samen met je een pakket samen dat klopt, en regel het bedrukken en borduren in eigen huis. Ook grote maten en een snelle nalevering horen daarbij.',
  },
];

const BRANCHES = ['Bouw', 'Techniek', 'Transport', 'Horeca', 'Zorg', 'Beauty', 'Agrarisch'];

export default async function OverOnsPage() {
  const { merken, totaal } = await catalogusOverzicht();
  const voornaam = site.owner.split(' ')[0];

  const feiten = [
    { waarde: `Sinds ${site.foundedYear}`, label: 'in Hengelo Gld' },
    { waarde: '1801', label: 'bouwjaar van de molen waar we zitten' },
    { waarde: `${merken.length} merken`, label: `${totaal} artikelen om uit te kiezen` },
    { waarde: 'In eigen huis', label: 'bedrukken en borduren, geen tussenpartij' },
  ];

  return (
    <>
      <PageHero
        eyebrow="Over ons"
        title="Persoonlijke aandacht is bij ons geen extra"
        intro={`${site.name} wordt gerund door ${site.owner}, vanuit de Brouwersmolen in ${site.address.city} (Gld).`}
      />

      {/* Feitenstrook: vier dingen die je in twee seconden meeneemt. */}
      <section className="border-b border-line bg-ink-900 text-white">
        <div className="container-x grid grid-cols-2 gap-x-6 gap-y-8 py-10 lg:grid-cols-4">
          {feiten.map((f) => (
            <div key={f.label} className="border-l-2 border-amber-500 pl-4">
              <p className="font-display text-2xl font-extrabold leading-none sm:text-3xl">{f.waarde}</p>
              <p className="mt-2 text-sm leading-snug text-ink-100">{f.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Het verhaal, in blokken naast een meelopende foto. */}
      <section className="container-x py-16 sm:py-20">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,38rem)_minmax(0,34rem)] lg:justify-between">
          <div>
            <h2 className="text-balance kop-2">
              Hoe dit bedrijf is ontstaan
            </h2>

            <div className="mt-8 space-y-px border-y border-line">
              {VERHAAL.map((v) => (
                <article key={v.label} className="grid gap-x-6 gap-y-2 border-b border-line py-6 last:border-b-0 sm:grid-cols-[6rem_minmax(0,1fr)]">
                  <p className="pt-1 text-[13px] font-bold uppercase tracking-[0.14em] text-amber-700">
                    {v.label}
                  </p>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-ink-900">{v.kop}</h3>
                    <p className="mt-2 max-w-[58ch] leading-relaxed text-warm">{v.tekst}</p>
                  </div>
                </article>
              ))}
            </div>

            <blockquote className="mt-10 border-l-2 border-amber-500 pl-6">
              <p className="text-balance font-display text-xl font-extrabold leading-snug text-ink-900 sm:text-2xl">
                “Ze willen geholpen worden door iemand die ze kent, niet door een webshop.”
              </p>
              <footer className="mt-3 text-sm text-warm">{site.owner}</footer>
            </blockquote>

            <div className="mt-10">
              <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-warm">
                We kleden bedrijven in
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {BRANCHES.map((b) => (
                  <li
                    key={b}
                    className="rounded-md border border-line bg-mist px-3 py-1.5 text-sm font-semibold text-ink-800"
                  >
                    {b}
                  </li>
                ))}
              </ul>
              <p className="mt-4 max-w-[58ch] text-sm text-warm">
                De meeste klanten zitten in de bouw.{' '}
                <Link href="/voor" className="font-semibold text-amber-700 underline underline-offset-2">
                  Bekijk wat er per vakgebied speelt
                </Link>
                .
              </p>
            </div>
          </div>

          {/* Foto blijft meelopen zolang het verhaal doorscrolt. */}
          <div className="lg:sticky lg:top-28">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line shadow-card">
              <Image
                src="/Frederiks-bedrijfskleding-1.jpg"
                alt={`${voornaam} in de showroom in de Brouwersmolen te ${site.address.city}`}
                fill sizes="(max-width: 1024px) 90vw, 34rem" className="object-cover"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line">
                <Image src="/Bedrijfskleding-bedrukken-en-borduren.jpg" alt="Logo borduren in eigen huis"
                  fill sizes="17rem" className="object-cover" />
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line">
                <Image src="/Bedrijfskleding-Achterhoek.jpg" alt="Werkkleding op de werkvloer in de Achterhoek"
                  fill sizes="17rem" className="object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Waar je op mag rekenen. */}
      <section className="border-t border-line bg-mist">
        <div className="container-x py-14 sm:py-16">
          <h2 className="text-balance kop-2">Waar je op mag rekenen</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {site.usps.map((u) => (
              <div key={u.title} className="rounded-lg border border-line bg-white p-5">
                <h3 className="text-base font-semibold text-ink-900">{u.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-warm">{u.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
