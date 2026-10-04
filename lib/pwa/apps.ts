import type { Metadata, Viewport } from 'next';

/**
 * De twee installeerbare apps: het KMS voor Jessi en Tim, en het kledingportaal
 * voor klanten. Elk heeft een eigen scope, zodat ze als twee losse iconen op de
 * telefoon of computer staan en elkaar (en de publieke site) niet raken.
 *
 * Kleuren komen uit tailwind.config.ts: ink-900 (#1c1c1c) voor het KMS, wit en
 * mist (#f6f5f4) voor het portaal. Iconen staan in public/pwa/ en zijn gemaakt
 * uit het FB-embleem van het logo (public/documenten/frederiks-logo.svg).
 */
export type PwaGebied = 'kms' | 'portaal';

type AppDef = {
  naam: string;
  kort: string;
  omschrijving: string;
  scope: string;
  themeColor: string;
  backgroundColor: string;
  statusBar: 'default' | 'black' | 'black-translucent';
  shortcuts: { name: string; short_name?: string; url: string }[];
};

export const PWA_APPS: Record<PwaGebied, AppDef> = {
  kms: {
    naam: 'Frederiks KMS',
    kort: 'KMS',
    omschrijving: 'Offertes, orders, klanten en taken van Frederiks Bedrijfskleding.',
    scope: '/dashboard',
    themeColor: '#1c1c1c',
    backgroundColor: '#1c1c1c',
    statusBar: 'black',
    shortcuts: [
      { name: 'Nieuwe offerte', short_name: 'Offerte', url: '/dashboard/offertes/nieuw' },
      { name: 'Orders', url: '/dashboard/orders' },
      { name: 'Taken', url: '/dashboard/taken' },
    ],
  },
  portaal: {
    naam: 'Frederiks Kledingportaal',
    kort: 'Kledingportaal',
    omschrijving: 'Bedrijfskleding bestellen en je bestellingen volgen bij Frederiks Bedrijfskleding.',
    scope: '/portaal',
    themeColor: '#ffffff',
    backgroundColor: '#f6f5f4',
    statusBar: 'default',
    shortcuts: [
      { name: 'Kleding bestellen', short_name: 'Bestellen', url: '/portaal/webshop' },
      { name: 'Mijn bestellingen', short_name: 'Bestellingen', url: '/portaal/bestellingen' },
    ],
  },
};

/** Het web-app-manifest als object; de route handlers geven dit als JSON terug. */
export function bouwManifest(gebied: PwaGebied) {
  const a = PWA_APPS[gebied];
  const icoon = (bestand: string, maat: number, purpose: 'any' | 'maskable') => ({
    src: `/pwa/${gebied}-${bestand}`,
    sizes: `${maat}x${maat}`,
    type: 'image/png',
    purpose,
  });
  return {
    id: a.scope,
    name: a.naam,
    short_name: a.kort,
    description: a.omschrijving,
    lang: 'nl',
    dir: 'ltr',
    start_url: a.scope,
    scope: a.scope,
    display: 'standalone',
    orientation: 'any',
    theme_color: a.themeColor,
    background_color: a.backgroundColor,
    icons: [
      icoon('192.png', 192, 'any'),
      icoon('512.png', 512, 'any'),
      icoon('maskable-192.png', 192, 'maskable'),
      icoon('maskable-512.png', 512, 'maskable'),
    ],
    shortcuts: a.shortcuts.map((s) => ({
      ...s,
      icons: [{ src: `/pwa/${gebied}-192.png`, sizes: '192x192', type: 'image/png' }],
    })),
  };
}

/** Manifest, iconen en iOS-instellingen voor de layout van het KMS of het portaal. */
export function pwaMetadata(gebied: PwaGebied): Metadata {
  const a = PWA_APPS[gebied];
  return {
    applicationName: a.naam,
    manifest: `${a.scope}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: a.kort, statusBarStyle: a.statusBar },
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: `/pwa/${gebied}-icoon.svg`, type: 'image/svg+xml' },
        { url: `/pwa/${gebied}-favicon-32.png`, sizes: '32x32', type: 'image/png' },
        { url: `/pwa/${gebied}-favicon-16.png`, sizes: '16x16', type: 'image/png' },
      ],
      apple: [{ url: `/pwa/${gebied}-apple-touch-icon.png`, sizes: '180x180' }],
    },
  };
}

export function pwaViewport(gebied: PwaGebied): Viewport {
  return { themeColor: PWA_APPS[gebied].themeColor };
}
