'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDemo } from './DemoProvider';

/**
 * Navigatie van het voorbeeldportaal, in dezelfde opbouw als het echte klantportaal:
 * Overzicht, Kleding bestellen, Bestellingen, Beheer (uitklapbaar) en de winkelmand.
 */
export default function DemoNav() {
  const { paden, mand, orders, drukproef, data, setRondleidingGezien } = useDemo();
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const basis = paden.portaal;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  // Vergelijk zonder encoding-verschillen in het token.
  const pad = (() => {
    try {
      return decodeURIComponent(pathname);
    } catch {
      return pathname;
    }
  })();
  const basisDecoded = (() => {
    try {
      return decodeURIComponent(basis);
    } catch {
      return basis;
    }
  })();
  const actief = (sub: string) => (sub === '' ? pad === basisDecoded : pad === `${basisDecoded}${sub}` || pad.startsWith(`${basisDecoded}${sub}/`));

  const aantalMand = mand.reduce((t, r) => t + r.aantal, 0);
  const wachtend = orders.filter((o) => o.goedkeuring === 'wacht').length;
  const proefOpen = data.drukproef && drukproef.status === 'wacht' ? 1 : 0;
  const beheerOpen = wachtend + proefOpen;

  const beheer = [
    { sub: '/medewerkers', label: 'Medewerkers', teller: 0 },
    { sub: '/goedkeuringen', label: 'Goedkeuringen', teller: wachtend },
    { sub: '/drukproeven', label: 'Drukproeven', teller: proefOpen },
  ];
  const beheerActief = beheer.some((b) => actief(b.sub));

  const linkKlasse = (aan: boolean) =>
    `inline-flex min-h-[40px] items-center font-semibold ${aan ? 'text-ink-900 underline decoration-[var(--demo-accent)] decoration-2 underline-offset-[6px]' : 'text-warm hover:text-ink-800'}`;

  return (
    <nav aria-label="Voorbeeldportaal" className="relative flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line py-2 text-sm">
      <Link href={basis} aria-current={actief('') ? 'page' : undefined} className={linkKlasse(actief(''))}>
        Overzicht
      </Link>
      <Link href={`${basis}/webshop`} aria-current={actief('/webshop') ? 'page' : undefined} className={linkKlasse(actief('/webshop'))}>
        Kleding bestellen
      </Link>
      <Link href={`${basis}/bestellingen`} aria-current={actief('/bestellingen') ? 'page' : undefined} className={linkKlasse(actief('/bestellingen'))}>
        Bestellingen
      </Link>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="true"
          aria-expanded={open}
          className={`${linkKlasse(beheerActief)} gap-1`}
        >
          Beheer
          {beheerOpen > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--demo-accent)] px-1.5 text-[11px] font-bold text-[color:var(--demo-op-accent)]">
              {beheerOpen}
            </span>
          )}
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <div className="absolute left-0 top-full z-30 mt-1 min-w-[13rem] rounded-xl border border-line bg-white p-1.5 shadow-card">
            {beheer.map((b) => (
              <Link
                key={b.sub}
                href={`${basis}${b.sub}`}
                aria-current={actief(b.sub) ? 'page' : undefined}
                className={`flex min-h-[44px] items-center justify-between gap-3 rounded-lg px-3 py-2 font-medium ${actief(b.sub) ? 'bg-mist text-ink-900' : 'text-ink-700 hover:bg-mist'}`}
              >
                {b.label}
                {b.teller > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{b.teller}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
      <Link
        href={`${basis}/winkelmand`}
        aria-current={actief('/winkelmand') ? 'page' : undefined}
        className={`${linkKlasse(actief('/winkelmand'))} gap-1.5`}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <path d="M2.5 3h2l1.6 9.2a1.5 1.5 0 0 0 1.5 1.3h6.9a1.5 1.5 0 0 0 1.4-1.1L17.5 6H5.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8" cy="16.8" r="1.2" fill="currentColor" />
          <circle cx="14.5" cy="16.8" r="1.2" fill="currentColor" />
        </svg>
        Winkelmand
        {aantalMand > 0 && (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-ink-900 px-1.5 text-[11px] font-bold text-white">
            {aantalMand}
          </span>
        )}
      </Link>
      <button
        type="button"
        onClick={() => setRondleidingGezien(false)}
        className="ml-auto inline-flex min-h-[40px] items-center text-xs font-semibold text-warm hover:text-ink-800"
      >
        Rondleiding
      </button>
    </nav>
  );
}
