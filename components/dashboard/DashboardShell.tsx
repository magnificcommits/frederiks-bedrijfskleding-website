'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/dashboard/actions';

type Item = { href: string; label: string };
type Groep = { titel: string; items: Item[] };

const groepen: Groep[] = [
  { titel: 'Overzicht', items: [
    { href: '/dashboard', label: 'Overzicht' },
    { href: '/dashboard/leads', label: 'Leads' },
  ] },
  { titel: 'Verkoop', items: [
    { href: '/dashboard/klanten', label: 'Klanten' },
    { href: '/dashboard/orders', label: 'Orders' },
    { href: '/dashboard/facturen', label: 'Facturen' },
  ] },
  { titel: 'Catalogus', items: [
    { href: '/dashboard/producten', label: 'Producten' },
    { href: '/dashboard/voorraad', label: 'Voorraad' },
    { href: '/dashboard/functies', label: 'Functies' },
    { href: '/dashboard/pakketten', label: 'Pakketten' },
    { href: '/dashboard/leveranciers', label: 'Leveranciers' },
    { href: '/dashboard/inkoop', label: 'Inkoop' },
  ] },
  { titel: 'Productie', items: [
    { href: '/dashboard/logos', label: 'Logo’s en werkbonnen' },
  ] },
  { titel: 'Service', items: [
    { href: '/dashboard/retouren', label: 'Retouren' },
    { href: '/dashboard/klachten', label: 'Klachten en vragen' },
  ] },
  { titel: 'Inzicht', items: [
    { href: '/dashboard/rapportages', label: 'Rapportages' },
    { href: '/dashboard/meldingen', label: 'Meldingen' },
    { href: '/dashboard/export', label: 'Export CSV' },
  ] },
];

function isActief(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(href + '/');
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto p-5">
      <div>
        <p className="font-display text-lg font-extrabold tracking-tight text-white">FREDERIKS</p>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-amber-500">KMS</p>
      </div>
      <div className="flex flex-col gap-5">
        {groepen.map((g) => (
          <div key={g.titel}>
            <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">{g.titel}</p>
            <div className="flex flex-col">
              {g.items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-md px-2 py-1.5 text-sm font-medium ${isActief(pathname, it.href) ? 'bg-amber-500 text-ink-900' : 'text-ink-100 hover:bg-ink-800'}`}
                >
                  {it.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <form action={logout} className="mt-auto pt-4">
        <button className="text-sm font-semibold text-ink-300 hover:text-white">Uitloggen</button>
      </form>
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      <div className="flex items-center justify-between border-b border-line bg-ink-900 px-4 py-3 md:hidden">
        <div>
          <span className="font-display text-base font-extrabold text-white">FREDERIKS</span>
          <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.24em] text-amber-500">KMS</span>
        </div>
        <button onClick={() => setOpen((v) => !v)} aria-label="Menu" className="rounded-md border border-ink-700 px-3 py-1 text-sm font-semibold text-white">Menu</button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-ink-900">{nav}</div>
        </div>
      )}
      <aside className="hidden w-60 shrink-0 bg-ink-900 md:block">{nav}</aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
