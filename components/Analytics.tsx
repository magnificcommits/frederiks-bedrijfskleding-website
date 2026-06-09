import Script from 'next/script';
import { env, isAnalyticsConfigured } from '@/lib/env';

/**
 * GA4 — laadt alleen als NEXT_PUBLIC_GA_ID is gezet. Koppel dit aan een
 * consent-banner (Consent Mode) voordat je live gaat (AVG/MEASUREMENT.md).
 */
export function Analytics() {
  if (!isAnalyticsConfigured) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${env.gaId}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${env.gaId}', { anonymize_ip: true });
      `}</Script>
    </>
  );
}
