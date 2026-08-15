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
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com`,
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://*.supabase.co" + (isDev ? ' ws: http://localhost:*' : ''),
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
