'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { portaalLogout } from './actions';
import type { PortaalRol } from '@/lib/portaal/team';

/**
 * Compacte, rol-bewuste portaalnavigatie. In plaats van tien losse tabbladen die
 * op smalle schermen horizontaal scrollen, zijn er nu vijf logische ingangen:
 * Overzicht, Kleding bestellen, Bestellingen, Beheer en Hulp. De groepen klappen
 * uit. Beheer is alleen voor beheerder en leidinggevende. Niets scrollt meer.
 */

type Leaf = { href: string; label: string };
type Entry =
  | { kind: 'link'; href: string; label: string; toon: boolean }
  | { kind: 'group'; id: string; label: string; toon: boolean; items: Leaf[] };

export default function PortaalNav({ rol, actief }: { rol: PortaalRol | null; actief?: string }) {
  const pathname = usePathname();
  const huidig = actief ?? pathname ?? '';
  const mag = (rollen: PortaalRol[]) => rol != null && rollen.includes(rol);
  const [open, setOpen] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const entries: Entry[] = [
    { kind: 'link', href: '/portaal', label: 'Overzicht', toon: true },
    { kind: 'link', href: '/portaal/webshop', label: 'Kleding bestellen', toon: true },
    {
      kind: 'group',
      id: 'bestellingen',
      label: 'Bestellingen',
      toon: true,
      items: [
        { href: '/portaal/bestellingen', label: 'Mijn bestellingen' },
        { href: '/portaal/retouren', label: 'Retouren' },
      ],
    },
    {
      kind: 'group',
      id: 'beheer',
      label: 'Beheer',
      toon: mag(['beheerder', 'leidinggevende']),
      items: [
        { href: '/portaal/medewerkers', label: 'Medewerkers' },
        { href: '/portaal/goedkeuringen', label: 'Goedkeuringen' },
        { href: '/portaal/drukproeven', label: 'Drukproeven' },
        { href: '/portaal/ontwerpen', label: 'Pakket ontwerpen' },
        { href: '/portaal/facturen', label: 'Facturen' },
      ],
    },
    { kind: 'link', href: '/portaal/klachten', label: 'Vragen en klachten', toon: true },
  ];

  const leafActief = (href: string) =>
    huidig === href ||
    pathname === href ||
    (href === '/portaal/medewerkers' && (huidig === '/portaal/team' || pathname.startsWith('/portaal/team'))) ||
    (href !== '/portaal' && pathname.startsWith(href + '/'));

  const linkActief = (href: string) => (href === '/portaal' ? huidig === '/portaal' || pathname === '/portaal' : leafActief(href));
  const groupActief = (items: Leaf[]) => items.some((i) => leafActief(i.href));

  return (
    <nav ref={navRef} className="relative mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-line py-3 text-sm">
      {entries
        .filter((e) => e.toon)
        .map((e) =>
          e.kind === 'link' ? (
            <Link
              key={e.href}
              href={e.href}
              aria-current={linkActief(e.href) ? 'page' : undefined}
              className={linkActief(e.href) ? 'font-semibold text-ink-900' : 'font-semibold text-warm hover:text-ink-800'}
            >
              {e.label}
            </Link>
          ) : (
            <div key={e.id} className="relative">
              <button
                type="button"
                onClick={() => setOpen((v) => (v === e.id ? null : e.id))}
                aria-haspopup="true"
                aria-expanded={open === e.id}
                className={`flex items-center gap-1 font-semibold ${groupActief(e.items) ? 'text-ink-900' : 'text-warm hover:text-ink-800'}`}
              >
                {e.label}
                <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" className={`transition-transform ${open === e.id ? 'rotate-180' : ''}`}>
                  <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {open === e.id && (
                <div className="absolute left-0 top-full z-30 mt-2 min-w-[12rem] rounded-xl border border-line bg-white p-1.5 shadow-card">
                  {e.items.map((i) => (
                    <Link
                      key={i.href}
                      href={i.href}
                      onClick={() => setOpen(null)}
                      aria-current={leafActief(i.href) ? 'page' : undefined}
                      className={`block rounded-lg px-3 py-2 font-medium ${leafActief(i.href) ? 'bg-mist text-ink-900' : 'text-ink-700 hover:bg-mist'}`}
                    >
                      {i.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
      <form action={portaalLogout} className="ml-auto shrink-0">
        <button className="font-semibold text-warm hover:text-ink-800">Uitloggen</button>
      </form>
    </nav>
  );
}
