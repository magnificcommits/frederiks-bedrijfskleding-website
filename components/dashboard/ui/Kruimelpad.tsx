'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { kruimelsVoor, type NavItem } from '../navigatie';

/**
 * Kruimelpad boven de paginatitel: waar ben ik en hoe kom ik een stap terug.
 * Zonder `items` volgt het de URL ("Orders › Order" op een werkbon). Op een
 * telefoon alleen de stap terug ("‹ Orders"), dat past op één regel.
 */
export default function Kruimelpad({ items, className = '' }: { items?: NavItem[]; className?: string }) {
  const pathname = usePathname() ?? '';
  const lijst = items ?? kruimelsVoor(pathname);
  if (lijst.length === 0) return null;
  const terug = lijst[lijst.length - 1];

  return (
    <nav aria-label="Kruimelpad" className={`mb-0.5 ${className}`}>
      <Link href={terug.href} className="kruimels -ml-1 inline-flex min-h-[28px] items-center px-1 sm:hidden">
        <span aria-hidden="true" className="mr-0.5 text-[14px] leading-none">‹</span>
        <span>{terug.label}</span>
      </Link>
      <ol className="kruimels hidden sm:flex">
        {lijst.map((k, i) => (
          <li key={k.href} className="flex items-center gap-x-1">
            {i > 0 && <span aria-hidden="true" className="text-ink-400">›</span>}
            <Link href={k.href}>{k.label}</Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
