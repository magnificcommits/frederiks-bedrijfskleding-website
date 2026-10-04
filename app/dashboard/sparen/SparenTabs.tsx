'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard/sparen', label: 'Overzicht' },
  { href: '/dashboard/sparen/klanten', label: 'Klanten' },
  { href: '/dashboard/sparen/regels', label: 'Regels' },
  { href: '/dashboard/sparen/niveaus', label: 'Niveaus' },
  { href: '/dashboard/sparen/beloningen', label: 'Beloningen' },
  { href: '/dashboard/sparen/inwisselingen', label: 'Inwisselingen' },
  { href: '/dashboard/sparen/instellingen', label: 'Instellingen' },
];

/** Tabbladen van de sparenmodule als echte links, zodat elk tabblad een eigen URL heeft. */
export default function SparenTabs({ openAanvragen }: { openAanvragen: number }) {
  const pad = usePathname() ?? '';
  return (
    <nav aria-label="Onderdelen van sparen" className="-mb-px flex gap-1 overflow-x-auto">
      {TABS.map((t) => {
        const aan = t.href === '/dashboard/sparen' ? pad === t.href : pad === t.href || pad.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={aan ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors ${
              aan ? 'border-amber-500 text-ink-900' : 'border-transparent text-warm hover:text-ink-900'
            }`}
          >
            {t.label}
            {t.href.endsWith('inwisselingen') && openAanvragen > 0 && (
              <span className="rounded bg-amber-100 px-1.5 text-[11px] font-bold tabular-nums text-amber-800">{openAanvragen}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
