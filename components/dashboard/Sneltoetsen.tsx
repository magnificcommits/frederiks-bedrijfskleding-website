'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFocusVal } from './ui/useFocusVal';

/**
 * Sneltoetsen voor wie het KMS op een computer gebruikt, met een overzicht
 * onder "?". Twee-toetsreeksen in de stijl van Gmail: eerst g (ga naar), dan
 * een letter. Werkt niet terwijl je in een veld typt. Luistert in de
 * capture-fase, zodat de tweede letter niet ook een sneltoets van de pagina
 * zelf afvuurt (op Taken is A "nieuwe afspraak").
 */

type Toets = { toetsen: string[]; omschrijving: string; href?: string };

const GA_NAAR: Record<string, { href: string; label: string }> = {
  h: { href: '/dashboard', label: 'Overzicht' },
  t: { href: '/dashboard/taken', label: 'Taken en afspraken' },
  a: { href: '/dashboard/taken?weergave=agenda', label: 'Agenda' },
  l: { href: '/dashboard/leads', label: 'Leads' },
  k: { href: '/dashboard/klanten', label: 'Klanten' },
  e: { href: '/dashboard/offertes', label: 'Offertes' },
  o: { href: '/dashboard/orders', label: 'Orders' },
  f: { href: '/dashboard/facturen', label: 'Facturen' },
  p: { href: '/dashboard/producten', label: 'Producten' },
  m: { href: '/dashboard/passessie', label: 'Passen en maten' },
};

function isTypen(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(type);
  }
  return false;
}

export function zoekToetsLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl K';
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K';
}

export default function Sneltoetsen({
  open,
  onOpen,
  onSluit,
  onZoek,
}: {
  open: boolean;
  onOpen: () => void;
  onSluit: () => void;
  onZoek: () => void;
}) {
  const router = useRouter();
  const paneel = useRef<HTMLDivElement>(null);
  const [voorvoegsel, setVoorvoegsel] = useState<'g' | null>(null);
  const voorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [zoekLabel, setZoekLabel] = useState('Ctrl K');
  useFocusVal(paneel, open, onSluit);

  useEffect(() => setZoekLabel(zoekToetsLabel()), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypen(e.target)) return;
      // Een ander venster (bevestiging, formulier) is open: niet erdoorheen navigeren.
      if (!open && document.querySelector('[aria-modal="true"]')) return;

      if (voorvoegsel) {
        const doel = GA_NAAR[e.key.toLowerCase()];
        setVoorvoegsel(null);
        if (voorTimer.current) clearTimeout(voorTimer.current);
        if (doel) {
          e.preventDefault();
          e.stopPropagation();
          onSluit();
          router.push(doel.href);
        }
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        if (open) onSluit();
        else onOpen();
        return;
      }
      if (open) return;
      if (e.key === '/') {
        e.preventDefault();
        onZoek();
        return;
      }
      if (e.key === 'g') {
        setVoorvoegsel('g');
        if (voorTimer.current) clearTimeout(voorTimer.current);
        voorTimer.current = setTimeout(() => setVoorvoegsel(null), 1500);
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, voorvoegsel, onOpen, onSluit, onZoek, router]);

  if (!open) return null;

  const groepen: { titel: string; rijen: Toets[] }[] = [
    {
      titel: 'Algemeen',
      rijen: [
        { toetsen: [zoekLabel], omschrijving: 'Zoeken: klanten, orders, schermen' },
        { toetsen: ['/'], omschrijving: 'Ook zoeken' },
        { toetsen: ['?'], omschrijving: 'Dit overzicht openen of sluiten' },
        { toetsen: ['Esc'], omschrijving: 'Venster of menu sluiten' },
      ],
    },
    {
      titel: 'Ga naar (eerst g, dan de letter)',
      rijen: Object.entries(GA_NAAR).map(([k, v]) => ({ toetsen: ['g', k], omschrijving: v.label })),
    },
    {
      titel: 'Op de pagina Taken',
      rijen: [
        { toetsen: ['n'], omschrijving: 'Nieuwe taak' },
        { toetsen: ['a'], omschrijving: 'Nieuwe afspraak' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onSluit} className="drawer-overlay" />
      <div
        ref={paneel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sneltoetsen-titel"
        className="bevestig-paneel relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-white p-5 shadow-card sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="sneltoetsen-titel" className="font-display text-lg font-bold text-ink-900">Sneltoetsen</h2>
            <p className="mt-0.5 text-[13px] text-warm">Werkt overal in het KMS, behalve terwijl je in een veld typt.</p>
          </div>
          <button type="button" onClick={onSluit} className="knop-stil">Sluiten</button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {groepen.map((g) => (
            <section key={g.titel} className={g.titel === 'Algemeen' ? 'sm:col-span-2' : ''}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-warm">{g.titel}</h3>
              <dl className="mt-1.5 divide-y divide-line">
                {g.rijen.map((r) => (
                  <div key={r.omschrijving} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                    <dt className="text-ink-800">{r.omschrijving}</dt>
                    <dd className="flex shrink-0 gap-1">
                      {r.toetsen.map((t) => (
                        <kbd key={t} className="min-w-[1.6rem] rounded border border-line bg-mist px-1.5 py-0.5 text-center font-sans text-[12px] font-semibold text-ink-800">
                          {t}
                        </kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
