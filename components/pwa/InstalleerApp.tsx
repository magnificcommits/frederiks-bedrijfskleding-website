'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PwaGebied } from '@/lib/pwa/apps';
import { abonneer, installPrompt, isIos, isStandalone, vraagInstallatie } from '@/lib/pwa/installatie';
import { useVertaler } from '@/lib/i18n/portaal/client';

/**
 * Installeerhulp voor het KMS en het kledingportaal.
 *
 *  - Chrome en Edge (Android en computer): knop "Installeer als app", die de
 *    installatievraag van de browser opent.
 *  - iPhone en iPad: daar bestaat geen installatievraag, dus een korte uitleg:
 *    Deel-icoon, dan "Zet op beginscherm".
 *  - Draait het al als app: niets.
 *
 * Varianten:
 *  - zijbalk: klein, onderaan de donkere menubalk van het KMS;
 *  - blok:    een licht blok op de overzichtspagina van het portaal;
 *  - pagina:  alleen de knop (of "je gebruikt de app al"), voor de uitlegpagina's.
 * Wegklikken (zijbalk en blok) wordt per app in deze browser onthouden.
 * Teksten via de portaalvertalingen; buiten het portaal (KMS) is dat Nederlands.
 */
type Variant = 'zijbalk' | 'blok' | 'pagina';
type Stand = 'laden' | 'app' | 'prompt' | 'ios' | 'anders';

const WEG_SLEUTEL = (g: PwaGebied) => `fb_pwa_weg_${g}`;

function leesWeg(g: PwaGebied): boolean {
  try {
    return localStorage.getItem(WEG_SLEUTEL(g)) === '1';
  } catch {
    return false;
  }
}

function zetWeg(g: PwaGebied) {
  try {
    localStorage.setItem(WEG_SLEUTEL(g), '1');
  } catch {
    // Onthouden is een gemak; lukt het niet, dan verdwijnt het blok alleen nu.
  }
}

function bepaalStand(): Stand {
  if (isStandalone()) return 'app';
  if (installPrompt()) return 'prompt';
  if (isIos()) return 'ios';
  return 'anders';
}

function DeelIcoon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true" focusable="false" className={`inline-block align-[-2px] ${className}`}>
      <path d="M10 2.5v10M6.5 6L10 2.5 13.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 9H4.5v8.5h11V9H14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** De drie stappen voor iPhone en iPad. */
export function IosStappen({ donker = false }: { donker?: boolean }) {
  const nadruk = donker ? 'font-semibold text-white' : 'font-semibold text-ink-900';
  const { t, rijk } = useVertaler();
  return (
    <ol className="list-decimal space-y-1 pl-4">
      <li>
        {rijk('installeer.ios1', { icoon: <DeelIcoon />, puntjes: <span className={nadruk}>•••</span> })}
      </li>
      <li>{rijk('installeer.ios2', { knop: <span className={nadruk}>{t('installeer.ios2Knop')}</span> })}</li>
      <li>{rijk('installeer.ios3', { knop: <span className={nadruk}>{t('installeer.ios3Knop')}</span> })}</li>
    </ol>
  );
}

export default function InstalleerApp({
  gebied,
  variant,
  uitlegHref,
}: {
  gebied: PwaGebied;
  variant: Variant;
  /** Link naar de uitlegpagina, voor als de browser zelf niet kan installeren. */
  uitlegHref?: string;
}) {
  const { t } = useVertaler();
  const [stand, setStand] = useState<Stand>('laden');
  const [weg, setWeg] = useState(true);
  const [uitleg, setUitleg] = useState(false);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    setWeg(variant !== 'pagina' && leesWeg(gebied));
    setStand(bepaalStand());
    return abonneer(() => setStand(bepaalStand()));
  }, [gebied, variant]);

  async function installeer() {
    setBezig(true);
    await vraagInstallatie();
    setBezig(false);
    setStand(bepaalStand());
  }

  function wegklikken() {
    zetWeg(gebied);
    setWeg(true);
  }

  if (stand === 'laden') return null;

  // --- Uitlegpagina: alleen de knop of de bevestiging ---------------------
  if (variant === 'pagina') {
    if (stand === 'app') {
      return <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{t('installeer.appAl')}</p>;
    }
    if (stand === 'prompt') {
      return (
        <div className="rounded-lg border border-line bg-white p-4">
          <p className="text-sm text-ink-800">{t('installeer.direct')}</p>
          <button type="button" onClick={installeer} disabled={bezig} className="btn-primary mt-3">{t('installeer.knop')}</button>
        </div>
      );
    }
    return null;
  }

  if (weg || stand === 'app') return null;

  // --- Zijbalk van het KMS: klein en rustig --------------------------------
  if (variant === 'zijbalk') {
    if (stand === 'anders') return null;
    return (
      <div className="mb-3 rounded border border-ink-800 px-2 py-2 text-[12px] leading-snug text-ink-300">
        <div className="flex items-center justify-between gap-2">
          {stand === 'prompt' ? (
            <button type="button" onClick={installeer} disabled={bezig} className="font-semibold text-ink-100 hover:text-white">
              {t('installeer.knop')}
            </button>
          ) : (
            <button type="button" onClick={() => setUitleg((v) => !v)} aria-expanded={uitleg} className="font-semibold text-ink-100 hover:text-white">
              {t('installeer.beginscherm')}
            </button>
          )}
          <button type="button" onClick={wegklikken} aria-label={t('installeer.nietMeerTonen')} title={t('installeer.nietMeerTonen')} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-400 hover:bg-ink-800 hover:text-white">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {stand === 'ios' && uitleg && (
          <div className="mt-2">
            <IosStappen donker />
          </div>
        )}
      </div>
    );
  }

  // --- Blok in het portaal ---------------------------------------------------
  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-base font-extrabold text-ink-900">{t('installeer.titel')}</p>
          {stand === 'prompt' && (
            <p className="mt-1 text-sm text-warm">{t('installeer.promptTekst')}</p>
          )}
          {stand === 'ios' && (
            <div className="mt-2 text-sm text-warm">
              <IosStappen />
            </div>
          )}
          {stand === 'anders' && (
            <p className="mt-1 text-sm text-warm">{t('installeer.andersTekst')}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {stand === 'prompt' && (
              <button type="button" onClick={installeer} disabled={bezig} className="btn-primary">{t('installeer.knop')}</button>
            )}
            {uitlegHref && (
              <Link href={uitlegHref} className="text-sm font-semibold text-amber-700 hover:text-amber-800">{t('installeer.perApparaat')}</Link>
            )}
          </div>
        </div>
        <button type="button" onClick={wegklikken} aria-label={t('installeer.nietMeerTonen')} title={t('installeer.nietMeerTonen')} className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg text-warm hover:bg-mist hover:text-ink-900">
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </section>
  );
}
