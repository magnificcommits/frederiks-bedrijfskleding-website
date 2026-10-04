import type { Metadata } from 'next';
import { LeadForm } from '@/components/LeadForm';
import { JessiPaneel } from '@/components/JessiPaneel';
import { PageHero } from '@/components/PageHero';
import { bedrijf } from '@/content/bedrijf';
import Link from 'next/link';
import { AfspraakSectie } from '@/components/AfspraakSectie';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Neem contact op met Frederiks Bedrijfskleding in Hengelo (Gld). Bel of app Jessi, mail, of plan een adviesgesprek. Reactie binnen 24 uur op werkdagen.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Kom gerust langs of neem contact op"
        intro={`${site.address.locationNote} Showroombezoek op afspraak. We komen ook graag bij je langs.`} />
      <section className="bg-mist">
        <div className="container-x sec-md grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-8">
          <div className="space-y-4">
            <JessiPaneel plek="contact" kop="Bel, app of kom langs" tekst={`${site.owner.split(' ')[0]} neemt zelf op. Op werkdagen reageren we binnen 24 uur.`} punten={[]} />
            <div className="rounded-2xl border border-line bg-white p-6">
              <h2 className="font-display text-lg font-extrabold text-ink-900">{site.name}</h2>
              <address className="mt-2 not-italic text-warm">
                {site.address.street}<br />
                {site.address.postalCode} {site.address.city}
              </address>
              <p className="mt-2 text-sm">
                <a href={`mailto:${site.email}`} className="font-semibold text-amber-700 hover:underline">{site.email}</a>
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.name}, ${site.address.street}, ${site.address.postalCode} ${site.address.city}`)}`}
                className="btn-outline mt-4 w-full"
                target="_blank"
                rel="noopener noreferrer"
              >
                Route plannen in Google Maps
              </a>
              <dl className="mt-5 border-t border-line pt-4 text-sm">
                {site.openingHours.map((h) => (
                  <div key={h.dayCode} className="flex justify-between gap-4 py-0.5">
                    <dt className="text-warm">{h.day}</dt>
                    <dd className="font-medium tabular-nums text-ink-800">{h.open} tot {h.close}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-sm text-warm">{site.openingNote}</p>
              <p className="mt-3 text-xs text-warm">KvK {bedrijf.kvk}, btw {bedrijf.btw}</p>
            </div>
          </div>
          <div className="self-start rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
            <h2 className="kop-2">Stuur een bericht</h2>
            <p className="mt-2 max-w-[60ch] text-warm" data-plek="contact">
              {site.owner.split(' ')[0]} leest het zelf en reageert {site.beloftKort}, op werkdagen. Weet je al wat je zoekt?{' '}
              <Link href="/offerte" className="font-semibold text-amber-700 underline underline-offset-2" data-cta="offerte">Vraag direct een offerte aan</Link>.
            </p>
            <div className="mt-6"><LeadForm kaal /></div>
          </div>
        </div>
      </section>
      <AfspraakSectie
        titel="Liever meteen een afspraak?"
        intro="Kies zelf een moment voor een belgesprek, een bezoek aan de showroom of een pasdag bij jou op het bedrijf. Je krijgt direct een bevestiging."
        bron="Contactpagina"
      />
    </>
  );
}
