import { site } from '@/content/site';
import { ContactKnop } from '@/components/ContactPopup';

/**
 * De vaste contactactie op de publieke site: één knop die de contact-pop-up
 * opent (WhatsApp, e-mail, bellen). Geen offerteformulier en geen online agenda
 * meer; Jessi plant afspraken zelf in overleg (werkdocument 20 okt 2026).
 *
 * De props van de oude versie (offerteHref, afspraakHref, secundairLabel) worden
 * nog geaccepteerd zodat bestaande pagina's niet breken, maar doen niets meer.
 */
export function CtaKnoppen({
  plek,
  donker = false,
  primairLabel = 'Neem contact op',
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
  bewijs?: boolean;
  className?: string;
  vol?: boolean;
}) {
  const score = site.rating.value.toFixed(1).replace('.', ',');
  const label = /offerte|adviesgesprek|afspraak/i.test(primairLabel) ? 'Neem contact op' : primairLabel;
  return (
    <div className={className} data-plek={plek}>
      <ContactKnop className={`btn-primary ${vol ? 'w-full' : ''}`} bron={plek}>{label}</ContactKnop>
      {bewijs && (
        <p className={`mt-3 text-sm ${donker ? 'text-ink-200' : 'text-warm'}`}>
          <span className={donker ? 'text-amber-400' : 'text-amber-700'} aria-hidden="true">★</span>{' '}
          <span className="sr-only">Beoordeeld met </span>
          {score} op Google <span aria-hidden="true">·</span> WhatsApp, mail of bel <span aria-hidden="true">·</span> vrijblijvend
        </p>
      )}
    </div>
  );
}
