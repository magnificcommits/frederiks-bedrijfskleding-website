'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/dashboard/actions';
import { bewaarNavFavorieten } from '@/app/dashboard/navActions';
import CommandPalette from './CommandPalette';
import BezigBalk from './BezigBalk';
import Toast from './Toast';
import Sneltoetsen, { zoekToetsLabel } from './Sneltoetsen';
import { useFocusVal } from './ui/useFocusVal';
import {
  BEHEER_HREF,
  EIGENAAR_ONLY,
  NAV_GROEPEN as groepen,
  STANDAARD_FAVORIETEN,
  kruimelsVoor,
  type NavItem as Item,
} from './navigatie';
import InstalleerApp from '@/components/pwa/InstalleerApp';

/** Waar de menu-favorieten bewaard worden: bij de beheerder in de database, of in deze browser. */
export type NavOpslag = 'db' | 'lokaal';

const NAV_SLEUTEL = 'fb_nav_groepen';
const FAV_SLEUTEL = 'fb_nav_favorieten';
/** Wacht even met opslaan, zodat snel achter elkaar klikken één schrijfactie wordt. */
const BEWAAR_VERTRAGING_MS = 400;

function isActief(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(href + '/');
}

function leesLokaleFavorieten(): string[] | null {
  try {
    const ruw = localStorage.getItem(FAV_SLEUTEL);
    if (!ruw) return null;
    const lijst: unknown = JSON.parse(ruw);
    return Array.isArray(lijst) ? lijst.filter((h): h is string => typeof h === 'string') : null;
  } catch {
    return null;
  }
}

function schrijfLokaleFavorieten(lijst: string[]) {
  try {
    localStorage.setItem(FAV_SLEUTEL, JSON.stringify(lijst));
  } catch {
    // Bewaren is een gemak, geen vereiste.
  }
}

function SterIcoon({ gevuld }: { gevuld: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M10 2.5l2.3 4.7 5.2.8-3.8 3.6.9 5.1L10 14.3l-4.6 2.4.9-5.1-3.8-3.6 5.2-.8z"
        fill={gevuld ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PijlIcoon({ omhoog }: { omhoog: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="12" height="12" aria-hidden="true" focusable="false">
      <path
        d={omhoog ? 'M5 12.5l5-5 5 5' : 'M5 7.5l5 5 5-5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Iconen voor de menurail, per groep (titel uit navigatie.ts). */
const RAIL: Record<string, { kort: string; pad: string }> = {
  Favorieten: { kort: 'Favorieten', pad: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z' },
  Vandaag: { kort: 'Start', pad: 'M4 11l8-6.5 8 6.5M6.5 9.5V19h11V9.5M10 19v-5h4v5' },
  Verkoop: { kort: 'Verkoop', pad: 'M5 4h14v16H5zM8.5 8.5h7M8.5 12h7M8.5 15.5h4' },
  Klanten: { kort: 'Klanten', pad: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c.6-3.6 3.1-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.5a3.3 3.3 0 010 6.4M18 14.8c1.9.7 3.1 2.4 3.5 5.2' },
  'Nieuwe klanten werven': { kort: 'Werven', pad: 'M4 10v4l11 4.5V5.5L4 10zM15 9h2.5a2.5 2.5 0 010 5H15M7 14.5l1.5 5h3' },
  'Artikelen en inkoop': { kort: 'Artikelen', pad: 'M8.5 4L4 6.5 6 10l2-1V20h8V9l2 1 2-3.5L15.5 4c-.5 1.5-1.9 2.5-3.5 2.5S9 5.5 8.5 4z' },
  'Bedrukken en borduren': { kort: 'Bedrukken', pad: 'M7 8V3.5h10V8M7 17H4.5V9.5a1.5 1.5 0 011.5-1.5h12a1.5 1.5 0 011.5 1.5V17H17M7 13.5h10v7H7z' },
  'Retouren en klachten': { kort: 'Service', pad: 'M4 12a8 8 0 1113.7 5.7L20 20h-6M8.5 10.5h7M8.5 14h4.5' },
  Cijfers: { kort: 'Cijfers', pad: 'M4 19.5h16M6.5 16V11M11 16V6.5M15.5 16v-6M20 16V8.5' },
  Instellingen: { kort: 'Instellingen', pad: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.6 7.6 0 01-2 1.2l-.3 2h-4l-.3-2a7.6 7.6 0 01-2-1.2l-1.9.7-2-3.4 1.6-1.2a7.6 7.6 0 010-3L3 9.3l2-3.4 1.9.7a7.6 7.6 0 012-1.2l.3-2h4l.3 2a7.6 7.6 0 012 1.2l1.9-.7 2 3.4-1.6 1.2a7.6 7.6 0 010 3z' },
};

function RailIcoon({ pad }: { pad: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={pad} />
    </svg>
  );
}

export function DashboardShell({
  children,
  adminNaam = null,
  adminRol = null,
  navOpslag = 'lokaal',
  navFavorieten = null,
}: {
  children: React.ReactNode;
  adminNaam?: string | null;
  adminRol?: string | null;
  /** 'db' als de favorieten bij de beheerder in de database staan; anders localStorage. */
  navOpslag?: NavOpslag;
  /** Bewaarde favorieten (hrefs, op volgorde). Null = nog niets gekozen. */
  navFavorieten?: string[] | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toetsenOpen, setToetsenOpen] = useState(false);
  const [zoekLabel, setZoekLabel] = useState('Ctrl K');
  const mobielMenu = useRef<HTMLDivElement>(null);
  useFocusVal(mobielMenu, open, () => setOpen(false));
  const [uitgeklapt, setUitgeklapt] = useState<Record<string, boolean>>({});
  const [favorieten, setFavorieten] = useState<string[] | null>(navFavorieten);
  const [bewerken, setBewerken] = useState(false);
  const [flyout, setFlyout] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [melding, setMelding] = useState('');
  const opslagRef = useRef<NavOpslag>(navOpslag);
  const beginFavorieten = useRef<string[] | null>(navFavorieten);
  const bewaarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Beheerders-link tonen voor een eigenaar, of bij wachtwoord-login (geen admin-account => adminRol null).
  const toonBeheerders = adminRol === 'eigenaar' || adminRol === null;
  // Medewerker/lezer: verberg de eigenaar-only onderdelen en lege groepen.
  const beperkt = adminRol === 'medewerker' || adminRol === 'lezer';

  function magZien(href: string) {
    if (href === BEHEER_HREF) return toonBeheerders;
    return !(beperkt && EIGENAAR_ONLY.has(href));
  }

  const zichtbareGroepen = groepen
    .map((g) => ({ ...g, items: g.items.filter((it) => magZien(it.href)) }))
    .filter((g) => g.items.length > 0);

  const zichtbareItems = new Map<string, Item>();
  for (const g of zichtbareGroepen) for (const it of g.items) zichtbareItems.set(it.href, it);

  // Alleen wat deze gebruiker mag zien komt in favorieten; onbekende hrefs vallen weg.
  const favorietenLijst = favorieten ?? STANDAARD_FAVORIETEN;
  const zichtbareFavorieten = favorietenLijst
    .map((h) => zichtbareItems.get(h))
    .filter((it): it is Item => Boolean(it));
  const favorietSet = new Set(zichtbareFavorieten.map((it) => it.href));

  // Precies één actieve pagina: de langste href die bij het pad past. Zo is op
  // /dashboard/prospects/brieven alleen "Brieven met QR" actief, niet ook "Prospects".
  let actieveHref: string | null = null;
  for (const href of zichtbareItems.keys()) {
    if (isActief(pathname, href) && (!actieveHref || href.length > actieveHref.length)) actieveHref = href;
  }
  const actiefInFavorieten = actieveHref !== null && favorietSet.has(actieveHref);
  const actieveGroep =
    zichtbareGroepen.find((g) => g.items.some((it) => it.href === actieveHref))?.titel ?? null;

  const bewaar = useCallback((lijst: string[]) => {
    if (opslagRef.current === 'lokaal') {
      schrijfLokaleFavorieten(lijst);
      return;
    }
    if (bewaarTimer.current) clearTimeout(bewaarTimer.current);
    bewaarTimer.current = setTimeout(() => {
      bewaarTimer.current = null;
      bewaarNavFavorieten(lijst)
        .then((r) => {
          if (r.ok) return;
          // Kolom ontbreekt of geen admin-account: voortaan in deze browser bewaren.
          if (r.reden === 'lokaal') opslagRef.current = 'lokaal';
          schrijfLokaleFavorieten(lijst);
        })
        .catch(() => schrijfLokaleFavorieten(lijst));
    }, BEWAAR_VERTRAGING_MS);
  }, []);

  useEffect(() => {
    try {
      const bewaard = localStorage.getItem(NAV_SLEUTEL);
      if (bewaard) setUitgeklapt(JSON.parse(bewaard) as Record<string, boolean>);
    } catch {
      // Geen voorkeur bewaard of onleesbaar: dan geldt gewoon de standaard.
    }

    const lokaal = leesLokaleFavorieten();
    if (!lokaal) return;
    if (opslagRef.current === 'lokaal') {
      setFavorieten(lokaal);
    } else if (beginFavorieten.current === null) {
      // Eerder in de browser bewaard (voordat de kolom bestond): neem die keuze mee naar de database.
      setFavorieten(lokaal);
      bewaar(lokaal);
    }
  }, [bewaar]);

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

  useEffect(() => () => {
    if (bewaarTimer.current) clearTimeout(bewaarTimer.current);
  }, []);

  useEffect(() => setZoekLabel(zoekToetsLabel()), []);

  // Naar een andere pagina: het telefoonmenu en het uitklapmenu dicht.
  useEffect(() => { setOpen(false); setFlyout(null); }, [pathname]);

  useEffect(() => {
    if (!flyout) return;
    function buiten(e: MouseEvent) {
      if (railRef.current && !railRef.current.contains(e.target as Node)) setFlyout(null);
    }
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') setFlyout(null); }
    document.addEventListener('mousedown', buiten);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', buiten); document.removeEventListener('keydown', esc); };
  }, [flyout]);

  const openZoeken = useCallback(() => setSearchOpen(true), []);
  const openToetsen = useCallback(() => setToetsenOpen(true), []);
  const sluitToetsen = useCallback(() => setToetsenOpen(false), []);

  // Op een telefoon in de bovenbalk: één stap terug op een detailpagina.
  const kruimels = kruimelsVoor(pathname ?? '');
  const terugStap = (pathname ?? '').split('/').filter(Boolean).length > 2 ? kruimels[kruimels.length - 1] : null;

  /**
   * Zonder eigen keuze staat alleen de groep van de huidige pagina open, behalve als
   * die pagina al in favorieten staat: dan is de groep niet nodig om hem te vinden.
   */
  function groepOpen(titel: string) {
    return uitgeklapt[titel] ?? (titel === actieveGroep && !actiefInFavorieten);
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

  function wijzigFavorieten(volgende: string[], tekst: string) {
    setFavorieten(volgende);
    setMelding(tekst);
    bewaar(volgende);
  }

  function schakelFavoriet(it: Item) {
    if (favorietSet.has(it.href)) {
      wijzigFavorieten(favorietenLijst.filter((h) => h !== it.href), `${it.label} uit favorieten gehaald`);
    } else {
      const zonder = favorietenLijst.filter((h) => h !== it.href);
      wijzigFavorieten([...zonder, it.href], `${it.label} vastgezet in favorieten`);
    }
  }

  function verplaats(it: Item, richting: -1 | 1) {
    // Alleen de zichtbare favorieten schuiven; verborgen hrefs (bijv. na een rolwijziging) blijven achteraan bewaard.
    const zichtbaar = zichtbareFavorieten.map((f) => f.href);
    const verborgen = favorietenLijst.filter((h) => !favorietSet.has(h));
    const van = zichtbaar.indexOf(it.href);
    const naar = van + richting;
    if (van < 0 || naar < 0 || naar >= zichtbaar.length) return;
    [zichtbaar[van], zichtbaar[naar]] = [zichtbaar[naar], zichtbaar[van]];
    wijzigFavorieten([...zichtbaar, ...verborgen], `${it.label} staat nu op plek ${naar + 1}`);
  }

  function standaardTerug() {
    wijzigFavorieten([...STANDAARD_FAVORIETEN], 'Standaardfavorieten teruggezet');
  }

  // Op een telefoon iets hoger, zodat je met een duim niet het verkeerde item raakt.
  const linkBasis = 'block min-w-0 flex-1 truncate rounded py-1.5 pl-2 pr-8 text-[13px] font-medium max-md:py-2.5 max-md:text-[14px]';
  const fel = 'bg-amber-500 text-ink-900';
  const rustig = 'text-ink-200 hover:bg-ink-800 hover:text-white';
  // Subtiel: de pagina is al fel gemarkeerd in favorieten, hier alleen een streepje links.
  const subtiel = 'text-white shadow-[inset_2px_0_0_theme(colors.amber.500)] hover:bg-ink-800';

  function sterKnop(it: Item, opFel: boolean, altijdZichtbaar: boolean) {
    const isFav = favorietSet.has(it.href);
    const label = isFav ? `${it.label} uit favorieten halen` : `${it.label} vastzetten in favorieten`;
    const kleur = opFel
      ? 'text-ink-900 hover:bg-amber-400'
      : isFav
        ? 'text-amber-500 hover:bg-ink-700'
        : 'text-ink-400 hover:bg-ink-700 hover:text-amber-400';
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          schakelFavoriet(it);
        }}
        aria-label={label}
        title={label}
        className={`absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center max-md:h-8 max-md:w-8 justify-center rounded transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 group-focus-within:opacity-100 group-hover:opacity-100 ${
          altijdZichtbaar ? 'opacity-100' : 'opacity-0 [@media(hover:none)]:opacity-100'
        } ${kleur}`}
      >
        <SterIcoon gevuld={isFav} />
      </button>
    );
  }

  function groepRij(it: Item) {
    const isActiefItem = it.href === actieveHref;
    const stijl = !isActiefItem ? rustig : actiefInFavorieten ? subtiel : fel;
    const opFel = isActiefItem && !actiefInFavorieten;
    return (
      <div key={it.href} className="group relative">
        <Link
          href={it.href}
          onClick={() => setOpen(false)}
          aria-current={isActiefItem ? 'page' : undefined}
          className={`${linkBasis} ${stijl}`}
        >
          {it.label}
        </Link>
        {sterKnop(it, opFel, bewerken)}
      </div>
    );
  }

  function favorietRij(it: Item, i: number, aantal: number) {
    const isActiefItem = it.href === actieveHref;
    if (bewerken) {
      const pijl =
        'flex h-6 w-5 shrink-0 items-center justify-center rounded text-ink-300 hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 aria-disabled:cursor-default aria-disabled:text-ink-700 aria-disabled:hover:bg-transparent';
      return (
        <div key={it.href} className="group relative flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => verplaats(it, -1)}
            aria-disabled={i === 0 || undefined}
            aria-label={`${it.label} omhoog`}
            className={pijl}
          >
            <PijlIcoon omhoog />
          </button>
          <button
            type="button"
            onClick={() => verplaats(it, 1)}
            aria-disabled={i === aantal - 1 || undefined}
            aria-label={`${it.label} omlaag`}
            className={pijl}
          >
            <PijlIcoon omhoog={false} />
          </button>
          <span className={`${linkBasis} ${isActiefItem ? fel : 'text-ink-200'}`}>{it.label}</span>
          {sterKnop(it, isActiefItem, true)}
        </div>
      );
    }
    return (
      <div key={it.href} className="group relative">
        <Link
          href={it.href}
          onClick={() => setOpen(false)}
          aria-current={isActiefItem ? 'page' : undefined}
          className={`${linkBasis} ${isActiefItem ? fel : rustig}`}
        >
          {it.label}
        </Link>
        {sterKnop(it, isActiefItem, false)}
      </div>
    );
  }

  // Desktop: smalle rail met een icoon per groep, en een uitklappaneel met de schermen.
  const lichtBasis = 'block min-w-0 flex-1 truncate rounded-lg py-2 pl-3 pr-9 text-[14px] font-medium';
  function lichtRij(it: Item) {
    const isActiefItem = it.href === actieveHref;
    const isFav = favorietSet.has(it.href);
    const label = isFav ? `${it.label} uit favorieten halen` : `${it.label} vastzetten in favorieten`;
    return (
      <div key={it.href} className="group relative">
        <Link
          href={it.href}
          onClick={() => setFlyout(null)}
          aria-current={isActiefItem ? 'page' : undefined}
          className={`${lichtBasis} ${isActiefItem ? 'bg-amber-50 font-semibold text-amber-900' : 'text-ink-800 hover:bg-mist'}`}
        >
          {it.label}
        </Link>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); schakelFavoriet(it); }}
          aria-label={label}
          title={label}
          className={`absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded transition-opacity focus-visible:opacity-100 group-hover:opacity-100 ${isFav ? 'text-amber-500 opacity-100' : 'text-ink-300 opacity-0 hover:text-amber-500'}`}
        >
          <SterIcoon gevuld={isFav} />
        </button>
      </div>
    );
  }

  const railGroepen = [
    { titel: 'Favorieten', items: zichtbareFavorieten },
    ...zichtbareGroepen,
  ];
  const flyoutGroep = railGroepen.find((g) => g.titel === flyout) ?? null;

  const rail = (
    <div ref={railRef} className="relative h-full">
      <nav aria-label="Dashboard" className="flex h-full w-[84px] flex-col items-center gap-1 overflow-y-auto border-r border-line bg-[#f7f5f0] py-3">
        <Link href="/dashboard" className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-ink-900 font-display text-sm font-extrabold text-amber-500" aria-label="Overzicht">
          FB
        </Link>
        {railGroepen.map((g) => {
          const r = RAIL[g.titel] ?? { kort: g.titel, pad: 'M5 5h14v14H5z' };
          const bevatActief = g.titel !== 'Favorieten' && g.items.some((it) => it.href === actieveHref);
          const isOpen = flyout === g.titel;
          return (
            <button
              key={g.titel}
              type="button"
              onClick={() => setFlyout(isOpen ? null : g.titel)}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              className={`flex w-[72px] flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold leading-tight transition ${isOpen ? 'bg-white text-ink-900 shadow-soft' : bevatActief ? 'bg-amber-50 text-amber-800' : 'text-ink-600 hover:bg-white hover:text-ink-900'}`}
            >
              <span className={bevatActief ? 'text-amber-600' : undefined}><RailIcoon pad={r.pad} /></span>
              <span className="w-full truncate text-center">{r.kort}</span>
            </button>
          );
        })}
        <div className="mt-auto flex flex-col items-center gap-1 pt-2">
          <a
            href="/dashboard/demo"
            target="_blank"
            rel="noopener"
            data-plek="demo-knop"
            className="flex w-[72px] flex-col items-center gap-1 rounded-xl bg-amber-500 px-1 py-2 text-[11px] font-bold leading-tight text-ink-900 hover:bg-amber-400"
          >
            <RailIcoon pad="M3.5 5.5h17v11h-17zM9 20h6M12 16.5V20M10.5 8.5l4 2.5-4 2.5z" />
            Demo
          </a>
          <form action={logout}>
            <button className="flex w-[72px] flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold text-ink-600 hover:bg-white hover:text-ink-900">
              <RailIcoon pad="M14 4.5h4.5v15H14M10 8l-4 4 4 4M6 12h10" />
              Uitloggen
            </button>
          </form>
        </div>
      </nav>

      {flyoutGroep && (
        <div role="menu" aria-label={flyoutGroep.titel} className="absolute left-[92px] top-3 z-40 w-64 rounded-2xl border border-line bg-white p-3 shadow-card">
          <div className="mb-1 flex items-center justify-between px-2">
            <p className="font-display text-[15px] font-extrabold text-ink-900">{flyoutGroep.titel}</p>
            {flyoutGroep.titel === 'Favorieten' && (
              <button type="button" onClick={() => setBewerken((v) => !v)} className="text-[12px] font-semibold text-warm hover:text-ink-900">
                {bewerken ? 'Klaar' : 'Volgorde'}
              </button>
            )}
          </div>
          {flyoutGroep.titel === 'Favorieten' && flyoutGroep.items.length === 0 && (
            <p className="px-2 py-1 text-[13px] text-warm">Zet een ster bij een scherm om het hier vast te zetten.</p>
          )}
          {flyoutGroep.titel === 'Favorieten' && bewerken ? (
            <div className="flex flex-col rounded-lg bg-ink-900 p-1">
              {zichtbareFavorieten.map((it, i) => favorietRij(it, i, zichtbareFavorieten.length))}
            </div>
          ) : (
            <div className="flex flex-col">{flyoutGroep.items.map((it) => lichtRij(it))}</div>
          )}
        </div>
      )}
    </div>
  );

  const zoekBalk = (
    <div className="hidden border-b border-line bg-white px-6 py-3 md:block">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-keyshortcuts="Control+K Meta+K"
          className="flex w-full max-w-xl items-center justify-between rounded-xl border border-line bg-mist px-4 py-2.5 text-[14px] text-warm hover:border-ink-300"
        >
          <span className="flex items-center gap-2.5">
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="9" r="5.5" /><path d="M13.2 13.2L17 17" /></svg>
            Zoek een klant, order of scherm…
          </span>
          <kbd className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-ink-700">{zoekLabel}</kbd>
        </button>
        {adminNaam && <span className="ml-auto truncate text-[13px] text-warm">Ingelogd als <span className="font-semibold text-ink-900">{adminNaam}</span></span>}
      </div>
    </div>
  );

  const nav = (
    <nav aria-label="Dashboard" className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <p className="font-display text-lg font-extrabold tracking-tight text-white">FREDERIKS</p>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-amber-500">KMS</p>
      </div>

      <button
        type="button"
        onClick={() => { setOpen(false); setSearchOpen(true); }}
        aria-keyshortcuts="Control+K Meta+K"
        className="flex items-center justify-between rounded border border-ink-700 px-2.5 py-1.5 text-[13px] text-ink-200 hover:bg-ink-800 max-md:min-h-[44px]"
      >
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13.2 13.2L17 17" />
          </svg>
          Zoeken…
        </span>
        <kbd className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-semibold text-ink-200 [@media(pointer:coarse)]:hidden">{zoekLabel}</kbd>
      </button>

      <section aria-label="Favorieten">
        <div className="mb-1 flex items-center justify-between px-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-300">Favorieten</p>
          <button
            type="button"
            onClick={() => setBewerken((v) => !v)}
            aria-label={bewerken ? 'Klaar met favorieten bewerken' : 'Favorieten bewerken'}
            className="rounded px-1 text-[11px] font-semibold text-ink-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 max-md:min-h-[32px] max-md:px-2"
          >
            {bewerken ? 'Klaar' : 'Bewerken'}
          </button>
        </div>
        {zichtbareFavorieten.length === 0 ? (
          <p className="px-2 py-1 text-[12px] leading-snug text-ink-300">
            Zet een ster bij een menu-item om het hier vast te zetten.
          </p>
        ) : (
          <div className="flex flex-col">
            {zichtbareFavorieten.map((it, i) => favorietRij(it, i, zichtbareFavorieten.length))}
          </div>
        )}
        {bewerken && (
          <div className="mt-1.5 flex flex-col gap-1 px-2 text-[11px] leading-snug text-ink-300">
            <p>Pijltjes zetten de volgorde, de ster haalt een item weg. Toevoegen doe je met de ster in de lijst hieronder.</p>
            {favorieten !== null && (
              <button
                type="button"
                onClick={standaardTerug}
                className="self-start font-semibold text-ink-300 underline-offset-2 hover:text-white hover:underline"
              >
                Standaardlijst terugzetten
              </button>
            )}
          </div>
        )}
        <p className="sr-only" aria-live="polite">{melding}</p>
      </section>

      <div className="flex flex-col gap-0.5 border-t border-ink-800 pt-3">
        {zichtbareGroepen.map((g) => {
          const uit = groepOpen(g.titel);
          const heeftFel = g.titel === actieveGroep && !actiefInFavorieten;
          return (
            <div key={g.titel}>
              <button
                type="button"
                onClick={() => schakelGroep(g.titel)}
                aria-expanded={uit}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-300 hover:bg-ink-800 hover:text-white max-md:py-2.5"
              >
                <span className={heeftFel ? 'text-amber-500' : g.titel === actieveGroep ? 'text-ink-200' : undefined}>
                  {g.titel}
                </span>
                <span aria-hidden="true" className="text-[9px]">{uit ? '▾' : '▸'}</span>
              </button>
              {uit && <div className="mb-1 flex flex-col pl-1">{g.items.map((it) => groepRij(it))}</div>}
            </div>
          );
        })}
      </div>

      <div className="mt-auto border-t border-ink-800 pt-3">
        {/* Demo-portaal: één klik, geen e-mail of code. Opent in een nieuw tabblad; het KMS blijft ingelogd. */}
        <a
          href="/dashboard/demo"
          target="_blank"
          rel="noopener"
          data-plek="demo-knop"
          className="mb-3 flex min-h-[40px] items-center justify-center rounded-md bg-amber-500 px-3 text-[13px] font-bold text-ink-900 hover:bg-amber-400"
        >
          Demo portaal openen
        </a>
        <InstalleerApp gebied="kms" variant="zijbalk" />
        {adminNaam && (
          <p className="mb-1.5 truncate px-2 text-[11px] text-ink-300" title={adminNaam}>
            Ingelogd als <span className="font-semibold text-ink-200">{adminNaam}</span>
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <form action={logout}>
            <button className="rounded px-2 py-1 text-[13px] font-semibold text-ink-300 hover:text-white max-md:min-h-[44px]">Uitloggen</button>
          </form>
          <button
            type="button"
            onClick={() => { setOpen(false); setToetsenOpen(true); }}
            aria-keyshortcuts="Shift+?"
            className="rounded px-2 py-1 text-[11px] font-semibold text-ink-300 hover:bg-ink-800 hover:text-white [@media(pointer:coarse)]:hidden"
          >
            Sneltoetsen <kbd className="ml-1 rounded bg-ink-800 px-1 text-[10px]">?</kbd>
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      <a
        href="#inhoud"
        className="sr-only z-[100] rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-ink-900 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Naar de inhoud
      </a>
      <div className="flex items-center justify-between gap-2 border-b border-line bg-ink-900 px-3 py-2 md:hidden">
        {terugStap ? (
          <Link
            href={terugStap.href}
            className="flex min-h-[44px] min-w-0 items-center gap-1 rounded px-1 text-[15px] font-semibold text-white"
          >
            <span aria-hidden="true" className="text-xl leading-none text-amber-500">‹</span>
            <span className="truncate"><span className="sr-only">Terug naar </span>{terugStap.label}</span>
          </Link>
        ) : (
          <Link href="/dashboard" className="flex min-h-[44px] items-center px-1">
            <span className="font-display text-base font-extrabold text-white">FREDERIKS</span>
            <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.24em] text-amber-500">KMS</span>
          </Link>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Zoeken"
            className="flex h-11 w-11 items-center justify-center rounded border border-ink-700 text-white"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13.2 13.2L17 17" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="kms-menu-mobiel"
            className="min-h-[44px] rounded border border-ink-700 px-3 text-sm font-semibold text-white"
          >
            Menu
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => setOpen(false)} className="absolute inset-0 cursor-pointer bg-black/40" />
          <div
            ref={mobielMenu}
            id="kms-menu-mobiel"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute left-0 top-0 h-full w-72 max-w-[85%] bg-ink-900 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Menu sluiten"
              className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded text-xl text-ink-200 hover:bg-ink-800 hover:text-white"
            >
              <span aria-hidden="true">✕</span>
            </button>
            {nav}
          </div>
        </div>
      )}
      <aside className="hidden shrink-0 md:sticky md:top-0 md:z-40 md:block md:h-screen">{rail}</aside>
      <div id="inhoud" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">{zoekBalk}{children}</div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Sneltoetsen open={toetsenOpen} onOpen={openToetsen} onSluit={sluitToetsen} onZoek={openZoeken} />
      <BezigBalk />
      <Toast />
    </div>
  );
}
