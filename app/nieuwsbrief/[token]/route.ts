import { getNieuwsbriefOpToken, siteUrl } from '@/lib/nieuwsbrief/opslag';
import { renderNieuwsbrief } from '@/lib/nieuwsbrief/render';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ZICHTBAAR = new Set(['gepland', 'verzenden', 'verzonden']);

function nietGevonden(): Response {
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Nieuwsbrief niet gevonden</title></head><body style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:80px auto;padding:0 20px;color:#1c1c1c;line-height:1.6;"><p style="font-size:13px;font-weight:700;letter-spacing:0.04em;color:#ec6726;text-transform:uppercase;">Frederiks Bedrijfskleding</p><p style="font-size:16px;">Deze nieuwsbrief is niet (meer) online te bekijken.</p><p><a href="${siteUrl()}" style="color:#ec6726;">Naar de website</a></p></body></html>`;
  return new Response(html, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' },
  });
}

/**
 * Publieke webversie van een verstuurde (of ingeplande) nieuwsbrief.
 * Zonder persoonsgegevens: merge-tags krijgen de algemene terugvalwaarde.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const brief = await getNieuwsbriefOpToken(token);
  if (!brief || brief.is_template || !ZICHTBAAR.has(brief.status)) return nietGevonden();

  const html = renderNieuwsbrief(brief.ontwerp, {
    onderwerp: brief.onderwerp || brief.naam,
    preheader: brief.preheader,
    modus: 'web',
    siteUrl: siteUrl(),
  });
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'public, max-age=300',
    },
  });
}
