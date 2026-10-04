import { site } from '@/content/site';

/** Zwevende WhatsApp-knop. Laagdrempelig contactkanaal, populair in B2B. */
export function WhatsAppButton() {
  const nr = site.whatsapp.replace(/[^0-9]/g, '');
  const tekst = encodeURIComponent('Hoi Frederiks, ik heb een vraag over bedrijfskleding.');
  return (
    <a
      href={`https://wa.me/${nr}?text=${tekst}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Stuur ons een WhatsApp-bericht"
      data-plek="zwevende-knop"
      // Alleen op desktop: op mobiel zit WhatsApp in de actiebalk onderin, de
      // zwevende knop viel daar over tekst en formuliervelden heen.
      className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-card transition hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100 lg:inline-flex"
    >
      <svg viewBox="0 0 32 32" className="h-8 w-8" fill="currentColor" aria-hidden="true">
        <path d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.1 1.6 5.9L4 29l8.3-1.6c1.7.9 3.6 1.4 5.7 1.4 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7.7.7-3.6-.2-.4c-1-1.6-1.5-3.4-1.5-5.3C5.2 9.9 10.1 5 16 5s10.8 4.9 10.8 10.8S21.9 24.8 16 24.8zm5.9-7.9c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-2-1.8-2.3-.2-.3 0-.5.1-.7.1-.1.3-.4.5-.6.1-.2.2-.3.3-.5.1-.2 0-.4 0-.6 0-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.2-.6-.4z" />
      </svg>
    </a>
  );
}
