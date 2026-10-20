import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { NieuwsbriefForm } from '@/components/NieuwsbriefForm';
import { site } from '@/content/site';
import { bedrijf } from '@/content/bedrijf';

/**
 * Footer in vier kolommen (werkdocument Jessi, 20 okt 2026): bedrijf, ontdek,
 * informatie en nieuwsbrief. Geen lange branche- of regiolijst meer; juridische
 * gegevens onderaan.
 */
const ontdek = [
  { href: '/branches', label: 'Alle branches' },
  { href: '/werkkleding', label: 'Werkkleding' },
  { href: '/werkschoenen', label: 'Werkschoenen' },
  { href: '/bedrukken-borduren', label: 'Bedrukken en borduren' },
  { href: '/kledingbeheer', label: 'Kledingbeheer' },
  { href: '/kennisbank', label: 'Kennisbank' },
  { href: '/contact', label: 'Contact' },
];
const informatie = [
  { href: '/over-ons', label: 'Over ons' },
  { href: '/klantenservice/retourneren', label: 'Retourneren en garantie' },
  { href: '/algemene-voorwaarden', label: 'Algemene voorwaarden' },
  { href: '/privacy', label: 'Privacyverklaring' },
];

const kop = 'text-sm font-semibold text-white';
const lijst = 'mt-3 space-y-1.5 text-sm sm:mt-4 sm:space-y-2';
const link = 'text-ink-200 hover:text-white';

export function Footer() {
  return (
    <footer className="border-t-2 border-dashed border-amber-500 bg-ink-900 text-ink-100">
      <div className="container-x grid grid-cols-2 gap-x-6 gap-y-8 py-10 sm:gap-10 sm:py-14 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <Logo light />
          <p className="mt-4 text-sm text-ink-200">
            {site.address.street}<br />
            {site.address.postalCode} {site.address.city}
          </p>
          <p className="mt-3 text-sm" data-plek="footer">
            <a href={`tel:${site.phoneIntl}`} className="text-amber-300 hover:underline">{site.phone}</a><br />
            <a href={`mailto:${site.email}`} className="text-amber-300 hover:underline">{site.email}</a>
          </p>
          <p className="mt-3 text-sm text-ink-200">
            Ma t/m vr {site.openingHours[0].open} tot {site.openingHours[0].close}
            <br />
            <span className="text-ink-300">Showroombezoek op afspraak.</span>
          </p>
        </div>
        <div>
          <h3 className={kop}>Ontdek</h3>
          <ul className={lijst}>
            {ontdek.map((i) => <li key={i.href}><Link href={i.href} className={link}>{i.label}</Link></li>)}
          </ul>
        </div>
        <div>
          <h3 className={kop}>Informatie</h3>
          <ul className={lijst}>
            {informatie.map((i) => <li key={i.href}><Link href={i.href} className={link}>{i.label}</Link></li>)}
          </ul>
        </div>
        <div className="col-span-2 lg:col-span-1">
          <h3 className={kop}>Nieuwsbrief</h3>
          <p className="mt-4 max-w-xs text-sm text-ink-200">Blijf op de hoogte van werkkleding-tips en nieuws.</p>
          <NieuwsbriefForm />
        </div>
      </div>
      <div className="border-t border-ink-800">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-6 text-center text-xs text-ink-300 sm:flex-row sm:text-left">
          <p>&copy; {new Date().getFullYear()} {site.name} &middot; KvK {bedrijf.kvk} &middot; btw {bedrijf.btw}</p>
          <p>
            <Link href="/regio" className="hover:text-white">Bedrijfskleding in de Achterhoek</Link>
            {' '}&middot;{' '}<Link href="/disclaimer" className="hover:text-white">Disclaimer</Link>
            {site.social.linkedin && (
              <>
                {' '}&middot;{' '}
                <a href={site.social.linkedin} className="hover:text-white" rel="noopener noreferrer" target="_blank">LinkedIn</a>
              </>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
