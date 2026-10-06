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

  // Mobiel menu open: pagina erachter staat stil, Escape sluit.
  useEffect(() => {
    if (!open) return;
    const oud = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const opEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', opEscape);
    return () => { document.body.style.overflow = oud; document.removeEventListener('keydown', opEscape); };
  }, [open]);

  // Fragment, geen <div>: met een wrapper-div eromheen bleef de sticky header
  // binnen die div gevangen en scrolde hij na 116 px gewoon mee weg.
  return (
    <>
      {/* Topbalk: secundaire links + direct contact */}
      <div className="hidden bg-ink-900 text-ink-200 lg:block" data-plek="topbalk">
        <div className="container-x flex h-9 items-center justify-between text-[13px]">
          <span className="text-ink-300">Bedrijfskleding met persoonlijke aandacht in de Achterhoek</span>
          <div className="flex items-center gap-5">
            {topNav.map((i) => (
              <Link key={i.href} href={i.href} className="font-medium text-ink-100 hover:text-amber-400">{i.label}</Link>
            ))}
            <span className="h-3.5 w-px bg-white/15" aria-hidden="true" />
            <a href={`tel:${site.phoneIntl}`} className="font-semibold text-white hover:text-amber-400">{site.phone}</a>
            <Link href="/afspraak" className="font-semibold text-amber-400 hover:text-amber-300" data-cta="afspraak">
              Plan een adviesgesprek
            </Link>
          </div>
        </div>
      </div>

      {/* Hoofdbalk: logo + primaire navigatie + CTA */}
      <header className="sticky top-0 z-40 border-b border-line bg-white" data-plek="header">
        <div className="container-x flex h-16 items-center justify-between gap-4 lg:h-20">
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
            <Link href="/offerte" className="btn-primary inline-flex whitespace-nowrap px-5 py-2.5 text-[13px]" data-cta="offerte">Offerte aanvragen</Link>
          </div>
          <div className="flex items-center gap-1 lg:hidden">
            <a
              href={`tel:${site.phoneIntl}`}
              className="inline-flex min-h-[44px] items-center rounded-md px-3 text-[15px] font-semibold text-ink-900 hover:bg-mist"
              aria-label={`Bel ${site.phone}`}
            >
              Bel
            </a>
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

/** Klapgroep in het mobiele menu. Eén groep tegelijk open houdt het menu kort. */
function MenuGroep({ id, titel, sub, open, zet, children }: {
  id: string; titel: string; sub: string; open: boolean; zet: (id: string | null) => void; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line">
      <button
        type="button"
        className="flex min-h-[60px] w-full items-center justify-between gap-3 py-2 text-left"
        aria-expanded={open}
        aria-controls={`mm-${id}`}
        onClick={() => zet(open ? null : id)}
      >
        <span className="min-w-0">
          <span className="block text-[17px] font-bold text-ink-900">{titel}</span>
          <span className="block text-[13px] text-warm">{sub}</span>
        </span>
        <svg viewBox="0 0 20 20" className={`h-5 w-5 shrink-0 text-ink-500 transition ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8l5 5 5-5" /></svg>
      </button>
      {open && <div id={`mm-${id}`} className="pb-4">{children}</div>}
    </div>
  );
}

const tegel = 'flex min-h-[48px] items-center rounded-lg border border-line bg-mist/50 px-3 py-2 text-[15px] font-semibold leading-tight text-ink-900 active:bg-mist';
const rijLink = 'flex min-h-[52px] items-center justify-between gap-3 border-b border-line text-[17px] font-bold text-ink-900';
const pijl = <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-ink-400" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" /></svg>;

/**
 * Mobiel menu. Eerder één lange lijst van 25 links met kleine tussenkopjes, waar
 * je niet zag wat bij elkaar hoorde. Nu: de twee acties bovenaan, daaronder vier
 * duidelijke ingangen (branche, kleding, kledingbeheer, service) waarvan er één
 * tegelijk openklapt, en onderaan inloggen en bellen. Past op één scherm.
 */
function MobielMenu({ sluit }: { sluit: () => void }) {
  const [groep, setGroep] = useState<string | null>(null);
  return (
    <div id="mobiel-menu" className="fixed inset-x-0 top-16 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 overflow-y-auto overscroll-contain border-t border-line bg-white lg:hidden">
      <nav className="container-x flex min-h-full flex-col pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4" aria-label="Mobiele navigatie">
        <div className="grid grid-cols-2 gap-2" data-plek="mobiel-menu">
          <Link href="/offerte" className="btn-primary w-full px-3 text-[15px]" onClick={sluit} data-cta="offerte">Offerte aanvragen</Link>
          <Link href="/afspraak" className="btn-outline w-full px-3 text-[15px]" onClick={sluit} data-cta="afspraak">Adviesgesprek</Link>
        </div>

        <div className="mt-4 border-t border-line">
          <MenuGroep id="branche" titel="Kleding voor jouw branche" sub="Bouw, installatie, zorg, horeca en meer" open={groep === 'branche'} zet={setGroep}>
            <div className="grid grid-cols-2 gap-2">
              {branches.map((b) => (
                <Link key={b.slug} href={`/branches/${b.slug}`} className={tegel} onClick={sluit}>{b.navLabel}</Link>
              ))}
              <Link href="/voor" className={`${tegel} col-span-2 justify-between bg-white`} onClick={sluit}>Zoek op beroep {pijl}</Link>
            </div>
          </MenuGroep>
          <MenuGroep id="kleding" titel="Kleding en logo" sub="Assortiment, schoenen, bedrukken, maten" open={groep === 'kleding'} zet={setGroep}>
            <div className="grid grid-cols-2 gap-2">
              {kledingNav.map((i) => (
                <Link key={i.href} href={i.href} className={tegel} onClick={sluit}>{i.label}</Link>
              ))}
            </div>
          </MenuGroep>
          <Link href="/kledingbeheer" className={rijLink} onClick={sluit}>
            <span className="min-w-0">
              <span className="block text-amber-700">Kledingbeheer</span>
              <span className="block text-[13px] font-normal text-warm">Je team bestelt zelf, jij houdt overzicht</span>
            </span>
            {pijl}
          </Link>
          <MenuGroep id="info" titel="Over Frederiks" sub="Referenties, kennisbank, service, contact" open={groep === 'info'} zet={setGroep}>
            <div className="grid grid-cols-2 gap-2">
              {[{ href: '/referenties', label: 'Referenties' }, { href: '/kennisbank', label: 'Kennisbank' }, ...topNav].map((i) => (
                <Link key={i.href} href={i.href} className={tegel} onClick={sluit}>{i.label}</Link>
              ))}
            </div>
          </MenuGroep>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-6">
          <PortaalKnop className="flex min-h-[48px] items-center justify-center rounded-lg border border-line px-3 text-[15px] font-semibold text-ink-900" />
          <a href={`tel:${site.phoneIntl}`} className="flex min-h-[48px] items-center justify-center rounded-lg border border-line px-3 text-[15px] font-semibold text-ink-900">{site.phone}</a>
        </div>
        <p className="mt-3 text-center text-[13px] text-warm">Jessi reageert {site.beloftKort}. Ook via WhatsApp.</p>
      </nav>
    </div>
  );
}
