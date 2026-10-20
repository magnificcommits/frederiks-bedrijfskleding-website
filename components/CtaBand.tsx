import { ContactKanalen } from '@/components/ContactPopup';

/**
 * Afsluitend contactblok onderaan een pagina: WhatsApp, e-mail en bellen direct
 * zichtbaar (werkdocument Jessi, 20 okt 2026). Geen formulier, geen afspraakknop.
 */
export function CtaBand({
  title = 'Klaar voor bedrijfskleding die klopt?',
  text = 'Vertel me wat je zoekt. Ik denk met je mee en maak een passend voorstel voor jouw bedrijfskleding.',
  plek = 'cta-band',
}: { title?: string; text?: string; plek?: string }) {
  return (
    <section className="border-t-4 border-amber-500 bg-ink-900">
      <div className="container-x grid grid-cols-1 items-center gap-8 py-12 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div>
          <h2 className="kop-2 text-balance text-white">{title}</h2>
          <p className="mt-3 max-w-xl text-lg text-ink-200">{text}</p>
        </div>
        <ContactKanalen plek={plek} donker />
      </div>
    </section>
  );
}
