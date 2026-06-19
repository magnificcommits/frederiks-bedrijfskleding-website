import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { Faq } from '@/components/Faq';
import { CtaBand } from '@/components/CtaBand';
import { site } from '@/content/site';
import {
  klantenserviceFaq,
  retourbeleid,
  garantie,
  levering,
  serviceOnderwerpen,
} from '@/content/klantenservice';
import { getRetourtermijn } from '@/lib/portaal/service';

export const metadata: Metadata = {
  title: 'Klantenservice',
  description:
    'Alle service-informatie van Frederiks Bedrijfskleding op één plek: contact, veelgestelde vragen, retourbeleid, garantie en levertijd. Persoonlijk antwoord via telefoon, e-mail of WhatsApp.',
  alternates: { canonical: '/klantenservice' },
};

const waNummer = site.whatsapp.replace(/[^0-9]/g, '');

export default async function KlantenservicePage() {
  const retourtermijn = await getRetourtermijn();

  return (
    <>
      <PageHero
        eyebrow="Klantenservice"
        title="Hulp, advies en service op één plek"
        intro="Heb je een vraag over een bestelling, een maat, het bedrukken of het klantportaal? Hieronder vind je de antwoorden, plus ons retourbeleid en garantie. Kom je er niet uit, dan helpt je vaste aanspreekpunt je persoonlijk verder."
      />

      <section className="container-x py-12 sm:py-16">
        <p className="eyebrow">Direct contact</p>
        <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Even iemand spreken?</h2>
        <p className="mt-4 max-w-2xl text-warm">
          Liever meteen contact dan zelf zoeken? Bel of app ons gerust. Je krijgt antwoord van iemand die je bedrijf kent.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <a
            href={`tel:${site.phoneIntl}`}
            className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:border-amber-500"
          >
            <h3 className="text-base font-bold text-ink-900">Bellen</h3>
            <p className="mt-2 text-sm text-warm">Op werkdagen tussen 09:00 en 17:00 uur.</p>
            <span className="mt-3 inline-block font-bold text-amber-600">{site.phone}</span>
          </a>
          <a
            href={`mailto:${site.email}`}
            className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:border-amber-500"
          >
            <h3 className="text-base font-bold text-ink-900">E-mailen</h3>
            <p className="mt-2 text-sm text-warm">We reageren meestal nog dezelfde werkdag.</p>
            <span className="mt-3 inline-block break-all font-semibold text-amber-600">{site.email}</span>
          </a>
          <a
            href={`https://wa.me/${waNummer}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:border-amber-500"
          >
            <h3 className="text-base font-bold text-ink-900">WhatsApp</h3>
            <p className="mt-2 text-sm text-warm">Snel een korte vraag stellen? Stuur ons een bericht.</p>
            <span className="mt-3 inline-block font-semibold text-amber-600">Open WhatsApp &rarr;</span>
          </a>
        </div>
      </section>

      <section className="border-y border-line bg-mist">
        <div className="container-x py-12">
          <p className="eyebrow">Zelf snel regelen</p>
          <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Veelgevraagde onderwerpen</h2>
          <ul className="mt-6 flex flex-wrap gap-3">
            {serviceOnderwerpen.map((o) => (
              <li key={o.href}>
                <a
                  href={o.href}
                  className="inline-flex rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-800 transition hover:border-amber-500 hover:text-amber-600"
                >
                  {o.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div id="veelgestelde-vragen" className="scroll-mt-24">
        <Faq items={klantenserviceFaq} />
      </div>

      <section id="retourbeleid" className="scroll-mt-24 border-t border-line bg-mist">
        <div className="container-x py-16">
          <p className="eyebrow">Service</p>
          <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Retourbeleid</h2>
          <div className="mt-6 grid gap-10 lg:grid-cols-2">
            <div>
              <p className="rounded-2xl border-l-2 border-amber-500 bg-white p-5 text-lg font-semibold text-ink-900 shadow-soft">
                Je kunt tot {retourtermijn} dagen na ontvangst retourneren.
              </p>
              <p className="mt-4 text-warm">{retourbeleid.intro}</p>
              <p className="mt-4 text-sm text-warm">
                Heb je een inlog voor het klantportaal? Dan meld je een retour het makkelijkst aan via{' '}
                <Link href="/portaal/retouren" className="font-semibold text-amber-600 hover:underline">
                  het portaal
                </Link>
                .
              </p>
            </div>
            <ol className="space-y-4">
              {retourbeleid.stappen.map((s, i) => (
                <li key={s.t} className="rounded-xl border border-line bg-white p-5 shadow-soft">
                  <span className="font-display text-2xl font-extrabold text-amber-500">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-2 text-base font-bold text-ink-900">{s.t}</h3>
                  <p className="mt-2 text-sm text-warm">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="garantie" className="scroll-mt-24 container-x py-16">
        <p className="eyebrow">Service</p>
        <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Garantie</h2>
        <div className="mt-6 max-w-3xl">
          <p className="text-lg text-warm">{garantie.intro}</p>
          <p className="mt-4 text-warm">{garantie.tekst}</p>
          <div className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h3 className="text-base font-bold text-ink-900">Een garantieclaim melden</h3>
            <p className="mt-2 text-sm text-warm">{garantie.hoe}</p>
            <p className="mt-3 text-sm">
              <a href={`tel:${site.phoneIntl}`} className="font-bold text-ink-900 hover:text-amber-600">
                {site.phone}
              </a>
              <span className="text-warm"> of </span>
              <a href={`mailto:${site.email}`} className="font-semibold text-amber-600 hover:underline">
                {site.email}
              </a>
            </p>
          </div>
        </div>
      </section>

      <section id="levertijd-en-bezorging" className="scroll-mt-24 border-t border-line bg-mist">
        <div className="container-x py-16">
          <p className="eyebrow">Service</p>
          <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Levertijd en bezorging</h2>
          <div className="mt-6 max-w-3xl">
            <p className="text-warm">{levering.intro}</p>
            <ul className="mt-6 space-y-3">
              {levering.punten.map((p) => (
                <li key={p} className="flex gap-3 text-warm">
                  <span aria-hidden="true" className="mt-1 text-amber-500">&#10003;</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <CtaBand
        title="Staat je vraag er niet bij?"
        text="Vraag vrijblijvend advies aan of bel ons. We denken graag met je mee en stemmen alles af op jouw situatie."
      />
    </>
  );
}
