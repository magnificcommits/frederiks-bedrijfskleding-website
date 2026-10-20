import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { ContactKanalen } from '@/components/ContactPopup';
import { bedrijf } from '@/content/bedrijf';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Neem contact op met Frederiks Bedrijfskleding in Hengelo (Gld). Stuur Jessi een WhatsApp, mail of bel. Afspraken plannen we samen in overleg.',
  alternates: { canonical: '/contact' },
};

/**
 * Contact zonder formulier en zonder online agenda (werkdocument Jessi, 20 okt
 * 2026): de drie kanalen, adres en openingstijden. Afspraken in overleg.
 */
export default function ContactPage() {
  const voornaam = site.owner.split(' ')[0];
  return (
    <>
      <PageHero eyebrow="Contact" title="Neem contact op"
        intro={`Stuur ${voornaam} een appje, mail of bel. Een afspraak in de showroom of bij jou op locatie plannen we samen in overleg.`} />
      <section className="bg-mist">
        <div className="container-x sec-md grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="self-start rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
            <h2 className="font-display text-xl font-extrabold text-ink-900">WhatsApp, mail of bel</h2>
            <p className="mt-2 text-warm">Vertel wat je zoekt. {voornaam} denkt met je mee en maakt een passend voorstel.</p>
            <ContactKanalen plek="contact" className="mt-5" />
          </div>
          <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
            <h2 className="font-display text-xl font-extrabold text-ink-900">{site.name}</h2>
            <address className="mt-2 not-italic text-warm">
              {site.address.street}<br />
              {site.address.postalCode} {site.address.city}
            </address>
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
            <p className="mt-3 text-sm text-warm">Showroombezoek op afspraak. We komen ook graag bij je langs om te passen.</p>
            <p className="mt-3 text-xs text-warm">KvK {bedrijf.kvk}, btw {bedrijf.btw}</p>
          </div>
        </div>
      </section>
    </>
  );
}
