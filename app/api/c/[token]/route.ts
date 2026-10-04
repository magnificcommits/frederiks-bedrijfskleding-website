import { NextResponse } from 'next/server';
import { afmeldUrl } from '@/lib/kms/campagneAfmelden';
import { handtekeningKlopt, registreerAfmeldKlik, registreerKlik } from '@/lib/kms/campagneTracking';
import { site } from '@/content/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Kliktracking voor campagnemails: /api/c/<token>?u=<url>&h=<handtekening>.
 * Zonder geldige handtekening sturen we niet door (geen open redirect), maar
 * naar de homepage. ?a=1 is de afmeldlink: registreren en door naar /afmelden.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  // auth: token (doorsturen alleen met geldige HMAC-handtekening over token + doel-url).
  const { token } = await params;
  const url = new URL(req.url);

  if (url.searchParams.get('a') === '1') {
    const email = await registreerAfmeldKlik(token).catch(() => null);
    return NextResponse.redirect(email ? afmeldUrl(email) : `${site.url}/afmelden`, 302);
  }

  const doel = url.searchParams.get('u') ?? '';
  const h = url.searchParams.get('h') ?? '';
  if (!/^https?:\/\//i.test(doel) || !handtekeningKlopt(token, doel, h)) {
    return NextResponse.redirect(site.url, 302);
  }
  await registreerKlik(token, doel).catch(() => false);
  return NextResponse.redirect(doel, 302);
}
