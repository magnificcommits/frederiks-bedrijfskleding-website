import Link from 'next/link';
import { site } from '@/content/site';

/**
 * De vaste CTA-combinatie op de publieke site.
 *
 *  - Primair: offerte aanvragen (/offerte). Eén oranje knop per scherm.
 *  - Secundair: een adviesgesprek plannen (/afspraak). Voor wie eerst wil praten.
 *
 * Overal dezelfde twee teksten, zodat een bezoeker niet op elke pagina een
 * andere knop hoeft te leren. De `data-cta`-attributen voeden GA4 via
 * components/AnalyticsEvents.tsx; `plek` zegt waar op de pagina de knop stond.
 */
export function CtaKnoppen({
  plek,
  donker = false,
  offerteHref = '/offerte',
  afspraakHref = '/afspraak',
  primairLabel = 'Vraag een offerte aan',
  secundairLabel = 'Plan een adviesgesprek',
  bewijs = true,
  className = '',
  vol = false,
}: {
  plek: string;
  donker?: boolean;
  offerteHref?: string;
  afspraakHref?: string;
  primairLabel?: string;
  secundairLabel?: string;
  /** Korte belofte onder de knoppen (reactietijd + beoordeling). */
  bewijs?: boolean;
  className?: string;
  /** Knoppen over de volle breedte, onder elkaar (zijbalken). */
  vol?: boolean;
}) {
  const secundair = donker
    ? 'btn border-2 border-white/70 bg-transparent text-white hover:border-white hover:bg-white hover:text-ink-900'
    : 'btn-outline bg-white';
  const breed = vol ? 'w-full' : '';
  const score = site.rating.value.toFixed(1).replace('.', ',');

  return (
    <div className={className} data-plek={plek}>
      <div className={vol ? 'grid gap-2' : 'flex flex-wrap gap-3'}>
        <Link href={offerteHref} className={`btn-primary ${breed}`} data-cta="offerte">
          {primairLabel}
        </Link>
        <Link href={afspraakHref} className={`${secundair} ${breed}`} data-cta="afspraak">
          {secundairLabel}
        </Link>
      </div>
      {bewijs && (
        <p className={`mt-3 text-sm ${donker ? 'text-ink-200' : 'text-warm'}`}>
          <span className={donker ? 'text-amber-400' : 'text-amber-700'} aria-hidden="true">★</span>{' '}
          <span className="sr-only">Beoordeeld met </span>
          {score} op Google <span aria-hidden="true">·</span> {site.belofte.toLowerCase()} <span aria-hidden="true">·</span> vrijblijvend
        </p>
      )}
    </div>
  );
}
