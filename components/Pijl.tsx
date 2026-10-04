/**
 * Pijl in een rondje: het vaste teken voor "deze tegel of rij is een link".
 * `licht` voor op een donkere achtergrond. Kleurt oranje op hover van de
 * omliggende `group`.
 */
export function Pijl({ licht = false, className = '' }: { licht?: boolean; className?: string }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition group-hover:bg-amber-500 group-hover:text-ink-900 ${
        licht ? 'bg-white/15 text-white' : 'bg-ink-100 text-ink-900'
      } ${className}`}
      aria-hidden="true"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h12M11 5l5 5-5 5" /></svg>
    </span>
  );
}
