import Link from 'next/link';
import { site } from '@/content/site';

/**
 * Vaste actiebalk onderin op mobiel.
 *
 * Eerder: twee knoppen (bellen, advies) plus een zwevende WhatsApp-knop die er
 * los boven hing en over tekst en formuliervelden viel. En de oranje knop had
 * witte tekst op oranje, wat onder de contrastnorm zit.
 *
 * Nu: drie vakken in één balk. Bellen en WhatsApp zijn de twee kanalen die
 * mensen op hun telefoon echt gebruiken; de offerte is de hoofdactie en krijgt
 * het meeste ruimte en het oranje vlak, met donkere tekst (contrast ruim AA).
 * De zwevende WhatsApp-knop staat op mobiel uit (zie WhatsAppButton).
 */
export function MobileActionBar() {
  const wa = site.whatsapp.replace(/[^0-9]/g, '');
  const tekst = encodeURIComponent('Hoi Jessi, ik heb een vraag over bedrijfskleding.');
  const vak = 'flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[13px] font-semibold';
  return (
    <nav
      aria-label="Snel contact"
      data-plek="mobiele-balk"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-[1fr_1fr_1.6fr] border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <a href={`tel:${site.phoneIntl}`} className={`${vak} text-ink-900`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
        </svg>
        Bellen
      </a>
      <a href={`https://wa.me/${wa}?text=${tekst}`} target="_blank" rel="noopener noreferrer" className={`${vak} border-l border-line text-ink-900`}>
        <svg viewBox="0 0 32 32" className="h-5 w-5 text-[#128C7E]" fill="currentColor" aria-hidden="true">
          <path d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.1 1.6 5.9L4 29l8.3-1.6c1.7.9 3.6 1.4 5.7 1.4 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7.7.7-3.6-.2-.4c-1-1.6-1.5-3.4-1.5-5.3C5.2 9.9 10.1 5 16 5s10.8 4.9 10.8 10.8S21.9 24.8 16 24.8z" />
        </svg>
        WhatsApp
      </a>
      <Link href="/offerte" className={`${vak} bg-amber-500 text-[14px] font-bold text-ink-900`} data-cta="offerte">
        Offerte aanvragen
        <span className="text-[11px] font-semibold text-ink-900/80">reactie {site.beloftKort}</span>
      </Link>
    </nav>
  );
}
