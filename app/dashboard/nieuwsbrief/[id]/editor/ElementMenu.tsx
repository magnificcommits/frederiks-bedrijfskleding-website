'use client';

/** Het kleine menu (...) bij een sectie of blok: omhoog, omlaag, dupliceren, verwijderen. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IcoonMeer } from './iconen';

export type MenuItem = { label: string; icoon?: ReactNode; onClick: () => void; uit?: boolean; gevaar?: boolean };

export default function ElementMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dicht = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', dicht);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', dicht);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Meer acties"
        className="flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-white text-blue-700 shadow-sm hover:bg-blue-50"
      >
        <IcoonMeer />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-8 z-50 w-52 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-card">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.uit}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                it.gevaar ? 'text-red-700 hover:bg-red-50' : 'text-ink-800 hover:bg-mist'
              }`}
            >
              <span className="text-warm">{it.icoon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
