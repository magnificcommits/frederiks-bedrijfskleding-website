import Link from 'next/link';
import Image from 'next/image';
import { site } from '@/content/site';
import { Stars } from '@/components/Stars';

const stats = [
  { value: '5,0', label: 'gemiddelde waardering' },
  { value: `${site.brands.length}`, label: 'topmerken' },
  { value: 'Hengelo', label: 'eigen showroom en bedrukkerij' },
];

export function Hero() {
  return (
    <section className="bg-ink-900 text-white">
      {/* Gestikte naad als merkaccent (kleding), geen hazard-streep of gradient-blob */}
      <div className="border-t-2 border-dashed border-amber-500" aria-hidden="true" />
      <div className="container-x grid items-stretch lg:grid-cols-2">
        <div className="py-14 sm:py-20 lg:pr-12">
          <p className="eyebrow text-amber-400">Bedrijfskleding in de Achterhoek</p>
          <h1 className="mt-5 font-display text-4xl font-extrabold uppercase leading-[0.98] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Werkkleding<br />die het werk<br /><span className="text-amber-500">aankan</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-100">
            Geen webshop waar je het zelf uitzoekt. Bij ons krijg je {site.owner.split(' ')[0]}, die je bedrijf leert kennen, langskomt om te passen en je logo in eigen huis aanbrengt.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/kledingadvies" className="btn-primary">Gratis kledingadvies</Link>
            <a href={`tel:${site.phoneIntl}`} className="btn border-2 border-white/30 text-white hover:border-white/70">Bel {site.phone}</a>
          </div>
          <p className="mt-3 text-sm text-ink-200">
            Of{' '}
            <Link href="/pakket-samenstellen" className="font-semibold text-amber-300 underline decoration-amber-500/60 underline-offset-2 hover:text-amber-200">stel zelf je pakket samen</Link>.
          </p>
          <p className="mt-4 text-sm text-ink-200">
            <span className="font-semibold text-amber-300">Inbegrepen:</span> je eigen{' '}
            <Link href="/kledingbeheer" className="font-semibold text-white underline decoration-amber-500 underline-offset-2 hover:text-amber-200">online kledingbeheer</Link>,{' '}
            gratis bij je bedrijfskleding.
          </p>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-6">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="font-display text-2xl font-extrabold text-white">{s.value}</dt>
                <dd className="mt-1 text-xs uppercase tracking-wide text-ink-300">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative min-h-[24rem] lg:min-h-full">
          <Image
            src="/Frederiks-bedrijfskleding-1.jpg"
            alt="Jessi geeft persoonlijk kledingadvies in de showroom van Frederiks Bedrijfskleding"
            fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover"
          />
          {/* Kledinglabel-motief, linksboven */}
          <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-[3px] border border-dashed border-white/70 bg-ink-900/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
            Sinds {site.foundedYear} · Hengelo Gld
          </span>
          {/* Bijschrift bij de foto: wie je voor je krijgt */}
          <span className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-[3px] border-r-2 border-dashed border-amber-500 bg-white/95 px-3 py-1.5 text-xs font-bold text-ink-900 shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            {site.owner.split(' ')[0]} komt langs om te passen
          </span>
          {site.rating.count > 0 && (
            <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-[3px] border-l-2 border-dashed border-amber-500 bg-white px-4 py-3 shadow-card">
              <Stars value={Math.round(site.rating.value)} />
              <span className="text-sm font-bold text-ink-900">{site.rating.value.toFixed(1)} van 5 sterren</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
