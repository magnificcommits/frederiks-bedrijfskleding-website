import Link from 'next/link';

/**
 * Vaste knop rechtsonder op een telefoon voor de hoofdhandeling van een lijst
 * ("Nieuwe order"). Op tablet en computer staat die knop al in de paginakop,
 * daar is dit element verborgen. De lege strook eronder voorkomt dat de knop
 * de laatste rij van de lijst afdekt.
 */
export default function ActieKnopMobiel({ href, label }: { href: string; label: string }) {
  return (
    <>
      <div aria-hidden="true" className="h-20 md:hidden" />
      <Link href={href} className="actie-mobiel">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 12 12" className="shrink-0">
          <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
        {label}
      </Link>
    </>
  );
}
