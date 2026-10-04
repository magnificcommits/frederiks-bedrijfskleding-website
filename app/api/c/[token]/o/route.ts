import { registreerOpen } from '@/lib/kms/campagneTracking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 1x1 transparante GIF.
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/** Open-pixel voor campagnemails. Faalt altijd stil: de mail moet gewoon laden. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await registreerOpen(token).catch(() => undefined);
  return new Response(new Uint8Array(GIF), {
    headers: {
      'content-type': 'image/gif',
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      'content-length': String(GIF.length),
    },
  });
}
