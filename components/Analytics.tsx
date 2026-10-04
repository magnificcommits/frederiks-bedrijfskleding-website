import Script from 'next/script';
import { env, isAnalyticsConfigured } from '@/lib/env';
import { AnalyticsEvents } from '@/components/AnalyticsEvents';

/**
 * GA4 met Consent Mode v2. Laadt alleen als NEXT_PUBLIC_GA_ID is gezet.
 * Standaard staat toestemming op 'denied'; de cookiebanner zet het op 'granted'.
 * Zo wordt er niets gemeten voordat de bezoeker akkoord geeft (AVG).
 *
 * Eerder werd een eerder gegeven "Accepteren" bij een volgend bezoek niet
 * hersteld: de banner verscheen niet meer (keuze stond in localStorage), maar
 * de consent bleef 'denied'. Terugkerende bezoekers werden dus nooit gemeten.
 * Het default-script leest nu de opgeslagen keuze en zet die direct terug.
 */
export function Analytics() {
  if (!isAnalyticsConfigured) return null;
  return (
    <>
      <Script id="ga-consent-default" strategy="beforeInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('consent', 'default', {
          ad_storage: 'denied', analytics_storage: 'denied',
          ad_user_data: 'denied', ad_personalization: 'denied'
        });
        try {
          if (localStorage.getItem('fb-consent') === 'granted') {
            gtag('consent', 'update', { analytics_storage: 'granted' });
          }
        } catch (e) {}
      `}</Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${env.gaId}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">{`
        gtag('js', new Date());
        gtag('config', '${env.gaId}', { anonymize_ip: true });
      `}</Script>
      {/* CTA-, telefoon-, WhatsApp- en formulier-events; alleen na toestemming. Zie docs/meetplan.md. */}
      <AnalyticsEvents />
    </>
  );
}
