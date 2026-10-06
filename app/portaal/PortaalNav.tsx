'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { portaalLogout } from './actions';
import type { PortaalRol } from '@/lib/portaal/team';
import { useVertaler } from '@/lib/i18n/portaal/client';

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
  const { t } = useVertaler();
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
    { kind: 'link', href: '/portaal', label: t('nav.overzicht'), toon: true },
    { kind: 'link', href: '/portaal/webshop', label: t('nav.kledingBestellen'), toon: true },
    {
      kind: 'group',
      id: 'bestellingen',
      label: t('nav.bestellingen'),
      toon: true,
      items: [
        { href: '/portaal/bestellingen', label: t('nav.mijnBestellingen') },
        { href: '/portaal/retouren', label: t('nav.retouren') },
      ],
    },
    {
      kind: 'group',
      id: 'beheer',
      label: t('nav.beheer'),
      toon: mag(['beheerder', 'leidinggevende']),
      items: [
        { href: '/portaal/medewerkers', label: t('nav.medewerkers') },
        { href: '/portaal/goedkeuringen', label: t('nav.goedkeuringen') },
        { href: '/portaal/drukproeven', label: t('nav.drukproeven') },
        { href: '/portaal/ontwerpen', label: t('nav.pakketOntwerpen') },
        { href: '/portaal/facturen', label: t('nav.facturen') },
      ],
    },
    { kind: 'link', href: '/portaal/sparen', label: t('nav.sparen'), toon: true },
    { kind: 'link', href: '/portaal/klachten', label: t('nav.vragenKlachten'), toon: true },
  ];

  const leafActief = (href: string) =>
    huidig === href ||
    pathname === href ||
    (href === '/portaal/medewerkers' && (huidig === '/portaal/team' || pathname.startsWith('/portaal/team'))) ||
    (href !== '/portaal' && pathname.startsWith(href + '/'));

  const linkActief = (href: string) => (href === '/portaal' ? huidig === '/portaal' || pathname === '/portaal' : leafActief(href));
  const groupActief = (items: Leaf[]) => items.some((i) => leafActief(i.href));

  // Actieve pagina: vet én een streep in de huisstijlkleur van de klant; kleur alleen
  // is niet genoeg (kleurenblind), vet alleen viel nauwelijks op.
  const actiefStijl =
    'font-semibold text-ink-900 underline decoration-2 underline-offset-[6px] [text-decoration-color:var(--portaal-accent,theme(colors.amber.500))]';
  // Op een telefoon minstens 44 px hoog, zodat je met een duim het goede item raakt.
  const tik = 'inline-flex items-center rounded-sm max-md:min-h-[44px]';

  return (
    <>
    <MobieleTabbalk rol={rol} linkActief={linkActief} leafActief={leafActief} groupActief={groupActief} entries={entries} />
    <nav ref={navRef} className="relative mt-6 hidden flex-wrap items-center gap-x-5 gap-y-2 border-y border-line py-3 text-sm md:flex">
      {entries
        .filter((e) => e.toon)
        .map((e) =>
          e.kind === 'link' ? (
            <Link
              key={e.href}
              href={e.href}
              aria-current={linkActief(e.href) ? 'page' : undefined}
              className={`${tik} ${linkActief(e.href) ? actiefStijl : 'font-semibold text-warm hover:text-ink-800'}`}
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
                className={`${tik} gap-1 ${groupActief(e.items) ? actiefStijl : 'font-semibold text-warm hover:text-ink-800'}`}
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
                      className={`block rounded-lg px-3 py-2 font-medium max-md:py-3 ${leafActief(i.href) ? 'bg-mist text-ink-900' : 'text-ink-700 hover:bg-mist'}`}
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
        <button className={`${tik} font-semibold text-warm hover:text-ink-800`}>{t('algemeen.uitloggen')}</button>
      </form>
    </nav>
    </>
  );
}

const ICOON: Record<string, React.ReactNode> = {
  overzicht: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  bestellen: <path d="M8 3 3.5 6l2 4H7v11h10V10h1.5l2-4L16 3a4 4 0 0 1-8 0Z" />,
  bestellingen: <><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></>,
  beheer: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5M16 4.8a3.2 3.2 0 0 1 0 6.4M18 14.8c1.7.8 2.8 2.6 3 5.2" /></>,
  meer: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
};

/**
 * Telefoon: vaste tabbalk onderin, zoals in een app. De bovenste menubalk liep op
 * een telefoon over drie regels. Vier vaste tabs (Overzicht, Bestellen,
 * Bestellingen, Beheer of Hulp) en Meer met de rest, ook de app-installatie.
 */
function MobieleTabbalk({ rol, entries, linkActief, leafActief, groupActief }: {
  rol: PortaalRol | null;
  entries: Entry[];
  linkActief: (href: string) => boolean;
  leafActief: (href: string) => boolean;
  groupActief: (items: Leaf[]) => boolean;
}) {
  const { t } = useVertaler();
  const [meer, setMeer] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setMeer(false); }, [pathname]);
  useEffect(() => {
    if (!meer) return;
    const oud = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oud; };
  }, [meer]);

  const beheer = rol === 'beheerder' || rol === 'leidinggevende';
  const groep = (id: string) => entries.find((e) => e.kind === 'group' && e.id === id) as Extract<Entry, { kind: 'group' }> | undefined;
  const bestel = groep('bestellingen');
  const beheerGroep = groep('beheer');
  const tabs = [
    { id: 'overzicht', href: '/portaal', label: t('nav.overzicht'), actief: linkActief('/portaal') },
    { id: 'bestellen', href: '/portaal/webshop', label: t('nav.bestellenKort'), actief: linkActief('/portaal/webshop') },
    { id: 'bestellingen', href: '/portaal/bestellingen', label: t('nav.bestellingen'), actief: bestel ? groupActief(bestel.items) : false },
    ...(beheer && beheerGroep
      ? [{ id: 'beheer', href: '/portaal/medewerkers', label: t('nav.beheer'), actief: groupActief(beheerGroep.items) }]
      : []),
  ];
  const meerItems: Leaf[] = [
    ...(bestel ? bestel.items.filter((i) => i.href !== '/portaal/bestellingen') : []),
    ...(beheer && beheerGroep ? beheerGroep.items.filter((i) => i.href !== '/portaal/medewerkers') : []),
    { href: '/portaal/sparen', label: t('nav.sparen') },
    { href: '/portaal/klachten', label: t('nav.vragenKlachten') },
  ];
  const meerActief = meerItems.some((i) => leafActief(i.href)) || pathname === '/portaal/app';
  const tab = 'flex min-h-[58px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold leading-tight';
  const kleur = (a: boolean) => (a ? 'text-ink-900' : 'text-warm');

  return (
    <>
      <nav aria-label={t('nav.overzicht')} className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {tabs.map((tb) => (
          <Link key={tb.id} href={tb.href} aria-current={tb.actief ? 'page' : undefined} className={`${tab} ${kleur(tb.actief)}`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICOON[tb.id]}</svg>
            <span className="max-w-full truncate">{tb.label}</span>
            <span className={`h-0.5 w-6 rounded-full ${tb.actief ? '' : 'invisible'}`} style={{ backgroundColor: 'var(--portaal-accent, #f59e0b)' }} aria-hidden="true" />
          </Link>
        ))}
        <button type="button" onClick={() => setMeer(true)} aria-expanded={meer} aria-haspopup="dialog" className={`${tab} ${kleur(meerActief || meer)}`}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">{ICOON.meer}</svg>
          <span>{t('nav.meer')}</span>
          <span className={`h-0.5 w-6 rounded-full ${meerActief ? '' : 'invisible'}`} style={{ backgroundColor: 'var(--portaal-accent, #f59e0b)' }} aria-hidden="true" />
        </button>
      </nav>

      {meer && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label={t('nav.meer')}>
          <button type="button" className="absolute inset-0 bg-ink-900/40" aria-label={t('nav.sluiten')} onClick={() => setMeer(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-card">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
            <ul className="divide-y divide-line">
              {meerItems.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} aria-current={leafActief(i.href) ? 'page' : undefined} className={`flex min-h-[52px] items-center justify-between text-[16px] ${leafActief(i.href) ? 'font-bold text-ink-900' : 'font-semibold text-ink-800'}`}>
                    {i.label}
                    <svg viewBox="0 0 20 20" className="h-5 w-5 text-ink-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4l6 6-6 6" /></svg>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/portaal/app" className="mt-3 flex min-h-[56px] items-center gap-3 rounded-xl border-2 px-4 text-[16px] font-bold text-ink-900" style={{ borderColor: 'var(--portaal-accent, #f59e0b)' }}>
              <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" strokeLinecap="round" /></svg>
              <span className="min-w-0">
                {t('nav.appOpTelefoon')}
                <span className="block text-[13px] font-normal text-warm">{t('installeer.beginscherm')}</span>
              </span>
            </Link>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/" className="flex min-h-[48px] items-center justify-center rounded-lg border border-line text-[15px] font-semibold text-ink-800">{t('nav.naarWebsite')}</Link>
              <form action={portaalLogout}>
                <button className="flex min-h-[48px] w-full items-center justify-center rounded-lg border border-line text-[15px] font-semibold text-ink-800">{t('algemeen.uitloggen')}</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
