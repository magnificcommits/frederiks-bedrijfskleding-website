import type { Metadata } from 'next';
import { LeadForm } from '@/components/LeadForm';
import { PageHero } from '@/components/PageHero';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Neem contact op met Frederiks Bedrijfskleding in Hengelo (Gld). Bel, mail of vraag online advies aan.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Kom gerust langs of neem contact op"
        intro={`${site.address.locationNote} Showroombezoek op afspraak. We komen ook graag bij u langs.`} />
      <section className="container-x py-16">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">{site.name}</h2>
            <address className="mt-4 not-italic text-warm">
              {site.address.street}<br />
              {site.address.postalCode} {site.address.city}<br /><br />
              Tel/WhatsApp: <a href={`tel:${site.phoneIntl}`} className="text-amber-600 hover:underline">{site.phone}</a><br />
              E-mail: <a href={`mailto:${site.email}`} className="text-amber-600 hover:underline">{site.email}</a>
            </address>
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
            <p className="mt-2 text-warm">We reageren zo snel mogelijk persoonlijk.</p>
            <div className="mt-6"><LeadForm /></div>
          </div>
        </div>
      </section>
    </>
  );
}
