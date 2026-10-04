import { bouwManifest } from '@/lib/pwa/apps';

// Statisch: het manifest bevat geen gebruikersgegevens en verandert alleen bij een deploy.
export const dynamic = 'force-static';

export function GET() {
  return new Response(JSON.stringify(bouwManifest('kms')), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
