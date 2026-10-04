import { dashAuthed, magEigenaar } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { ublVoorFactuur } from '@/lib/kms/boekhoudExport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** UBL 2.1 (SI-UBL 2.0 / NLCIUS) van één definitieve factuur, als download. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) return new Response('Niet ingelogd', { status: 401 });
  if (!(await magEigenaar())) return new Response('Geen toegang', { status: 403 });
  const { id } = await params;
  const r = await ublVoorFactuur(id);
  if (!r.ok) return new Response(r.melding, { status: r.status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  await logAudit('factuur_ubl_gedownload', { entiteit: 'facturen', entiteitId: id });
  return new Response(r.xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${r.naam}"`,
      'Cache-Control': 'no-store',
    },
  });
}
