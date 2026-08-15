import type { Metadata } from 'next';
import Link from 'next/link';
import { OfferteAanvraag } from '@/components/OfferteAanvraag';
import { PageHero } from '@/components/PageHero';
import { JsonLd } from '@/components/JsonLd';
import { Uitklap } from '@/components/Uitklap';
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/jsonld';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Offerte aanvragen, binnen 24 uur reactie',
  description:
    'Vraag een offerte aan bij Frederiks Bedrijfskleding in Hengelo Gld. Binnen 24 uur persoonlijk bericht, passen op locatie en eigen bedrukken en borduren in de Achterhoek.',
  alternates: { canonical: '/offerte' },
};

const stappen = [
  {
    nr: '01',
    t: 'Binnen 24 uur bericht',
    d: 'Op werkdagen krijg je binnen 24 uur antwoord. Meestal een telefoontje, want in vijf minuten weten we vaak meer dan in tien mails.',
  },
  {
    nr: '02',
    t: 'We plannen een pasafspraak',
    d: 'We komen langs met pasmodellen, of je loopt binnen in de showroom in Hengelo Gld. Iedereen past, niemand raakt werktijd kwijt.',
  },
  {
    nr: '03',
    t: 'Je krijgt een offerte met alles erin',
    d: 'Kleding, maten, logo en levering compleet op papier. Geen verrassingen achteraf en geen kleine lettertjes.',
  },
];

const faq = [
  {
    q: 'Hoe snel heb ik de kleding in huis?',
    a: 'Je krijgt binnen 24 uur op werkdagen reactie op je aanvraag. Na de pasafspraak en jouw akkoord op de offerte ligt de kleding er meestal binnen een tot twee weken, afhankelijk van de voorraad en het bedrukken of borduren. Zit je krap in de tijd, zeg het dan meteen, dan kijken we wat er wel kan.',
  },
  {
    q: 'Kost een offerte iets?',
    a: 'Nee. Advies, de pasafspraak en de offerte kosten je niets en je zit nergens aan vast. Je betaalt pas als je akkoord geeft op de offerte.',
  },
  {
    q: 'Kunnen jullie ook kleine aantallen leveren?',
    a: 'Ja. Van één jas voor een nieuwe medewerker tot een complete uitrusting voor honderd man. Omdat we in Hengelo Gld zelf bedrukken en borduren, kunnen we ook klein en snel schakelen. Voor een paar sets bel je meestal het snelst even, dan regelen we het direct.',
  },
];

export default async function OffertePage({
  searchParams,
}: {
  searchParams: Promise<{ branche?: string; product?: string }>;
}) {
  const { branche, product } = await searchParams;

  return (
    <>
      <JsonLd data={faqJsonLd(faq)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: site.url },
          { name: 'Offerte aanvragen', url: `${site.url}/offerte` },
        ])}
      />

      <PageHero
        eyebrow="Offerte aanvragen"
        title="Binnen 24 uur een reactie op je offerteaanvraag"
        intro={`Vertel kort wat je zoekt. ${site.owner.split(' ')[0]} kijkt er zelf naar, belt je om het door te nemen en zorgt dat je een offerte krijgt waar alles in staat.`}
      />

      <section className="container-x py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,44rem)_minmax(0,22rem)] lg:justify-between">
          <div>
            <OfferteAanvraag defaultBranche={branche ?? ''} defaultProduct={product ?? ''} />
          </div>

          <aside className="space-y-6">
            <div className="card">
              <h2 className="font-display text-lg font-bold text-ink-900">Wat er gebeurt na je aanvraag</h2>
              <ol className="mt-4 space-y-4">
                {stappen.map((s) => (
                  <li key={s.nr} className="flex gap-3">
                    <span className="mt-0.5 text-sm font-bold text-amber-700" aria-hidden="true">{s.nr}</span>
                    <span>
                      <span className="block text-sm font-semibold text-ink-900">{s.t}</span>
                      <span className="mt-1 block text-sm text-warm">{s.d}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="seam-card">
              <h2 className="font-display text-lg font-bold text-ink-900">Liever meteen bellen?</h2>
              <p className="mt-2 text-sm text-warm">
                Je krijgt {site.owner.split(' ')[0]} zelf aan de lijn. Geen keuzemenu, geen callcenter, gewoon iemand
                die je bedrijf leert kennen.
              </p>
              <p className="mt-3 text-sm">
                <a href={`tel:${site.phoneIntl}`} className="font-bold text-ink-900 hover:text-amber-800">{site.phone}</a>
                <br />
                <a href={`mailto:${site.email}`} className="font-semibold text-amber-700 hover:underline">{site.email}</a>
              </p>
              <Link href="/contact" className="btn-outline mt-4 w-full">Alle contactgegevens</Link>
            </div>

            <div className="card">
              <h2 className="font-display text-lg font-bold text-ink-900">Wanneer we bereikbaar zijn</h2>
              <dl className="mt-3 space-y-1 text-sm">
                {site.openingHours.map((h) => (
                  <div key={h.dayCode} className="flex justify-between gap-4 border-b border-line py-1 last:border-0">
                    <dt className="text-warm">{h.day}</dt>
                    <dd className="font-medium text-ink-800">{h.open} tot {h.close}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-warm">{site.openingNote}</p>
              <p className="mt-2 text-xs text-warm">
                {site.address.street}, {site.address.postalCode} Hengelo Gld
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-t border-line bg-mist">
        <div className="container-x py-16 sm:py-20">
          <h2 className="font-display kop-2">Veelgestelde vragen over de offerte</h2>
          <div className="mt-8 max-w-3xl divide-y divide-line border-y border-line">
            {faq.map((f) => (
              <Uitklap key={f.q} titel={f.q}>
                <p>{f.a}</p>
              </Uitklap>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
