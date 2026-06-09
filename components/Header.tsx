'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { branches } from '@/content/branches';
import { site } from '@/content/site';

// Primaire items in de hoofdbalk
const primaryNav = [
  { href: '/werkkleding', label: 'Werkkleding' },
  { href: '/werkschoenen', label: 'Werkschoenen' },
  { href: '/bedrukken-borduren', label: 'Bedrukken' },
  { href: '/kennisbank', label: 'Kennisbank' },
  { href: '/referenties', label: 'Referenties' },
];
// Secundaire items in de topbalk
const topNav = [
  { href: '/over-ons', label: 'Over ons' },
  { href: '/contact', label: 'Contact' },
];

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {/* Topbalk: secundaire links + direct contact */}
      <div className="hidden bg-ink-900 text-ink-200 lg:block">
        <div className="mx-auto flex h-9 w-full max-w-7xl items-center justify-between px-5 text-[13px] sm:px-6 lg:px-8">
          <span className="text-ink-300">Bedrijfskleding met persoonlijke aandacht in de Achterhoek</span>
          <div className="flex items-center gap-5">
            {topNav.map((i) => (
              <Link key={i.href} href={i.href} className="font-medium text-ink-100 hover:text-amber-400">{i.label}</Link>
            ))}
            <span className="h-3.5 w-px bg-white/15" aria-hidden="true" />
            <a href={`tel:${site.phoneIntl}`} className="font-semibold text-white hover:text-amber-400">{site.phone}</a>
            <a href={`mailto:${site.email}`} className="text-ink-100 hover:text-amber-400">{site.email}</a>
          </div>
        </div>
      </div>

      {/* Hoofdbalk: logo + primaire navigatie + CTA */}
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden min-w-0 items-center xl:flex" aria-label="Hoofdnavigatie">
            <div className="group relative">
              <button className="whitespace-nowrap rounded-md px-3 py-2.5 text-[15px] font-semibold text-ink-800 hover:bg-mist" aria-haspopup="true">
                Branches
              </button>
              <div className="invisible absolute left-0 top-full w-64 rounded-lg border border-line bg-white p-2 opacity-0 shadow-card transition group-hover:visible group-hover:opacity-100">
                {branches.map((b) => (
                  <Link key={b.slug} href={`/branches/${b.slug}`} className="block rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-mist">
                    {b.navLabel}
                  </Link>
                ))}
              </div>
            </div>
            {primaryNav.map((i) => (
              <Link key={i.href} href={i.href} className="whitespace-nowrap rounded-md px-3 py-2.5 text-[15px] font-semibold text-ink-800 hover:bg-mist">{i.label}</Link>
            ))}
          </nav>
          <Link href="/kledingadvies" className="btn-primary hidden shrink-0 whitespace-nowrap px-5 py-2.5 text-[13px] xl:inline-flex">Vraag advies aan</Link>
          <button className="shrink-0 rounded-md px-3 py-2.5 text-[15px] font-bold text-ink-900 hover:bg-mist xl:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
            Menu
          </button>
        </div>
        {open && (
          <div className="border-t border-line bg-white xl:hidden">
            <nav className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-5 py-4 sm:px-6 lg:px-8" aria-label="Mobiele navigatie">
              {primaryNav.map((i) => (
                <Link key={i.href} href={i.href} className="rounded-md px-3 py-2.5 text-[15px] text-ink-800 hover:bg-mist" onClick={() => setOpen(false)}>{i.label}</Link>
              ))}
              {topNav.map((i) => (
                <Link key={i.href} href={i.href} className="rounded-md px-3 py-2.5 text-[15px] text-ink-800 hover:bg-mist" onClick={() => setOpen(false)}>{i.label}</Link>
              ))}
              <p className="px-3 pt-3 text-xs font-bold uppercase tracking-wide text-warm">Branches</p>
              {branches.map((b) => (
                <Link key={b.slug} href={`/branches/${b.slug}`} className="rounded-md px-3 py-2.5 text-[15px] text-ink-800 hover:bg-mist" onClick={() => setOpen(false)}>{b.navLabel}</Link>
              ))}
              <a href={`tel:${site.phoneIntl}`} className="mt-2 rounded-md px-3 py-2.5 text-[15px] font-bold text-ink-900 hover:bg-mist">{site.phone}</a>
              <Link href="/kledingadvies" className="btn-primary mt-2" onClick={() => setOpen(false)}>Vraag advies aan</Link>
            </nav>
          </div>
        )}
      </header>
    </div>
  );
}
