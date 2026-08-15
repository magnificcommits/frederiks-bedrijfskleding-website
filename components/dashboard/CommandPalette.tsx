'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Hit = { type: string; label: string; sub: string; href: string };

/**
 * Zoeken én navigeren met Cmd/Ctrl+K.
 *
 * Twee bronnen door elkaar: schermen (lokaal, direct) en records uit de
 * database (via /api/dashboard/search, vanaf 2 tekens). Schermen staan bovenaan
 * omdat je die het vaakst zoekt en ze geen wachttijd hebben.
 *
 * Bij een leeg zoekveld toont het palet meteen de schermen — zo is Cmd+K ook
 * het snelste pad ergens heen, niet alleen een zoekvenster.
 */
const SCHERMEN: Hit[] = [
  { type: 'Scherm', label: 'Overzicht', sub: 'Signalen en wat er loopt', href: '/dashboard' },
  { type: 'Scherm', label: 'Orders', sub: '', href: '/dashboard/orders' },
  { type: 'Scherm', label: 'Offertes', sub: '', href: '/dashboard/offertes' },
  { type: 'Scherm', label: 'Klanten', sub: '', href: '/dashboard/klanten' },
  { type: 'Scherm', label: 'Passessies', sub: '', href: '/dashboard/passessie' },
  { type: 'Scherm', label: 'Producten', sub: '', href: '/dashboard/producten' },
  { type: 'Scherm', label: 'Voorraad', sub: '', href: '/dashboard/voorraad' },
  { type: 'Scherm', label: 'Facturen', sub: '', href: '/dashboard/facturen' },
  { type: 'Scherm', label: 'Inkoop', sub: '', href: '/dashboard/inkoop' },
  { type: 'Scherm', label: 'Leads', sub: '', href: '/dashboard/leads' },
  { type: 'Scherm', label: 'Prospects', sub: '', href: '/dashboard/prospects' },
  { type: 'Scherm', label: 'Campagnes', sub: '', href: '/dashboard/campagnes' },
  { type: 'Scherm', label: 'Taken', sub: '', href: '/dashboard/taken' },
  { type: 'Scherm', label: 'Retouren', sub: '', href: '/dashboard/retouren' },
  { type: 'Scherm', label: 'Klachten en vragen', sub: '', href: '/dashboard/klachten' },
  { type: 'Scherm', label: 'Drukproeven', sub: '', href: '/dashboard/drukproeven' },
  { type: 'Scherm', label: 'Logo’s en werkbonnen', sub: '', href: '/dashboard/logos' },
  { type: 'Scherm', label: 'Leveranciers', sub: '', href: '/dashboard/leveranciers' },
  { type: 'Scherm', label: 'Pakketten', sub: '', href: '/dashboard/pakketten' },
  { type: 'Scherm', label: 'Functies', sub: '', href: '/dashboard/functies' },
  { type: 'Scherm', label: 'Analyse', sub: '', href: '/dashboard/analyse' },
  { type: 'Scherm', label: 'Rapportages', sub: '', href: '/dashboard/rapportages' },
  { type: 'Scherm', label: 'Meldingen', sub: '', href: '/dashboard/meldingen' },
  { type: 'Scherm', label: 'Import', sub: '', href: '/dashboard/import' },
  { type: 'Scherm', label: 'Instellingen', sub: '', href: '/dashboard/instellingen' },
  { type: 'Scherm', label: 'Beheerders', sub: '', href: '/dashboard/admins' },
];

/** Werklijsten die je vanuit het niets wilt kunnen openen. */
const SNELFILTERS: Hit[] = [
  { type: 'Werklijst', label: 'Orders die op goedkeuring wachten', sub: '', href: '/dashboard/orders?status=offerte_goedgekeurd' },
  { type: 'Werklijst', label: 'Producten zonder foto', sub: '', href: '/dashboard/producten?zonderfoto=1' },
  { type: 'Werklijst', label: 'Klanten die mogelijk dubbel staan', sub: '', href: '/dashboard/klanten?dubbel=1' },
  { type: 'Werklijst', label: 'Retouren die beoordeeld moeten worden', sub: '', href: '/dashboard/retouren?status=aangemeld' },
];

function past(h: Hit, term: string) {
  const t = term.toLowerCase();
  return h.label.toLowerCase().includes(t) || h.sub.toLowerCase().includes(t);
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [records, setRecords] = useState<Hit[]>([]);
  const [actief, setActief] = useState(0);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setRecords([]);
    setActief(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Records ophalen vanaf 2 tekens, met debounce.
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setRecords([]);
      return;
    }
    setBezig(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dashboard/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { results: Hit[] };
        setRecords(data.results ?? []);
      } catch {
        /* afgebroken of mislukt: stil laten */
      } finally {
        setBezig(false);
      }
    }, 180);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, open]);

  const lijst = useMemo(() => {
    const term = q.trim();
    if (!term) return [...SCHERMEN.slice(0, 6), ...SNELFILTERS];
    const lokaal = [...SCHERMEN, ...SNELFILTERS].filter((h) => past(h, term));
    return [...lokaal, ...records];
  }, [q, records]);

  useEffect(() => setActief(0), [lijst.length]);

  function ga(hit: Hit) {
    onClose();
    router.push(hit.href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActief((i) => Math.min(i + 1, lijst.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActief((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && lijst[actief]) {
      e.preventDefault();
      ga(lijst[actief]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" onKeyDown={onKey}>
      <button type="button" aria-label="Sluiten" onClick={onClose} className="absolute inset-0 cursor-default bg-black/50" />
      <div className="relative w-full max-w-xl overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ga naar een scherm, of zoek klant, product, order, offerte of factuur…"
          aria-label="Zoeken en navigeren"
          className="w-full border-b border-line px-4 py-3 text-sm focus:outline-none"
        />
        <div className="max-h-80 overflow-y-auto">
          {lijst.length === 0 ? (
            <p className="px-5 py-6 text-center text-[13px] text-warm">{bezig ? 'Zoeken…' : 'Niets gevonden.'}</p>
          ) : (
            <ul className="py-1.5">
              {lijst.map((h, i) => (
                <li key={`${h.type}-${h.href}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActief(i)}
                    onClick={() => ga(h)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-[13px] ${i === actief ? 'bg-mist' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink-900">{h.label}</span>
                      {h.sub && <span className="block truncate text-[11px] text-warm">{h.sub}</span>}
                    </span>
                    <span className="chip-tel shrink-0 uppercase tracking-wide">{h.type}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-1.5 text-[11px] text-warm">
          <span>↑↓ kiezen · Enter openen · Esc sluiten</span>
          <span>{q.trim().length < 2 ? 'Typ 2 tekens om ook records te zoeken' : bezig ? 'Zoeken…' : `${lijst.length} resultaten`}</span>
        </div>
      </div>
    </div>
  );
}
