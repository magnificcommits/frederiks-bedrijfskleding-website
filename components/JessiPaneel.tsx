import Image from 'next/image';
import Link from 'next/link';
import { site } from '@/content/site';
import { contactpersoon } from '@/content/vertrouwen';

/**
 * Donker paneel met de foto van Jessi, de belofte en de directe lijn.
 * Staat naast elk formulier: wie twijfelt of er een mens achter zit, ziet haar.
 * Server component, geen JavaScript.
 */
export function JessiPaneel({
  kop = 'Je krijgt Jessi zelf',
  tekst = 'Geen keuzemenu en geen ticketnummer. Jessi leest je aanvraag, belt je terug en komt zelf langs om te passen.',
  punten = ['Reactie binnen 24 uur, op werkdagen', 'Passen bij jou op de zaak', 'Bedrukken en borduren in eigen huis'],
  plek,
  afspraak = true,
  className = '',
}: {
  kop?: string;
  tekst?: string;
  punten?: string[];
  plek: string;
  /** Knop naar de afspraakplanner. Uit op de afspraakpagina zelf. */
  afspraak?: boolean;
  className?: string;
}) {
  const voornaam = contactpersoon.naam.split(' ')[0];
  return (
    <div className={`paneel-donker ${className}`} data-plek={plek}>
      {contactpersoon.foto && (
        <div className="relative h-48 sm:h-56">
          <Image
            src={contactpersoon.foto}
            alt={`${contactpersoon.naam} in de showroom van ${site.name}`}
            fill
            sizes="(max-width: 1024px) 100vw, 32rem"
            className="object-cover object-[60%_22%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/25 to-transparent" aria-hidden="true" />
          <p className="absolute bottom-3 left-6 text-sm font-semibold text-white">
            {contactpersoon.naam}
            <span className="block text-xs font-normal text-ink-200">{contactpersoon.rol}</span>
          </p>
        </div>
      )}
      <div className="p-6">
        <h2 className="font-display text-xl font-extrabold text-white">{kop}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-200">{tekst}</p>
        <ul className="mt-4 space-y-2 text-sm text-white">
          {punten.map((p) => (
            <li key={p} className="flex gap-2.5">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" /></svg>
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-5 grid grid-cols-1 gap-2 border-t border-white/15 pt-5 sm:grid-cols-2 lg:grid-cols-1">
          {afspraak && (
            <Link href="/afspraak" className="btn bg-amber-500 px-4 text-ink-900 hover:bg-amber-400" data-cta="afspraak">
              Plan zelf een afspraak
            </Link>
          )}
          <a href={`tel:${site.phoneIntl}`} className="btn bg-white px-4 text-ink-900 hover:bg-amber-400" data-cta="telefoon">
            Bel {voornaam}: {site.phone}
          </a>
          <a
            href={`https://wa.me/${site.whatsapp.replace(/\D/g, '')}`}
            className="btn border-2 border-white/40 px-4 text-white hover:border-white"
            rel="noopener"
            data-cta="whatsapp"
          >
            Stuur een WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
