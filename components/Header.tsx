'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import PortaalKnop from '@/components/PortaalKnop';
import { branches } from '@/content/branches';
import { site } from '@/content/site';

// Kledingpagina's gebundeld onder één dropdown zodat de balk overzichtelijk blijft
const kledingNav = [
  { href: '/assortiment', label: 'Assortiment' },
  { href: '/normen', label: 'Normen en klassen' },
  { href: '/werkkleding', label: 'Werkkleding' },
  { href: '/werkschoenen', label: 'Werkschoenen' },
  { href: '/bedrukken-borduren', label: 'Bedrukken en borduren' },
  { href: '/pakket-samenstellen', label: 'Pakket samenstellen' },
  { href: '/maattabellen', label: 'Maattabellen' },
];
// Losse hoofditems
const hoofdNav = [
  { href: '/voor', label: 'Voor jouw vak' },
  { href: '/kledingbeheer', label: 'Kledingbeheer' },
  { href: '/kennisbank', label: 'Kennisbank' },
  { href: '/referenties', label: 'Referenties' },
];
const topNav = [
  { href: '/over-ons', label: 'Over ons' },
  { href: '/klantenservice', label: 'Klantenservice' },
  { href: '/klantenservice/retourneren', label: 'Retourneren' },
  { href: '/contact', label: 'Contact' },
];

const dropdownLink = 'block rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-mist';
const navTrigger = 'whitespace-nowrap rounded-md px-3 py-2.5 text-[15px] font-semibold text-ink-800 hover:bg-mist';

/**
 * Desktop-dropdown.
 *
 * Wat er mis was: openen ging via `group-hover` én via een eigen open-state per
 * menu. Daardoor kon er meer dan één paneel tegelijk openstaan (het aangeklikte
 * plus het aangewezen menu), en zodra je met de muis schuin naar een item bewoog
 * viel je even buiten de group en klapte het paneel dicht onder je cursor.
 *
 * Nu houdt de header één `openId` bij, dus er kan er maar één open zijn. Openen
 * gaat direct bij aanwijzen; sluiten pas na een korte vertraging, zodat een
 * schuine muisbeweging naar het paneel niets afbreekt. Klik en toetsenbord
 * werken onafhankelijk van de muis, en Escape sluit.
 */
function NavDropdown({
  id, label, openId, setOpenId, children,
}: {
  id: string;
  label: string;
  openId: string | null;
  setOpenId: (v: string | null | ((h: string | null) => string | null)) => void;
  children: React.ReactNode;
}) {
  const open = openId === id;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nuOpen = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpenId(id);
  };
  const straksDicht = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpenId((h) => (h === id ? null : h)), 160);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div className="relative" onMouseEnter={nuOpen} onMouseLeave={straksDicht}>
      <button
        type="button"
        className={`${navTrigger} ${open ? 'bg-mist' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpenId(open ? null : id)}
        onFocus={nuOpen}
      >
        {label}
      </button>
      {/* De pt-2 is de brug tussen knop en paneel: zonder die overlap loop je er
          met de muis tussendoor en klapt het menu dicht. */}
      <div className={`absolute left-0 top-full pt-2 ${open ? '' : 'pointer-events-none'}`}>
        <div
          className={`w-64 rounded-lg border border-line bg-white p-2 shadow-card transition duration-150 ease-out ${
            open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  // Eén open menu tegelijk, op headerniveau bijgehouden.
  const [openId, setOpenId] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openId) return;
    const buiten = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenId(null);
    };
    const opEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null); };
    document.addEventListener('mousedown', buiten);
    document.addEventListener('keydown', opEscape);
    return () => {
      document.removeEventListener('mousedown', buiten);
      document.removeEventListener('keydown', opEscape);
    };
  }, [openId]);

  return (
    <div>
      {/* Topbalk: secundaire links + direct contact */}
      <div className="hidden bg-ink-900 text-ink-200 lg:block">
        <div className="container-x flex h-9 items-center justify-between text-[13px]">
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
        <div className="container-x flex h-20 items-center justify-between gap-4">
          <Logo />
          <nav ref={navRef} className="hidden min-w-0 items-center gap-1 lg:flex" aria-label="Hoofdnavigatie">
            <NavDropdown id="branches" label="Branches" openId={openId} setOpenId={setOpenId}>
              {branches.map((b) => (
                <Link key={b.slug} href={`/branches/${b.slug}`} className={dropdownLink}>{b.navLabel}</Link>
              ))}
            </NavDropdown>
            <NavDropdown id="kleding" label="Kleding" openId={openId} setOpenId={setOpenId}>
              {kledingNav.map((i) => (
                <Link key={i.href} href={i.href} className={dropdownLink}>{i.label}</Link>
              ))}
            </NavDropdown>
            {hoofdNav.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={
                  i.href === '/kledingbeheer'
                    ? 'whitespace-nowrap rounded-md px-3 py-2.5 text-[15px] font-bold text-amber-700 hover:bg-mist'
                    : navTrigger
                }
              >
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <PortaalKnop className="whitespace-nowrap rounded-md px-3 py-2.5 text-[13px] font-semibold text-ink-800 hover:text-amber-700 hover:bg-mist" />
            <Link href="/kledingadvies" className="btn-primary whitespace-nowrap px-5 py-2.5 text-[13px] inline-flex">Vraag advies aan</Link>
          </div>
          <button className="shrink-0 rounded-md px-3 py-2.5 text-[15px] font-bold text-ink-900 hover:bg-mist lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
            Menu
          </button>
        </div>
        {open && (
          <div className="border-t border-line bg-white lg:hidden">
            <nav className="container-x flex flex-col gap-1 py-4" aria-label="Mobiele navigatie">
              <p className="px-3 pt-1 text-xs font-bold uppercase tracking-wide text-warm">Kleding</p>
              {kledingNav.map((i) => (
                <Link key={i.href} href={i.href} className="rounded-md px-3 py-2.5 text-[15px] text-ink-800 hover:bg-mist" onClick={() => setOpen(false)}>{i.label}</Link>
              ))}
              {hoofdNav.map((i) => (
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
              <PortaalKnop className="mt-2 rounded-md border border-line px-3 py-2.5 text-center text-[15px] font-semibold text-ink-800 hover:bg-mist" />
              <Link href="/kledingadvies" className="btn-primary mt-2" onClick={() => setOpen(false)}>Vraag advies aan</Link>
            </nav>
          </div>
        )}
      </header>
    </div>
  );
}
