import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { NieuwsbriefForm } from '@/components/NieuwsbriefForm';
import { site } from '@/content/site';
import { branches } from '@/content/branches';
import { plaatsen } from '@/content/plaatsen';

export function Footer() {
  return (
    <footer className="mt-24 border-t-2 border-dashed border-amber-500 bg-ink-900 text-ink-100">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm text-ink-200">{site.tagline}.</p>
          <p className="mt-4 text-sm text-ink-200">
            {site.address.street}<br />
            {site.address.postalCode} {site.address.city}
          </p>
          <p className="mt-3 text-sm">
            <a href={`tel:${site.phoneIntl}`} className="text-amber-300 hover:underline">{site.phone}</a><br />
            <a href={`mailto:${site.email}`} className="text-amber-300 hover:underline">{site.email}</a>
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Branches</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {branches.map((b) => (
              <li key={b.slug}><Link href={`/branches/${b.slug}`} className="text-ink-200 hover:text-white">{b.navLabel}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Regio</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {plaatsen.slice(0, 7).map((p) => (
              <li key={p.slug}><Link href={`/regio/${p.slug}`} className="text-ink-200 hover:text-white">{p.name}</Link></li>
            ))}
            <li><Link href="/regio" className="font-semibold text-amber-400 hover:text-amber-300">Alle regio&rsquo;s</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Snel naar</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/pakket-samenstellen" className="text-ink-200 hover:text-white">Pakket samenstellen</Link></li>
            <li><Link href="/werkkleding" className="text-ink-200 hover:text-white">Werkkleding</Link></li>
            <li><Link href="/werkschoenen" className="text-ink-200 hover:text-white">Werkschoenen</Link></li>
            <li><Link href="/bedrukken-borduren" className="text-ink-200 hover:text-white">Bedrukken en borduren</Link></li>
            <li><Link href="/kennisbank" className="text-ink-200 hover:text-white">Kennisbank</Link></li>
            <li><Link href="/over-ons" className="text-ink-200 hover:text-white">Over ons</Link></li>
            <li><Link href="/offerte" className="text-ink-200 hover:text-white">Advies aanvragen</Link></li>
            <li><Link href="/klantenservice/retourneren" className="text-ink-200 hover:text-white">Retourneren</Link></li>
            <li><Link href="/privacy" className="text-ink-200 hover:text-white">Privacy</Link></li>
            <li><Link href="/algemene-voorwaarden" className="text-ink-200 hover:text-white">Algemene voorwaarden</Link></li>
            <li><Link href="/disclaimer" className="text-ink-200 hover:text-white">Disclaimer</Link></li>
          </ul>
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <h3 className="text-sm font-semibold text-white">Nieuwsbrief</h3>
          <p className="mt-4 max-w-xs text-sm text-ink-200">Blijf op de hoogte van werkkleding-tips en nieuws.</p>
          <NieuwsbriefForm />
        </div>
      </div>
      <div className="border-t border-ink-800">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-6 text-xs text-ink-300 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} {site.name}. Alle rechten voorbehouden</p>
          <p>Bedrijfskleding in de Achterhoek</p>
        </div>
      </div>
    </footer>
  );
}
