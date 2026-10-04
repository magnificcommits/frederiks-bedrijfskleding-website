'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * Klein (i)-knopje met een korte uitleg bij een lastig veld. Werkt met tikken
 * (tablet), klikken en het toetsenbord; Escape of ergens anders tikken sluit.
 * Geen hover-only tooltip: die bestaat op een tablet niet.
 */
export default function InfoTip({ children, label = 'Uitleg' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function buiten(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function toets(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', buiten);
    document.addEventListener('keydown', toets);
    return () => {
      document.removeEventListener('pointerdown', buiten);
      document.removeEventListener('keydown', toets);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle normal-case tracking-normal">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 [@media(pointer:coarse)]:h-7 [@media(pointer:coarse)]:w-7"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
        </svg>
      </button>
      <span
        id={id}
        role="note"
        hidden={!open}
        className="absolute left-1/2 top-full z-50 mt-1.5 w-64 max-w-[80vw] -translate-x-1/2 rounded-md border border-line bg-white px-3 py-2 text-[12.5px] font-normal leading-snug text-ink-800 shadow-card"
      >
        {children}
      </span>
    </span>
  );
}
