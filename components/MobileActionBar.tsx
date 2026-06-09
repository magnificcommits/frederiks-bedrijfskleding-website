import Link from 'next/link';
import { site } from '@/content/site';

/** Sticky bel/aanvraag-balk op mobiel — verlaagt drempel tot contact (conversie). */
export function MobileActionBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t border-line bg-white lg:hidden">
      <a href={`tel:${site.phoneIntl}`} className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-ink-800">
        Bel ons
      </a>
      <Link href="/kledingadvies" className="flex items-center justify-center gap-2 bg-amber-500 py-3 text-sm font-semibold text-white">
        Vraag advies aan
      </Link>
    </div>
  );
}
