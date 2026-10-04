import Link from 'next/link';
import type { Metadata } from 'next';
import { CtaKnoppen } from '@/components/CtaKnoppen';

export const metadata: Metadata = {
  title: 'Pagina niet gevonden',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section className="container-x flex min-h-[50vh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-3xl font-bold">Pagina niet gevonden</h1>
      <p className="mt-3 max-w-md text-warm">
        Deze pagina bestaat niet (meer). Misschien staat wat je zoekt hieronder, of je vraagt het ons gewoon.
      </p>
      <CtaKnoppen plek="404" className="mt-6 flex flex-col items-center" />
      <nav aria-label="Veelgezochte pagina's" className="mt-10 w-full max-w-xl border-t border-line pt-6">
        <ul className="flex flex-wrap justify-center gap-2">
          {[
            { href: '/', label: 'Home' },
            { href: '/assortiment', label: 'Assortiment' },
            { href: '/werkkleding', label: 'Werkkleding' },
            { href: '/werkschoenen', label: 'Werkschoenen' },
            { href: '/bedrukken-borduren', label: 'Bedrukken en borduren' },
            { href: '/kennisbank', label: 'Kennisbank' },
            { href: '/contact', label: 'Contact' },
          ].map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="inline-flex min-h-[44px] items-center rounded-md border border-line px-4 text-sm font-semibold text-ink-800 hover:border-amber-400">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
