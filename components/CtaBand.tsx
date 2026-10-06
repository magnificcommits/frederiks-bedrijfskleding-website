import { site } from '@/content/site';
import { CtaKnoppen } from '@/components/CtaKnoppen';

/**
 * Afsluitende band onderaan een pagina. Zelfde twee knoppen als in de hero
 * (offerte primair, adviesgesprek secundair) en het telefoonnummer als tekst,
 * zodat er per scherm maar één oranje knop staat.
 */
export function CtaBand({
  title = 'Klaar voor bedrijfskleding die klopt?',
  text = 'Vertel wat je zoekt. We denken mee, komen langs om te passen en sturen een offerte waar alles in staat.',
  plek = 'cta-band',
}: { title?: string; text?: string; plek?: string }) {
  return (
    <section className="border-t-4 border-amber-500 bg-ink-900">
      <div className="container-x grid grid-cols-1 items-center gap-8 py-12 sm:py-14 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h2 className="kop-2 text-balance text-white">{title}</h2>
          <p className="mt-3 max-w-xl text-ink-200">{text}</p>
          <p className="mt-3 text-sm text-ink-200" data-plek={plek}>
            Of bel {site.owner.split(' ')[0]} direct:{' '}
            <a href={`tel:${site.phoneIntl}`} className="font-semibold text-white underline decoration-amber-500 underline-offset-4 hover:text-amber-300">
              {site.phone}
            </a>
          </p>
        </div>
        <CtaKnoppen plek={plek} donker />
      </div>
    </section>
  );
}
