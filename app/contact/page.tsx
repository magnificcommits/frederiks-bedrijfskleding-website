import type { Metadata } from 'next';
import { LeadForm } from '@/components/LeadForm';
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
      <section className="container-x py-16">
        <div className="mx-auto grid max-w-[72rem] gap-12 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div>
            <h2 className="text-2xl font-bold">{site.name}</h2>
            <address className="mt-4 not-italic text-warm">
              {site.address.street}<br />
              {site.address.postalCode} {site.address.city}<br /><br />
              Tel/WhatsApp: <a href={`tel:${site.phoneIntl}`} className="text-amber-700 hover:underline">{site.phone}</a><br />
              E-mail: <a href={`mailto:${site.email}`} className="text-amber-700 hover:underline">{site.email}</a>
            </address>
            <p className="mt-3 text-sm">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.name}, ${site.address.street}, ${site.address.postalCode} ${site.address.city}`)}`}
                className="inline-flex min-h-[44px] items-center font-semibold text-amber-700 underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                Route plannen in Google Maps
              </a>
            </p>
            <p className="mt-1 text-xs text-warm">KvK {bedrijf.kvk} &middot; btw {bedrijf.btw}</p>
            <h3 className="mt-8 text-lg font-semibold text-ink-800">Openingstijden</h3>
            <ul className="mt-3 space-y-1 text-sm text-warm">
              {site.openingHours.map((h) => (
                <li key={h.dayCode} className="flex justify-between border-b border-line py-1">
                  <span>{h.day}</span><span>{h.open}–{h.close}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-warm">{site.openingNote}</p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Stuur een bericht</h2>
            <p className="mt-2 text-warm">
              {site.owner.split(' ')[0]} leest het zelf en reageert {site.beloftKort}, op werkdagen.
            </p>
            <p className="mt-2 text-sm text-warm" data-plek="contact">
              Liever meteen een moment vastleggen?{' '}
              <Link href="/afspraak" className="font-semibold text-amber-700 underline underline-offset-2" data-cta="afspraak">
                Plan een adviesgesprek
              </Link>
              . Weet je al wat je zoekt?{' '}
              <Link href="/offerte" className="font-semibold text-amber-700 underline underline-offset-2" data-cta="offerte">
                Vraag direct een offerte aan
              </Link>
              .
            </p>
            <div className="mt-6"><LeadForm /></div>
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
