import Link from 'next/link';
import { portaalLogout } from './actions';
import type { PortaalRol } from '@/lib/portaal/team';

/**
 * Rol-bewuste portaalnavigatie. Webshop en Mijn bestellingen zijn voor iedereen.
 * Team, Goedkeuringen en Medewerkers alleen voor beheerder en leidinggevende
 * (Team alleen voor beheerder). Klapt netjes in op mobiel door te wrappen.
 */
export default function PortaalNav({ rol, actief }: { rol: PortaalRol | null; actief?: string }) {
  const mag = (rollen: PortaalRol[]) => rol != null && rollen.includes(rol);
  const links: { href: string; label: string; toon: boolean }[] = [
    { href: '/portaal', label: 'Overzicht', toon: true },
    { href: '/portaal/webshop', label: 'Webshop', toon: true },
    { href: '/portaal/bestellingen', label: 'Mijn bestellingen', toon: true },
    { href: '/portaal/goedkeuringen', label: 'Goedkeuringen', toon: mag(['beheerder', 'leidinggevende']) },
    { href: '/portaal/medewerkers', label: 'Medewerkers', toon: mag(['beheerder', 'leidinggevende']) },
    { href: '/portaal/team', label: 'Team en toegang', toon: mag(['beheerder']) },
  ];
  return (
    <nav className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-line py-3 text-sm">
      {links
        .filter((l) => l.toon)
        .map((l) => {
          const isActief = actief === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActief ? 'page' : undefined}
              className={
                isActief
                  ? 'font-semibold text-ink-900'
                  : 'font-semibold text-warm hover:text-ink-800'
              }
            >
              {l.label}
            </Link>
          );
        })}
      <form action={portaalLogout} className="ml-auto">
        <button className="font-semibold text-warm hover:text-ink-800">Uitloggen</button>
      </form>
    </nav>
  );
}
