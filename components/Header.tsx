'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/Logo';
import PortaalKnop from '@/components/PortaalKnop';
import { ContactKnop } from '@/components/ContactPopup';
import { site } from '@/content/site';

/**
 * Header volgens Jessi's werkdocument van 20 okt 2026: een korte, vaste
 * navigatie zonder dropdowns. Geen openbare catalogus, geen formulieren en geen
 * online agenda; elke contactknop opent de contact-pop-up.
 */
const hoofdNav = [
  { href: '/werkkleding', label: 'Werkkleding' },
  { href: '/werkschoenen', label: 'Werkschoenen' },
  { href: '/branches', label: 'Branches' },
  { href: '/kennisbank', label: 'Kennisbank' },
  { href: '/kledingbeheer', label: 'Kledingbeheer' },
];
const topNav = [
  { href: '/over-ons', label: 'Over ons' },
  { href: '/referenties', label: 'Referenties' },
  { href: '/contact', label: 'Contact' },
];

const navLink = 'whitespace-nowrap rounded-md px-3 py-2.5 text-[15px] font-semibold text-ink-800 hover:bg-mist';

export function Header() {
  const [open, setOpen] = useState(false);
  const pad = usePathname();
  useEffect(() => { setOpen(false); }, [pad]);

  // Mobiel menu open: pagina erachter staat stil, Escape sluit.
  useEffect(() => {
    if (!open) return;
    const oud = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const opEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', opEscape);
    return () => { document.body.style.overflow = oud; document.removeEventListener('keydown', opEscape); };
  }, [open]);

  const actief = (href: string) => pad === href || pad?.startsWith(`${href}/`);

  // Fragment, geen <div>: met een wrapper-div eromheen bleef de sticky header
  // binnen die div gevangen en scrolde hij na 116 px gewoon mee weg.
  return (
    <>
      <div className="hidden bg-ink-900 text-ink-200 lg:block" data-plek="topbalk">
        <div className="container-x flex h-9 items-center justify-between text-[13px]">
          <span className="text-ink-300">Bedrijfskleding met persoonlijke aandacht in de Achterhoek</span>
          <div className="flex items-center gap-5">
            {topNav.map((i) => (
              <Link key={i.href} href={i.href} className="font-medium text-ink-100 hover:text-amber-400">{i.label}</Link>
            ))}
            <span className="h-3.5 w-px bg-white/15" aria-hidden="true" />
            <a href={`tel:${site.phoneIntl}`} className="font-semibold text-white hover:text-amber-400">{site.phone}</a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line bg-white" data-plek="header">
        <div className="container-x flex h-16 items-center justify-between gap-4 lg:h-20">
          <Logo />
          <nav className="hidden min-w-0 items-center gap-1 lg:flex" aria-label="Hoofdnavigatie">
            {hoofdNav.map((i) => (
              <Link key={i.href} href={i.href} className={`${navLink} ${actief(i.href) ? 'text-amber-700' : ''}`} aria-current={actief(i.href) ? 'page' : undefined}>
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <PortaalKnop className="whitespace-nowrap rounded-md px-3 py-2.5 text-[14px] font-semibold text-ink-800 hover:bg-mist hover:text-amber-700" />
            <ContactKnop className="btn-primary whitespace-nowrap px-5 py-2.5 text-[14px]" bron="header" />
          </div>
          <div className="flex items-center gap-1 lg:hidden">
            <ContactKnop className="inline-flex min-h-[44px] items-center rounded-md px-3 text-[15px] font-semibold text-ink-900 hover:bg-mist" bron="header-mobiel">
              Contact
            </ContactKnop>
            <button
              type="button"
              className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-md border border-line px-3 text-[15px] font-bold text-ink-900 hover:bg-mist"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-controls="mobiel-menu"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
              </svg>
              {open ? 'Sluiten' : 'Menu'}
            </button>
          </div>
        </div>
        {open && <MobielMenu sluit={() => setOpen(false)} />}
      </header>
    </>
  );
}

const rijLink = 'flex min-h-[56px] items-center justify-between gap-3 border-b border-line text-[18px] font-bold text-ink-900';
const pijl = <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-ink-400" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" /></svg>;

/** Mobiel menu: de vijf hoofdpagina's, daaronder de drie secundaire, onderaan portaal en contact. */
function MobielMenu({ sluit }: { sluit: () => void }) {
  return (
    <div id="mobiel-menu" className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto overscroll-contain border-t border-line bg-white lg:hidden">
      <nav className="container-x flex min-h-full flex-col pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2" aria-label="Mobiele navigatie" data-plek="mobiel-menu">
        {hoofdNav.map((i) => (
          <Link key={i.href} href={i.href} className={rijLink} onClick={sluit}>{i.label}{pijl}</Link>
        ))}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {topNav.map((i) => (
            <Link key={i.href} href={i.href} className="flex min-h-[48px] items-center justify-center rounded-lg border border-line bg-mist/50 px-2 text-[15px] font-semibold text-ink-900" onClick={sluit}>{i.label}</Link>
          ))}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-6">
          <PortaalKnop className="flex min-h-[48px] items-center justify-center rounded-lg border border-line px-3 text-[15px] font-semibold text-ink-900" />
          <ContactKnop className="btn-primary min-h-[48px] w-full px-3 text-[15px]" bron="mobiel-menu" />
        </div>
      </nav>
    </div>
  );
}
