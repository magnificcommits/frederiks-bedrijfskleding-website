'use client';
import { useEffect } from 'react';
import { PWA_APPS, type PwaGebied } from '@/lib/pwa/apps';
// Laadt de luisteraar voor beforeinstallprompt zo vroeg mogelijk.
import '@/lib/pwa/installatie';

/**
 * Registreert de service worker (public/sw.js) met de scope van dit deel: /dashboard
 * voor het KMS, /portaal voor het kledingportaal. Alleen in productie, zodat de
 * ontwikkelserver nooit uit een cache draait. Rendert niets.
 */
export default function PwaRegistratie({ gebied }: { gebied: PwaGebied }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const scope = PWA_APPS[gebied].scope;
    if (!window.location.pathname.startsWith(scope)) return;
    navigator.serviceWorker.register('/sw.js', { scope }).catch(() => {
      // Zonder service worker werkt alles gewoon, alleen niet offline en niet installeerbaar in Chrome.
    });
  }, [gebied]);
  return null;
}
