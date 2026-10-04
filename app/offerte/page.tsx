import type { Metadata } from 'next';
import Link from 'next/link';
import { OfferteAanvraag } from '@/components/OfferteAanvraag';
import { PageHero } from '@/components/PageHero';
import { JsonLd } from '@/components/JsonLd';
import { Faq } from '@/components/Faq';
import { JessiPaneel } from '@/components/JessiPaneel';
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
        donker
        eyebrow="Offerte aanvragen"
        title="Binnen 24 uur een reactie op je offerteaanvraag"
        intro={`Vertel kort wat je zoekt. ${site.owner.split(' ')[0]} kijkt er zelf naar en belt je om het door te nemen.`}
        punten={['Reactie binnen 24 uur', 'Passen op locatie', 'Kost niets, je zit nergens aan vast']}
      />

      <section className="bg-mist">
        <div className="container-x sec-md grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8">
          <OfferteAanvraag defaultBranche={branche ?? ''} defaultProduct={product ?? ''} />

          <aside className="space-y-4 self-start lg:sticky lg:top-28">
            <div className="rounded-2xl border border-line bg-white p-6">
              <h2 className="font-display text-lg font-extrabold text-ink-900">Wat er gebeurt na je aanvraag</h2>
              <ol className="mt-4">
                {stappen.map((s, i) => (
                  <li key={s.nr} className="relative flex gap-4 pb-5 last:pb-0">
                    {i < stappen.length - 1 && <span className="absolute left-4 top-8 h-[calc(100%-2rem)] border-l-2 border-dashed border-amber-400" aria-hidden="true" />}
                    <span className="stap-nr" data-stand="nu" aria-hidden="true">{i + 1}</span>
                    <span>
                      <span className="block font-semibold text-ink-900">{s.t}</span>
                      <span className="mt-1 block text-sm leading-snug text-warm">{s.d}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <JessiPaneel
              plek="offerte-zijbalk"
              kop="Liever meteen bellen?"
              tekst={`Je krijgt ${site.owner.split(' ')[0]} zelf aan de lijn. Geen keuzemenu, geen callcenter.`}
              punten={[]}
            />

            <div className="rounded-2xl border border-line bg-white p-6" data-plek="offerte-zijbalk">
              <h2 className="font-display text-lg font-extrabold text-ink-900">Eerst even praten?</h2>
              <p className="mt-1 text-sm text-warm">Plan een kort adviesgesprek, op de zaak of in de showroom.</p>
              <Link href="/afspraak" className="btn-outline mt-4 w-full" data-cta="afspraak">Plan een adviesgesprek</Link>
              <dl className="mt-5 border-t border-line pt-4 text-sm">
                {site.openingHours.map((h) => (
                  <div key={h.dayCode} className="flex justify-between gap-4 py-0.5">
                    <dt className="text-warm">{h.day}</dt>
                    <dd className="font-medium tabular-nums text-ink-800">{h.open} tot {h.close}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>
      </section>

      <Faq items={faq} title="Veelgestelde vragen over de offerte" />
    </>
  );
}
