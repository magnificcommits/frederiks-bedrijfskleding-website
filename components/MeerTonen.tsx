'use client';
import { Children, useState } from 'react';

/**
 * Telefoon: toont de eerste `n` onderdelen en een knop voor de rest. Vanaf md
 * staat alles er gewoon. De inhoud staat altijd in de HTML (alleen verborgen met
 * CSS), dus zoekmachines lezen alles mee.
 */
export function MeerTonen({ n = 2, label = 'Toon meer', className, children }: {
  n?: number; label?: string; className?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const items = Children.toArray(children);
  const rest = items.length - n;
  return (
    <>
      <div className={className}>
        {items.map((c, i) => (
          <div key={i} className={`contents ${!open && i >= n ? '[&>*]:max-md:hidden' : ''}`}>{c}</div>
        ))}
      </div>
      {rest > 0 && !open && (
        <button type="button" onClick={() => setOpen(true)} className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-current/20 px-4 text-[15px] font-semibold md:hidden">
          {label} ({rest})
        </button>
      )}
    </>
  );
}

/** Lange alinea: op de telefoon vijf regels met "Lees verder". */
export function LeesVerder({ className, children }: { className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className={`${className ?? ''} ${open ? '' : 'max-md:line-clamp-5'}`}>{children}</p>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 min-h-[44px] text-[15px] font-semibold text-amber-700 underline underline-offset-2 md:hidden">
          Lees verder
        </button>
      )}
    </>
  );
}
