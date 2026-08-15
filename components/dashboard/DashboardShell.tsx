'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/dashboard/actions';
import CommandPalette from './CommandPalette';
import Toast from './Toast';

type Item = { href: string; label: string };
type Groep = { titel: string; items: Item[] };

/**
 * Wat je elke dag nodig hebt, altijd zichtbaar bovenaan. Deze links staan
 * hieronder ook in hun eigen groep; dat is bewust, dit is een snelspoor.
 */
const DAGELIJKS: Item[] = [
  { href: '/dashboard', label: 'Overzicht' },
  { href: '/dashboard/orders', label: 'Orders' },
  { href: '/dashboard/offertes', label: 'Offertes' },
  { href: '/dashboard/klanten', label: 'Klanten' },
  { href: '/dashboard/passessie', label: 'Passessies' },
  { href: '/dashboard/producten', label: 'Producten' },
];

const groepen: Groep[] = [
  { titel: 'Overzicht', items: [
    { href: '/dashboard', label: 'Overzicht' },
    { href: '/dashboard/leads', label: 'Leads' },
    { href: '/dashboard/taken', label: 'Taken' },
    { href: '/dashboard/nieuwsbrief', label: 'Nieuwsbrief' },
  ] },
  { titel: 'Groei', items: [
    { href: '/dashboard/prospects', label: 'Prospects' },
    { href: '/dashboard/campagnes', label: 'Campagnes' },
  ] },
  { titel: 'Verkoop', items: [
    { href: '/dashboard/klanten', label: 'Klanten' },
    { href: '/dashboard/passessie', label: 'Passessies' },
    { href: '/dashboard/medewerker-verzoeken', label: 'Medewerker-verzoeken' },
    { href: '/dashboard/offertes', label: 'Offertes' },
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
    { href: '/dashboard/drukproeven', label: 'Drukproeven' },
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
  ] },
  { titel: 'Systeem', items: [
    { href: '/dashboard/import', label: 'Import' },
    { href: '/dashboard/export', label: 'Export CSV' },
    { href: '/dashboard/audit', label: 'Logboek' },
    { href: '/dashboard/instellingen', label: 'Instellingen' },
  ] },
];

// Onderdelen die alleen de eigenaar ziet (instellingen, beheer, financien, groei, systeem).
// Medewerkers en lezers krijgen deze niet in de nav en worden server-side geweerd.
const EIGENAAR_ONLY = new Set<string>([
  '/dashboard/prospects',
  '/dashboard/campagnes',
  '/dashboard/facturen',
  '/dashboard/sparen',
  '/dashboard/analyse',
  '/dashboard/rapportages',
  '/dashboard/import',
  '/dashboard/export',
  '/dashboard/audit',
  '/dashboard/instellingen',
]);

const NAV_SLEUTEL = 'fb_nav_groepen';

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
  const [uitgeklapt, setUitgeklapt] = useState<Record<string, boolean>>({});

  // Beheerders-link tonen voor een eigenaar, of bij wachtwoord-login (geen admin-account => adminRol null).
  const toonBeheerders = adminRol === 'eigenaar' || adminRol === null;
  const beheerItem: Item | null = toonBeheerders ? { href: '/dashboard/admins', label: 'Beheerders' } : null;

  // Medewerker/lezer: verberg de eigenaar-only onderdelen en lege groepen.
  const beperkt = adminRol === 'medewerker' || adminRol === 'lezer';
  const zichtbareGroepen = beperkt
    ? groepen
        .map((g) => ({ ...g, items: g.items.filter((it) => !EIGENAAR_ONLY.has(it.href)) }))
        .filter((g) => g.items.length > 0)
    : groepen;
  const zichtbaarDagelijks = beperkt ? DAGELIJKS.filter((it) => !EIGENAAR_ONLY.has(it.href)) : DAGELIJKS;

  const actieveGroep =
    zichtbareGroepen.find((g) => g.items.some((it) => isActief(pathname, it.href)))?.titel ?? null;

  useEffect(() => {
    try {
      const bewaard = localStorage.getItem(NAV_SLEUTEL);
      if (bewaard) setUitgeklapt(JSON.parse(bewaard) as Record<string, boolean>);
    } catch {
      // Geen voorkeur bewaard of onleesbaar: dan geldt gewoon de standaard.
    }
  }, []);

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

  /** Zonder eigen keuze staat alleen de groep van de huidige pagina open. */
  function groepOpen(titel: string) {
    return uitgeklapt[titel] ?? titel === actieveGroep;
  }

  function schakelGroep(titel: string) {
    const volgende = { ...uitgeklapt, [titel]: !groepOpen(titel) };
    setUitgeklapt(volgende);
    try {
      localStorage.setItem(NAV_SLEUTEL, JSON.stringify(volgende));
    } catch {
      // Bewaren is een gemak, geen vereiste.
    }
  }

  function navLink(it: Item, key?: string) {
    const aan = isActief(pathname, it.href);
    return (
      <Link
        key={key ?? it.href}
        href={it.href}
        onClick={() => setOpen(false)}
        aria-current={aan ? 'page' : undefined}
        className={`rounded px-2 py-1.5 text-[13px] font-medium ${
          aan ? 'bg-amber-500 text-ink-900' : 'text-ink-100 hover:bg-ink-800'
        }`}
      >
        {it.label}
      </Link>
    );
  }

  const nav = (
    <nav className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <p className="font-display text-lg font-extrabold tracking-tight text-white">FREDERIKS</p>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-amber-500">KMS</p>
      </div>

      <button
        type="button"
        onClick={() => { setOpen(false); setSearchOpen(true); }}
        className="flex items-center justify-between rounded border border-ink-700 px-2.5 py-1.5 text-[13px] text-ink-300 hover:bg-ink-800"
      >
        <span>Zoeken…</span>
        <kbd className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-semibold text-ink-200">⌘K</kbd>
      </button>

      <div>
        <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Dagelijks</p>
        <div className="flex flex-col">{zichtbaarDagelijks.map((it) => navLink(it, `dag-${it.href}`))}</div>
      </div>

      <div className="flex flex-col gap-0.5 border-t border-ink-800 pt-3">
        {zichtbareGroepen.map((g) => {
          const items = g.titel === 'Overzicht' && beheerItem ? [...g.items, beheerItem] : g.items;
          const uit = groepOpen(g.titel);
          const bevatActief = items.some((it) => isActief(pathname, it.href));
          return (
            <div key={g.titel}>
              <button
                type="button"
                onClick={() => schakelGroep(g.titel)}
                aria-expanded={uit}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400 hover:bg-ink-800 hover:text-ink-200"
              >
                <span className={bevatActief ? 'text-amber-500' : undefined}>{g.titel}</span>
                <span aria-hidden="true" className="text-[9px]">{uit ? '▾' : '▸'}</span>
              </button>
              {uit && <div className="mb-1 flex flex-col pl-1">{items.map((it) => navLink(it))}</div>}
            </div>
          );
        })}
      </div>

      <div className="mt-auto border-t border-ink-800 pt-3">
        {adminNaam && (
          <p className="mb-1.5 truncate px-2 text-[11px] text-ink-400" title={adminNaam}>
            Ingelogd als <span className="font-semibold text-ink-200">{adminNaam}</span>
          </p>
        )}
        <form action={logout}>
          <button className="px-2 text-[13px] font-semibold text-ink-300 hover:text-white">Uitloggen</button>
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
        <button onClick={() => setOpen((v) => !v)} aria-label="Menu" className="rounded border border-ink-700 px-3 py-1 text-sm font-semibold text-white">Menu</button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Menu sluiten" onClick={() => setOpen(false)} className="absolute inset-0 cursor-pointer bg-black/40" />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] bg-ink-900">{nav}</div>
        </div>
      )}
      <aside className="hidden w-60 shrink-0 bg-ink-900 md:sticky md:top-0 md:block md:h-screen">{nav}</aside>
      <main className="min-w-0 flex-1">{children}</main>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Toast />
    </div>
  );
}
