import { NextResponse } from 'next/server';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { portaalUitnodigingMail } from '@/lib/kms/crm';

export const dynamic = 'force-dynamic';

/**
 * Voorbeeld van de uitnodigingsmail zoals deze klant hem krijgt, met de naam van de
 * eerste portaalgebruiker. auth: KMS-login vereist (dashAuthed).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) return new NextResponse('Niet ingelogd', { status: 401 });
  const { id } = await params;
  const sb = kmsAdmin();
  const [{ data: org }, { data: gebruiker }] = sb
    ? await Promise.all([
        sb.from('organisaties').select('naam').eq('id', id).maybeSingle(),
        sb.from('portaal_gebruikers').select('email, naam').eq('organisatie_id', id).order('created_at', { ascending: true }).limit(1).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const g = gebruiker as { email: string; naam: string | null } | null;
  const mail = await portaalUitnodigingMail(g?.email ?? 'naam@bedrijf.nl', g?.naam ?? 'Jan Jansen', (org as { naam: string } | null)?.naam ?? null);
  const kop = `<div style="font-family:system-ui,sans-serif;background:#111;color:#fff;padding:10px 16px;font-size:14px">Voorbeeld &middot; Onderwerp: <strong>${mail.subject.replace(/</g, '&lt;')}</strong></div>`;
  return new NextResponse(kop + mail.html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
