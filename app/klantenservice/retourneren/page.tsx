import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { Faq } from '@/components/Faq';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/jsonld';
import { site } from '@/content/site';
import { RETOUR_METHODES, retourtermijnDagen } from '@/lib/retourportaal';
import { vraagRetourlinkAan } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Retourneren',
  description:
    'Iets terugsturen? Meld je retour online aan met je ordernummer en e-mailadres. In de Achterhoek halen we het gewoon bij je op.',
  alternates: { canonical: '/klantenservice/retourneren' },
};

const STAPPEN = [
  { t: 'Ordernummer en e-mail', d: 'Je vindt het ordernummer op de pakbon en in de bevestigingsmail.' },
  { t: 'Link in je mailbox', d: 'Wij mailen een beveiligde link naar het adres dat bij de bestelling hoort.' },
  { t: 'Kies wat terug moet', d: 'Vink de artikelen aan, geef het aantal en de reden op.' },
  { t: 'Kies hoe', d: 'Wij halen het op, je geeft het af in Hengelo, of je stuurt het zelf op.' },
  { t: 'Wij pakken het op', d: 'Binnen één werkdag hoor je van ons. De status volg je via dezelfde link.' },
];

const WEL = [
  'Onbedrukte artikelen in originele staat, met het label er nog aan',
  'Verkeerd geleverd of beschadigd binnengekomen',
  'Bedrukte of geborduurde kleding waarbij de uitvoering niet klopt',
  'Te veel besteld, zolang het binnen de termijn valt',
];

const NIET = [
  'Kleding die met jouw logo is bedrukt of geborduurd en waarmee niets mis is — die kunnen we niet doorverkopen',
  'Gedragen of gewassen artikelen',
  'Artikelen die speciaal voor jou op maat zijn gemaakt',
  'Ondergoed en sokken waarvan de verpakking open is',
];

export default async function RetournerenPage({
  searchParams,
}: {
  searchParams: Promise<{ verstuurd?: string }>;
}) {
  const sp = await searchParams;
  const termijn = await retourtermijnDagen();

  const vragen = [
    { q: 'Hoe lang heb ik de tijd?', a: `Je meldt de retour binnen ${termijn} dagen na de besteldatum aan. Daarna heb je nog 14 dagen om de kleding daadwerkelijk terug te brengen of op te sturen.` },
    { q: 'Ik heb geen account, kan ik toch retourneren?', a: 'Ja. Daar is dit portaal juist voor. Je hebt alleen je ordernummer en het e-mailadres nodig dat bij de bestelling hoort. Heb je wél een account, dan gaat het net zo makkelijk via je bestellingen in het portaal.' },
    { q: 'Wat kost het?', a: 'Ophalen in ons werkgebied en zelf afgeven in Hengelo Gld zijn gratis. Stuur je zelf op, dan zijn de verzendkosten voor jou — behalve als het aan ons ligt, dan betalen wij.' },
    { q: 'Kan ik kleding met mijn logo terugsturen?', a: 'Alleen als er iets mis is met de uitvoering, bijvoorbeeld een scheef logo of een verkeerde kleur garen. Een geborduurd stuk met jouw bedrijfsnaam erop kunnen we niet aan iemand anders verkopen, dus daar kunnen we niets mee als er niks mis mee is.' },
    { q: 'Krijg ik geld terug of een creditfactuur?', a: 'Werk je op rekening, dan zetten we een creditfactuur klaar. Heb je vooruitbetaald, dan storten we terug op dezelfde rekening. In beide gevallen binnen vijf werkdagen nadat we de retour hebben gecontroleerd.' },
    { q: 'Wat als ik alleen een andere maat wil?', a: `Meld hem gewoon aan als retour en zet de gewenste maat in de toelichting. Dan leggen we het nieuwe stuk klaar en nemen we het oude mee als we langskomen. Bellen mag ook: ${site.phone}.` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([
        { name: 'Home', url: '/' },
        { name: 'Klantenservice', url: '/klantenservice' },
        { name: 'Retourneren', url: '/klantenservice/retourneren' },
      ])} />
      <JsonLd data={faqJsonLd(vragen)} />

      <PageHero
        eyebrow="Klantenservice"
        title="Iets terugsturen? Regel het hier in twee minuten"
        intro={`Meld je retour online aan met je ordernummer en e-mailadres. Je hebt er geen account voor nodig, en in ons werkgebied halen we het gewoon bij je op.`}
        kruimels={[{ label: 'Klantenservice', href: '/klantenservice' }]}
        beeld={
          <div className="w-full rounded-xl border border-line bg-white p-6 shadow-card sm:p-8">
            {sp?.verstuurd ? (
              <>
                <h2 className="font-display text-xl font-extrabold text-ink-900">Kijk in je mailbox</h2>
                <p className="mt-3 text-sm leading-relaxed text-warm">
                  Hoort het opgegeven adres bij die bestelling, dan staat er nu een e-mail met een beveiligde link
                  waarmee je de retour afmaakt. De link is 14 dagen geldig.
                </p>
                <p className="mt-4 text-sm text-warm">
                  Niets ontvangen? Kijk even in je spam, of bel{' '}
                  <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-700 underline underline-offset-2">
                    {site.phone}
                  </a>
                  . We regelen het ook gewoon telefonisch.
                </p>
                <Link href="/klantenservice/retourneren" className="mt-6 inline-block text-sm font-semibold text-amber-700 underline underline-offset-2">
                  Nog een retour aanmelden
                </Link>
              </>
            ) : (
              <>
                <h2 className="font-display text-xl font-extrabold text-ink-900">Start je retour</h2>
                <p className="mt-2 text-sm text-warm">
                  Je vindt het ordernummer op de pakbon en in de bevestigingsmail.
                </p>
                <form action={vraagRetourlinkAan} className="mt-6 space-y-4">
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                  <div>
                    <label htmlFor="ordernummer" className="block text-sm font-semibold text-ink-800">Ordernummer</label>
                    <input
                      id="ordernummer" name="ordernummer" required inputMode="numeric" placeholder="Bijv. 1042"
                      className="mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2.5 text-ink-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-ink-800">E-mailadres van de bestelling</label>
                    <input
                      id="email" name="email" type="email" required autoComplete="email"
                      className="mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2.5 text-ink-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                  <button type="submit" className="btn-primary w-full">Stuur mij de retourlink</button>
                  <p className="text-xs leading-relaxed text-warm">
                    Heb je een account? Dan gaat het nog sneller via{' '}
                    <Link href="/portaal/retouren" className="font-semibold text-amber-700 underline underline-offset-2">
                      je bestellingen in het portaal
                    </Link>
                    .
                  </p>
                </form>
              </>
            )}
          </div>
        }
      />

      {/* Vijf stappen, als doorlopende reeks in plaats van losse kaartjes. */}
      <section className="container-x py-14 sm:py-16">
        <h2 className="text-balance kop-2">Zo gaat het</h2>
        <ol className="mt-8 grid gap-px border-y border-line sm:grid-cols-2 lg:grid-cols-5 lg:gap-8 lg:border-0">
          {STAPPEN.map((s, i) => (
            <li key={s.t} className="border-b border-line py-5 last:border-b-0 lg:border-b-0 lg:border-t-2 lg:border-line lg:pt-5">
              <p className="font-display text-2xl font-extrabold leading-none text-amber-700">
                {String(i + 1).padStart(2, '0')}
              </p>
              <p className="mt-3 font-semibold text-ink-900">{s.t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-warm">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Wel en niet, naast elkaar: dit is de vraag die mensen echt hebben. */}
      <section className="border-y border-line bg-mist">
        <div className="container-x grid gap-10 py-14 sm:py-16 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-extrabold text-ink-900 sm:text-2xl">Dit kun je terugsturen</h2>
            <ul className="mt-5 space-y-3">
              {WEL.map((w) => (
                <li key={w} className="flex gap-3 text-sm leading-relaxed text-ink-800">
                  <span aria-hidden="true" className="mt-0.5 shrink-0 font-bold text-amber-700">✓</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-ink-900 sm:text-2xl">Dit lukt helaas niet</h2>
            <ul className="mt-5 space-y-3">
              {NIET.map((n) => (
                <li key={n} className="flex gap-3 text-sm leading-relaxed text-warm">
                  <span aria-hidden="true" className="mt-0.5 shrink-0 font-bold text-ink-300">✕</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 max-w-[58ch] text-sm text-warm">
              Twijfel je? Bel gewoon even. We kijken er eerlijk naar en zoeken meestal wel een oplossing.
            </p>
          </div>
        </div>
      </section>

      {/* Drie manieren, met de kosten er meteen bij. */}
      <section className="container-x py-14 sm:py-16">
        <h2 className="text-balance kop-2">Drie manieren om het terug te krijgen</h2>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {RETOUR_METHODES.map((m) => (
            <div key={m.code} className="rounded-xl border border-line bg-white p-6">
              <p className="font-display text-lg font-semibold text-ink-900">{m.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-warm">{m.uitleg}</p>
              <p className="mt-4 inline-block rounded border border-line bg-mist px-2 py-1 text-xs font-bold text-ink-800">
                {m.kosten}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-[62ch] text-sm text-warm">
          Retouradres: {site.name}, {site.address.street}, {site.address.postalCode} {site.address.city}. Stuur je zelf op,
          voeg dan het retournummer bij zodat we weten waar het bij hoort.
        </p>
      </section>

      <Faq items={vragen} title="Veelgestelde vragen over retourneren" />
    </>
  );
}
