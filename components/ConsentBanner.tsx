'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isAnalyticsConfigured } from '@/lib/env';

/**
 * Lichte cookiebanner gekoppeld aan Consent Mode. Verschijnt alleen als GA actief is
 * en de bezoeker nog geen keuze maakte. Slaat de keuze op in localStorage.
 */
export function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isAnalyticsConfigured) return;
    try {
      if (!localStorage.getItem('fb-consent')) setShow(true);
    } catch { /* localStorage geblokkeerd: toon niets */ }
  }, []);

  function choose(granted: boolean) {
    try { localStorage.setItem('fb-consent', granted ? 'granted' : 'denied'); } catch {}
    const g = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    if (g) g('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    });
    setShow(false);
  }

  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-xl border border-line bg-white p-5 shadow-card lg:inset-x-auto lg:left-6 lg:right-auto lg:bottom-6">
      <p className="text-sm text-ink-800">
        We gebruiken anonieme statistieken om de site te verbeteren. Geen advertentiecookies.
        Lees meer in onze <Link href="/privacy" className="font-semibold text-amber-700 hover:underline">privacyverklaring</Link>.
      </p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => choose(true)} className="btn-primary px-4 py-2 text-[13px]">Accepteren</button>
        <button onClick={() => choose(false)} className="btn-outline px-4 py-2 text-[13px]">Weigeren</button>
      </div>
    </div>
  );
}
