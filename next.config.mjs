import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// In development gebruikt Next.js eval() voor hot-reloading. Daarom staan we
// 'unsafe-eval' alleen in dev toe. In productie blijft de CSP streng (geen eval).
const isDev = process.env.NODE_ENV === 'development';

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:", // blob: voor foto-voorbeelden/verkleinen in de editors
  "font-src 'self' data:",
  "worker-src 'self'", // service worker van het KMS en het portaal (public/sw.js)
  "manifest-src 'self'", // web-app-manifesten onder /dashboard en /portaal
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com`,
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://*.supabase.co" + (isDev ? ' ws: http://localhost:*' : ''),
  // Nooit een http-bron laden op een https-pagina (alleen in productie: lokaal draait http).
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');
// Over 'unsafe-inline' in script-src: Next.js zet inline bootstrap-scripts in elke
// pagina. Zonder 'unsafe-inline' is een nonce per verzoek nodig (via middleware), en
// dan kan geen enkele pagina meer statisch of uit de cache komen: de hele website
// (branche- en regiopagina's) wordt dan per bezoek gerenderd. Bewuste afweging, zie
// docs/security-audit-2026-10.md. XSS-bescherming komt hier uit React-escaping, de
// sanitizer voor nieuwsbrief-HTML en sandboxed iframes voor mailvoorbeelden.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Logo-uploads (prospects, nieuwsbrief) lopen via server actions; standaard max 1 MB.
  // Vercel staat per verzoek max 4,5 MB toe, dus 4 MB.
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  outputFileTracingRoot: __dirname,
  images: {
    // Productfoto's staan bij de leveranciers op hun eigen CDN. next/image
    // weigert externe bronnen die hier niet staan, dus elke nieuwe leverancier
    // met een eigen beeldbank moet hier worden toegevoegd.
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.toptex.com' },          // WK. Designed To Work en Kariban (zelfde PIM)
      { protocol: 'https', hostname: 'hf-hcms-staging1.azureedge.net' }, // Snickers Workwear
      { protocol: 'https', hostname: 'www.brooktaverner.com' },   // Brook Taverner
      { protocol: 'https', hostname: 'image-pim.fristadskansas.com' }, // Fristads
      // Eigen opslag: gelijkgetrokken productfoto's en geüploade kleurfoto's.
      { protocol: 'https', hostname: 'ldbyljadqququzoicyid.supabase.co', pathname: '/storage/v1/object/public/media/**' },
    ],
  },
  // Branche-indeling oktober 2026 (zie claude/branche-onderzoek-2026-10-07.md):
  // oude adressen blijven werken voor wie ze heeft gedeeld of gebookmarkt.
  async redirects() {
    const oud = {
      'industrie-en-transport': 'industrie-en-logistiek',
      'horeca-en-hospitality': 'horeca-en-food',
      'zorg-en-beauty': 'zorg-en-salon',
      'agri-en-milieu': 'agrarisch-en-groen',
      representatief: 'kantoor-en-retail',
      'sport-en-promotie': 'clubs-en-verenigingen',
    };
    return Object.entries(oud).map(([van, naar]) => ({ source: `/branches/${van}`, destination: `/branches/${naar}`, permanent: true }));
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()',
          },
          // Popups (bv. een SSO-venster) blijven werken; andere sites krijgen geen greep op dit venster.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: CSP },
        ],
      },
      {
        // De service worker altijd vers ophalen, anders blijft een oude versie hangen.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;
