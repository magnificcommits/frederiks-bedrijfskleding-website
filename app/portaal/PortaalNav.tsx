import Link from 'next/link';
import { portaalLogout } from './actions';
import type { PortaalRol } from '@/lib/portaal/team';

/**
 * Rol-bewuste portaalnavigatie. Webshop, bestellingen, retouren en vragen zijn
 * voor iedereen. Goedkeuringen en Medewerkers alleen voor beheerder en
 * leidinggevende. "Medewerkers" is één scherm waarin personen, maten, budget en
 * toegang samenkomen. De rij scrollt horizontaal op smalle schermen; "Uitloggen"
 * blijft rechts staan.
 */
export default function PortaalNav({ rol, actief }: { rol: PortaalRol | null; actief?: string }) {
  const mag = (rollen: PortaalRol[]) => rol != null && rollen.includes(rol);
  const links: { href: string; label: string; toon: boolean }[] = [
    { href: '/portaal', label: 'Overzicht', toon: true },
    { href: '/portaal/webshop', label: 'Kleding bestellen', toon: true },
    { href: '/portaal/bestellingen', label: 'Mijn bestellingen', toon: true },
    { href: '/portaal/retouren', label: 'Retouren', toon: true },
    { href: '/portaal/klachten', label: 'Vragen en klachten', toon: true },
    { href: '/portaal/goedkeuringen', label: 'Goedkeuringen', toon: mag(['beheerder', 'leidinggevende']) },
    { href: '/portaal/medewerkers', label: 'Medewerkers', toon: mag(['beheerder', 'leidinggevende']) },
    { href: '/portaal/facturen', label: 'Facturen', toon: mag(['beheerder', 'leidinggevende']) },
  ];
  // De detailpagina /portaal/team/[id] markeert "Medewerkers" als actief.
  const isActief = (href: string) =>
    actief === href || (href === '/portaal/medewerkers' && actief === '/portaal/team');
  return (
    <nav className="mt-6 flex items-center gap-4 overflow-x-auto whitespace-nowrap border-y border-line py-3 text-sm">
      {links
        .filter((l) => l.toon)
        .map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActief(l.href) ? 'page' : undefined}
            className={
              isActief(l.href)
                ? 'shrink-0 font-semibold text-ink-900'
                : 'shrink-0 font-semibold text-warm hover:text-ink-800'
            }
          >
            {l.label}
          </Link>
        ))}
      <form action={portaalLogout} className="ml-auto shrink-0 pl-2">
        <button className="font-semibold text-warm hover:text-ink-800">Uitloggen</button>
      </form>
    </nav>
  );
}
