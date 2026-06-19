'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/dashboard/actions';
import CommandPalette from './CommandPalette';

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
    { href: '/dashboard/sparen', label: 'Sparen' },
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
    { href: '/dashboard/analyse', label: 'Analyse' },
    { href: '/dashboard/ai-assistent', label: 'AI-assistent' },
    { href: '/dashboard/rapportages', label: 'Rapportages' },
    { href: '/dashboard/meldingen', label: 'Meldingen' },
    { href: '/dashboard/import', label: 'Import' },
    { href: '/dashboard/export', label: 'Export CSV' },
    { href: '/dashboard/audit', label: 'Logboek' },
  ] },
];

function isActief(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(href + '/');
}

export function DashboardShell({
  children,
  adminNaam = null,
  adminRol = null,
}: {
  children: React.ReactNode;
  adminNaam?: string | null;
  adminRol?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Beheerders-link tonen voor een eigenaar, of bij wachtwoord-login (geen admin-account => adminRol null).
  const toonBeheerders = adminRol === 'eigenaar' || adminRol === null;
  const beheerItem: Item | null = toonBeheerders ? { href: '/dashboard/admins', label: 'Beheerders' } : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const nav = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto p-5">
      <div>
        <p className="font-display text-lg font-extrabold tracking-tight text-white">FREDERIKS</p>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-amber-500">KMS</p>
      </div>
      <button
        type="button"
        onClick={() => { setOpen(false); setSearchOpen(true); }}
        className="flex items-center justify-between rounded-md border border-ink-700 px-3 py-2 text-sm text-ink-300 hover:bg-ink-800"
      >
        <span>Zoeken…</span>
        <kbd className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-semibold text-ink-200">⌘K</kbd>
      </button>
      <div className="flex flex-col gap-5">
        {groepen.map((g) => (
          <div key={g.titel}>
            <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">{g.titel}</p>
            <div className="flex flex-col">
              {(g.titel === 'Overzicht' && beheerItem ? [...g.items, beheerItem] : g.items).map((it) => (
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
      <div className="mt-auto pt-4">
        {adminNaam && (
          <p className="mb-1.5 truncate px-2 text-xs text-ink-400" title={adminNaam}>
            Ingelogd als <span className="font-semibold text-ink-200">{adminNaam}</span>
          </p>
        )}
        <form action={logout}>
          <button className="text-sm font-semibold text-ink-300 hover:text-white">Uitloggen</button>
        </form>
      </div>
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
          <button type="button" aria-label="Menu sluiten" onClick={() => setOpen(false)} className="absolute inset-0 cursor-pointer bg-black/40" />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] bg-ink-900">{nav}</div>
        </div>
      )}
      <aside className="hidden w-60 shrink-0 bg-ink-900 md:block">{nav}</aside>
      <main className="min-w-0 flex-1">{children}</main>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
