import Link from 'next/link';
import Image from 'next/image';
import { listPubliekeProducten, type PubliekProduct } from '@/lib/kms/catalogus';

/**
 * Homepage-band die het klantportaal/kledingbeheer als USP neerzet. Donkere
 * huisstijl-sectie met een compacte, in-house opgebouwde preview (geen externe
 * afbeeldingen). Linkt door naar de volledige /kledingbeheer-pagina.
 */
const punten = [
  { t: 'Eigen kledingassortiment', d: 'Medewerkers zien alleen de kleding die voor hen beschikbaar is.' },
  { t: 'Maten vastgelegd', d: 'De juiste maten staan klaar voor toekomstige bestellingen.' },
  { t: 'Budgetten en goedkeuring', d: 'Bepaal wie wat mag bestellen en stel budgetten in.' },
  { t: 'Overzicht en rapportages', d: 'Inzicht in bestellingen en uitgaven per medewerker.' },
];

/**
 * De voorbeeldkaartjes toonden een leeg grijs vlak waar de foto hoort. Dat leest
 * niet als "voorbeeld" maar als een pagina die nog staat te laden - precies de
 * indruk die je bij een softwarebelofte niet wilt wekken. Ze tonen nu echte
 * artikelen uit de catalogus, met de maat als voorbeeld erbij.
 */
const VOORBEELD = [
  { categorieSlug: 'jassen', maat: 'L' },
  { categorieSlug: 't-shirts-en-polos', maat: 'L' },
  { categorieSlug: 'broeken', maat: '52' },
];

export async function PortaalUsp() {
  const perCategorie = await Promise.all(
    VOORBEELD.map((v) => listPubliekeProducten({ categorieSlug: v.categorieSlug })),
  );
  const voorbeelden = VOORBEELD.map((v, i) => ({
    maat: v.maat,
    product: (perCategorie[i] ?? []).find((p): p is PubliekProduct => Boolean(p.foto)) ?? null,
  })).filter((v) => v.product);

  return (
    <section className="bg-ink-900 text-white">
      <div className="container-x sec-md">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="kop-2">Je eigen online kledingportaal. Gratis bij je bedrijfskleding.</h2>
            <p className="mt-4 text-lg text-ink-100">
              Met ons online kledingportaal beheer je eenvoudig de bedrijfskleding van je medewerkers. Iedereen
              bestelt uit het eigen assortiment, terwijl jij overzicht houdt over bestellingen, maten en budgetten.
              Je bepaalt zelf of je gebruik wilt maken van deze service.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 sm:mt-8 sm:grid-cols-2 sm:gap-y-5">
              {punten.map((p) => (
                <div key={p.t}>
                  <h3 className="flex items-start gap-2 text-base font-bold">
                    <span className="mt-0.5 text-amber-500" aria-hidden="true">✓</span>
                    {p.t}
                  </h3>
                  <p className="mt-1 hidden text-sm text-ink-200 sm:block">{p.d}</p>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Link href="/kledingbeheer" className="btn-primary">Ontdek het kledingportaal</Link>
            </div>
          </div>

          {/* Voorbeeldscherm pas vanaf desktop; op de telefoon is de demo-knop sterker. */}
          <div className="hidden rounded-2xl border border-ink-700 bg-white p-5 shadow-card lg:block">
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-extrabold text-ink-900">Jouw werkkleding</p>
              <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-ink-700">Mark Wassink</span>
            </div>
            <div className="mt-3 rounded-xl border border-line bg-mist p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-warm">Resterend budget</span>
                <span className="font-bold text-ink-900">&euro; 212 van &euro; 350</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-amber-500" style={{ width: '60%' }} aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {voorbeelden.map(({ product, maat }) => (
                <div key={product!.id} className="rounded-lg border border-line p-3">
                  <div className="relative h-20 overflow-hidden rounded-md bg-white">
                    <Image
                      src={product!.foto as string}
                      alt=""
                      fill
                      sizes="140px"
                      className="object-contain p-1"
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-ink-900">{product!.naam}</p>
                  <p className="text-xs text-warm">{product!.merk}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-700">maat {maat}</span>
                    <span className="text-amber-700" aria-hidden="true">+</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] text-warm">Voorbeeldweergave van het klantportaal</p>
          </div>
        </div>
      </div>
    </section>
  );
}
