import Link from 'next/link';
import { site } from '@/content/site';

export function CtaBand({
  title = 'Klaar voor bedrijfskleding die klopt?',
  text = 'Vraag vrijblijvend advies aan. We bespreken je wensen en komen graag langs om te passen.',
}: { title?: string; text?: string }) {
  return (
    <section className="border-t-4 border-amber-500 bg-ink-900">
      <div className="container-x flex flex-col items-start justify-between gap-6 py-12 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-white text-balance">{title}</h2>
          <p className="mt-2 max-w-xl text-ink-200">{text}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Link href="/kledingadvies" className="btn-primary">Vraag advies aan</Link>
          <a href={`tel:${site.phoneIntl}`} className="btn border border-white/40 text-white hover:bg-white/10">{site.phone}</a>
        </div>
      </div>
    </section>
  );
}
