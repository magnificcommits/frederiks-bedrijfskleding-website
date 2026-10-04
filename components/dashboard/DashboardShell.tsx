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

  // Naar een andere pagina: het telefoonmenu dicht.
  useEffect(() => setOpen(false), [pathname]);

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
      <aside className="hidden w-60 shrink-0 bg-ink-900 md:sticky md:top-0 md:block md:h-screen">{nav}</aside>
      <div id="inhoud" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">{children}</div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Sneltoetsen open={toetsenOpen} onOpen={openToetsen} onSluit={sluitToetsen} onZoek={openZoeken} />
      <BezigBalk />
      <Toast />
    </div>
  );
}
