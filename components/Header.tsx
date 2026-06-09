'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { branches } from '@/content/branches';
import { site } from '@/content/site';

const mainNav = [
  { href: '/werkkleding', label: 'Werkkleding' },
  { href: '/werkschoenen', label: 'Werkschoenen' },
  { href: '/bedrukken-borduren', label: 'Bedrukken' },
  { href: '/referenties', label: 'Referenties' },
  { href: '/over-ons', label: 'Over ons' },
  { href: '/contact', label: 'Contact' },
];

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="container-x flex h-20 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center xl:flex" aria-label="Hoofdnavigatie">
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
          {mainNav.map((i) => (
            <Link key={i.href} href={i.href} className="whitespace-nowrap rounded-md px-3 py-2.5 text-[15px] font-semibold text-ink-800 hover:bg-mist">{i.label}</Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 xl:flex">
          <a href={`tel:${site.phoneIntl}`} className="whitespace-nowrap rounded-md border border-line px-4 py-2.5 text-[15px] font-bold text-ink-900 hover:bg-mist">{site.phone}</a>
          <Link href="/kledingadvies" className="btn-primary whitespace-nowrap px-5 py-2.5 text-[13px]">Vraag advies aan</Link>
        </div>
        <button className="rounded-md px-3 py-2.5 text-[15px] font-bold text-ink-900 hover:bg-mist xl:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
          Menu
        </button>
      </div>
      {open && (
        <div className="border-t border-line bg-white xl:hidden">
          <nav className="container-x flex flex-col gap-1 py-4" aria-label="Mobiele navigatie">
            {mainNav.map((i) => (
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
  );
}
