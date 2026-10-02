import { NextResponse, type NextRequest } from 'next/server';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { env } from '@/lib/env';
import { sendEmail, emailLayout, escapeHtml } from '@/lib/email';
import { meldAdres } from '@/content/kennismaking';
import {
  dashboardProspectUrl,
  datumNL,
  isBot,
  isGeldigToken,
  kennismakingUrl,
  logBezoek,
  prospectOpToken,
  QR_COOKIE,
  websiteHref,
  tijdNL,
  zetProspectTaak,
  type ProspectRij,
} from '@/lib/prospect/prospect';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function stuurDoor(req: NextRequest, pad: string, token?: string): NextResponse {
  const res = NextResponse.redirect(new URL(pad, req.url), 302);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (token) {
    res.cookies.set(QR_COOKIE, token, { path: '/kennismaking', maxAge: 15 * 60, httpOnly: true, sameSite: 'lax', secure: req.nextUrl.protocol === 'https:' });
  }
  return res;
}

/**
 * Korte url uit de QR-code op de brief: /k/<token>.
 * Logt de scan, werkt de prospect bij, maakt bij de eerste scan een beltaak en
 * mailt Jessi. Alles best effort: de bezoeker wordt altijd doorgestuurd.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = String((await params).token ?? '').trim().toLowerCase();
  if (!isGeldigToken(token)) return stuurDoor(req, '/');

  const sb = kmsAdmin();
  if (!sb) return stuurDoor(req, `/kennismaking/${token}`, token);

  let p: ProspectRij | null = null;
  try {
    p = await prospectOpToken(sb, token);
  } catch {
    return stuurDoor(req, `/kennismaking/${token}`, token);
  }
  if (!p || p.afgemeld_op) return stuurDoor(req, '/');

  const doel = `/kennismaking/${token}`;
  try {
    const telNiet = isBot(req.headers.get('user-agent')) || req.headers.get('purpose') === 'prefetch' || (await dashAuthed());
    if (!telNiet) await verwerkScan(sb, p);
  } catch {
    // Stil falen: de bezoeker merkt hier niets van.
  }
  return stuurDoor(req, doel, token);
}

/** HEAD-verzoeken (linkcheckers) gewoon doorsturen zonder iets te tellen. */
export async function HEAD(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = String((await params).token ?? '').trim().toLowerCase();
  return stuurDoor(req, isGeldigToken(token) ? `/kennismaking/${token}` : '/');
}

async function verwerkScan(sb: NonNullable<ReturnType<typeof kmsAdmin>>, p: ProspectRij) {
  const nu = new Date().toISOString();
  await logBezoek(sb, p.id, 'qr', `/k/${p.token}`);

  // "Eerste scan" atomair bepalen: alleen het verzoek dat eerste_scan_op vult telt.
  let eerste = false;
  if (!p.eerste_scan_op) {
    const { data } = await sb.from('prospecten').update({ eerste_scan_op: nu }).eq('id', p.id).is('eerste_scan_op', null).select('id');
    eerste = Array.isArray(data) && data.length > 0;
  }

  const patch: Record<string, unknown> = {
    aantal_scans: (Number(p.aantal_scans) || 0) + 1,
    laatste_scan_op: nu,
  };
  // De brief zet de status op 'benaderd'; een scan daarna is een warme lead.
  if (p.status === 'nieuw' || p.status === 'benaderd') patch.status = 'geinteresseerd';
  await sb.from('prospecten').update(patch).eq('id', p.id);

  if (!eerste) return;

  const regels = [
    `${p.bedrijfsnaam} heeft de brief gescand op ${tijdNL(nu)}.`,
    p.telefoon ? `Telefoon: ${p.telefoon}` : 'Telefoon: onbekend, zoek het op via de website.',
    p.website ? `Website: ${p.website}` : null,
    p.plaats ? `Plaats: ${p.plaats}` : null,
    p.branche ? `Branche: ${p.branche}` : null,
    `Prospect in het dashboard: ${dashboardProspectUrl(p.id)}`,
    `Wat zij zagen: ${kennismakingUrl(p.token)}`,
  ].filter(Boolean);

  await zetProspectTaak(
    sb,
    p.id,
    {
      titel: `Bel ${p.bedrijfsnaam}: heeft de brief gescand`,
      omschrijving: regels.join('\n'),
      prioriteit: 'normaal',
      werkstatus: 'Benaderen',
      vervaldatum: datumNL(1),
    },
    { bijwerken: false },
  );

  const tel = p.telefoon?.trim();
  const telLink = tel ? `tel:${tel.replace(/[^0-9+]/g, '')}` : '';
  await sendEmail({
    to: meldAdres(env.notifyEmail),
    subject: `${p.bedrijfsnaam} heeft net je brief gescand${tel ? ` (${tel})` : ''}`,
    html: emailLayout({
      heading: `${p.bedrijfsnaam} heeft net je brief gescand`,
      preheader: tel ? `Bel ze nu het nog vers is: ${tel}` : 'Ze kijken nu naar hun persoonlijke pagina.',
      bodyHtml: `
        <p style="margin:0;">Zojuist (${escapeHtml(tijdNL(nu))}) is de QR-code op je brief gescand. Ze kijken nu naar de pagina met hun eigen logo op de kleding.</p>
        <p style="margin:16px 0 0;font-size:18px;font-weight:700;color:#1c1c1c;">${tel ? `<a href="${escapeHtml(telLink)}" style="color:#1c1c1c;">${escapeHtml(tel)}</a>` : 'Geen telefoonnummer bekend'}</p>
        <p style="margin:8px 0 0;">${[p.plaats, p.branche].filter(Boolean).map(escapeHtml).join(' &middot; ')}${p.website ? `<br/><a href="${escapeHtml(websiteHref(p.website))}" style="color:#b04318;">${escapeHtml(p.website)}</a>` : ''}</p>
        <p style="margin:18px 0 0;">Er staat een beltaak voor morgen klaar. Bellen terwijl het nog vers is werkt het best.</p>
        <p style="margin:18px 0 0;"><a href="${escapeHtml(dashboardProspectUrl(p.id))}" style="display:inline-block;background:#ec6726;color:#1c1c1c;font-weight:700;text-decoration:none;padding:10px 18px;border-radius:8px;">Open prospect</a>
        &nbsp; <a href="${escapeHtml(kennismakingUrl(p.token))}" style="color:#b04318;">Bekijk wat zij zien</a></p>
      `,
    }),
  }).catch(() => ({ sent: false }));
}
