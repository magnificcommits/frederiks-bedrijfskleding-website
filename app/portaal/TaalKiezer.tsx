'use client';
import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TALEN, TAAL_COOKIE, TAAL_COOKIE_MAXAGE, TAAL_NAAM, type Taal } from '@/lib/i18n/portaal/kern';
import { useVertaler } from '@/lib/i18n/portaal/client';
import { vulTaalAanActie, zetTaalActie } from '@/lib/i18n/portaal/acties';
import type { TaalBron } from '@/lib/i18n/portaal/server';

const SYNC_SLEUTEL = 'fb_taal_sync';

/**
 * Taalkiezer voor het portaal: een gewone select met de taalnamen in hun eigen
 * taal (geen vlaggen). Na een keuze ververst de pagina met de nieuwe taal.
 *
 * Bij het laden:
 *  - kwam de taal uit de database (nieuw apparaat), dan zetten we de cookie, zodat
 *    volgende verzoeken de database niet meer nodig hebben;
 *  - is iemand ingelogd, dan vullen we de database aan als daar nog niets staat
 *    (eenmaal per browsersessie); zonder cookie zetten we die ook meteen.
 *  - op de loginpagina (niet ingelogd) zetten we niets vanzelf: dan wint na het
 *    inloggen een eerder opgeslagen voorkeur van de gebruiker.
 */
export default function TaalKiezer({
  bron,
  ingelogd = false,
  className = '',
}: {
  bron: TaalBron;
  ingelogd?: boolean;
  className?: string;
}) {
  const { taal, t } = useVertaler();
  const router = useRouter();
  const [bezig, startTransition] = useTransition();

  useEffect(() => {
    const zetCookie = () => {
      document.cookie = `${TAAL_COOKIE}=${taal}; path=/; max-age=${TAAL_COOKIE_MAXAGE}; samesite=lax`;
    };
    if (bron === 'db') {
      zetCookie();
      return;
    }
    if (!ingelogd) return;
    // Ingelogd zonder cookie en zonder opgeslagen voorkeur: de browsertaal vastleggen,
    // zodat niet elk verzoek opnieuw in de database hoeft te kijken.
    if (bron !== 'cookie') zetCookie();
    try {
      if (sessionStorage.getItem(SYNC_SLEUTEL) === taal) return;
      sessionStorage.setItem(SYNC_SLEUTEL, taal);
    } catch {
      // Geen sessionStorage: dan synchroniseren we gewoon.
    }
    void vulTaalAanActie(taal);
  }, [bron, ingelogd, taal]);

  function kies(nieuw: Taal) {
    if (nieuw === taal) return;
    startTransition(async () => {
      await zetTaalActie(nieuw);
      router.refresh();
    });
  }

  return (
    <label className={`relative inline-flex items-center gap-2 text-xs font-medium text-warm max-md:min-h-[40px] max-md:rounded-md max-md:border max-md:border-line max-md:bg-white max-md:px-2 ${className}`}>
      {/* Telefoon: alleen de taalcode, de echte select ligt er onzichtbaar overheen.
          "Nederlands" in 16 px duwde de bedrijfsnaam weg. */}
      <span className="font-semibold text-ink-800 md:hidden" aria-hidden="true">{taal.toUpperCase()}</span>
      <span className="sr-only">{t('taal.label')}</span>
      <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 10h16M10 2c2.5 2.4 2.5 13.6 0 16M10 2c-2.5 2.4-2.5 13.6 0 16" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <select
        value={taal}
        onChange={(e) => kies(e.target.value as Taal)}
        disabled={bezig}
        aria-busy={bezig || undefined}
        className="min-h-[36px] rounded-md border border-line bg-white py-1 pl-2 pr-7 text-xs font-semibold text-ink-800 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-60 max-md:absolute max-md:inset-0 max-md:h-full max-md:w-full max-md:opacity-0"
      >
        {TALEN.map((code) => (
          <option key={code} value={code} lang={code}>
            {TAAL_NAAM[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
