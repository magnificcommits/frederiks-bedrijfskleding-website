/**
 * Uitklapbaar tekstblok op basis van <details>/<summary>.
 *
 * Bewust geen JavaScript: het werkt zonder client-component, het is toegankelijk
 * met toetsenbord en schermlezer, en zoekmachines lezen de inhoud gewoon mee —
 * inklappen verbergt tekst voor de bezoeker, niet voor Google.
 *
 * Zo houden we de diepgang die een inkoper soms nodig heeft, zonder dat elke
 * bezoeker zich er doorheen moet lezen.
 */
export function Uitklap({
  titel,
  samenvatting,
  open = false,
  children,
}: {
  titel: string;
  samenvatting?: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group border-b border-line last:border-b-0">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-semibold text-ink-900">{titel}</span>
          {samenvatting && <span className="mt-0.5 block text-sm text-warm">{samenvatting}</span>}
        </span>
        <span
          aria-hidden="true"
          className="mt-1 shrink-0 text-amber-700 transition-transform duration-200 group-open:rotate-45"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 3v12M3 9h12" />
          </svg>
        </span>
      </summary>
      <div className="prose-nl pb-5 text-[15px]">{children}</div>
    </details>
  );
}
