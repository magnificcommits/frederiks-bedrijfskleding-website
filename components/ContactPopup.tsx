'use client';
import { useEffect, useRef, useState } from 'react';
import { site } from '@/content/site';

/**
 * Eén contact-pop-up voor de hele site: WhatsApp, e-mail en bellen.
 *
 * Jessi wil geen formulieren en geen online agenda: ze plant zelf in overleg.
 * Elke algemene contactknop opent deze pop-up via <ContactKnop>. De pop-up zelf
 * staat één keer in de layout (<ContactPopup>) en luistert naar het event
 * 'fb:contact'. Kliks op de drie kanalen worden gemeten door AnalyticsEvents
 * (tel:, wa.me, mailto:) met plek "contact-popup", zodat we zien welk kanaal
 * bezoekers kiezen.
 */

const EVENT = 'fb:contact';

export function openContact(bron?: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { bron } }));
}

export function ContactKnop({
  children = 'Contact opnemen',
  className = 'btn-primary',
  bron,
}: {
  children?: React.ReactNode;
  className?: string;
  /** Waar op de site de knop staat, voor de meting. */
  bron?: string;
}) {
  return (
    <button type="button" className={className} onClick={() => openContact(bron)} data-cta="contact-openen" aria-haspopup="dialog">
      {children}
    </button>
  );
}

const waNummer = site.whatsapp.replace(/[^0-9]/g, '');
const waTekst = encodeURIComponent('Hoi Jessi, ik heb een vraag over bedrijfskleding.');

export const kanalen = [
  {
    id: 'whatsapp',
    titel: 'WhatsApp',
    sub: site.phone,
    href: `https://wa.me/${waNummer}?text=${waTekst}`,
    extern: true,
    icoon: (
      <svg viewBox="0 0 32 32" className="h-6 w-6" fill="currentColor" aria-hidden="true">
        <path d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.1 1.6 5.9L4 29l8.3-1.6c1.7.9 3.6 1.4 5.7 1.4 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7.7.7-3.6-.2-.4c-1-1.6-1.5-3.4-1.5-5.3C5.2 9.9 10.1 5 16 5s10.8 4.9 10.8 10.8S21.9 24.8 16 24.8zm5.9-7.9c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-2-1.8-2.3-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.6.1-.2.2-.3.3-.5.1-.2 0-.4 0-.6 0-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.2-.6-.4z" />
      </svg>
    ),
    kleur: 'bg-[#25D366]/15 text-[#128C7E]',
  },
  {
    id: 'mail',
    titel: 'E-mail',
    sub: site.email,
    href: `mailto:${site.email}`,
    extern: false,
    icoon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" strokeLinecap="round" />
      </svg>
    ),
    kleur: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'bellen',
    titel: 'Bellen',
    sub: site.phone,
    href: `tel:${site.phoneIntl}`,
    extern: false,
    icoon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
      </svg>
    ),
    kleur: 'bg-ink-100 text-ink-900',
  },
] as const;

/** De drie kanalen als rij of raster, ook los te gebruiken (contactpagina, slotblok). */
export function ContactKanalen({ plek, donker = false, className = '' }: { plek: string; donker?: boolean; className?: string }) {
  return (
    <ul className={`grid gap-2 ${className}`} data-plek={plek}>
      {kanalen.map((k) => (
        <li key={k.id}>
          <a
            href={k.href}
            {...(k.extern ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={`flex min-h-[60px] items-center gap-3 rounded-xl border px-4 py-3 transition ${
              donker ? 'border-white/15 bg-white/5 text-white hover:bg-white/10' : 'border-line bg-white text-ink-900 hover:border-amber-400 hover:bg-amber-50/40'
            }`}
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${k.kleur}`}>{k.icoon}</span>
            <span className="min-w-0">
              <span className="block text-[16px] font-bold">{k.titel}</span>
              <span className={`block truncate text-[14px] ${donker ? 'text-ink-200' : 'text-warm'}`}>{k.sub}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ContactPopup() {
  const [open, setOpen] = useState(false);
  const dialoog = useRef<HTMLDivElement>(null);
  const terug = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const opOpen = () => {
      terug.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    window.addEventListener(EVENT, opOpen);
    return () => window.removeEventListener(EVENT, opOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const oud = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialoog.current?.querySelector<HTMLElement>('a, button')?.focus();
    const opToets = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      // Focus binnen de pop-up houden.
      if (e.key === 'Tab' && dialoog.current) {
        const els = [...dialoog.current.querySelectorAll<HTMLElement>('a, button')];
        const eerste = els[0];
        const laatste = els[els.length - 1];
        if (e.shiftKey && document.activeElement === eerste) { e.preventDefault(); laatste.focus(); }
        else if (!e.shiftKey && document.activeElement === laatste) { e.preventDefault(); eerste.focus(); }
      }
    };
    document.addEventListener('keydown', opToets);
    return () => {
      document.body.style.overflow = oud;
      document.removeEventListener('keydown', opToets);
      terug.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-900/60 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
      <div
        ref={dialoog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-titel"
        className="w-full max-w-sm rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-card sm:rounded-2xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="contact-titel" className="text-xl font-extrabold text-ink-900">Neem contact op</h2>
            <p className="mt-1 text-[15px] text-warm">Stuur een appje, mail of bel. Jessi denkt graag met je mee.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="-mr-1 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-mist" aria-label="Sluiten">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>
        <ContactKanalen plek="contact-popup" className="mt-4" />
      </div>
    </div>
  );
}
