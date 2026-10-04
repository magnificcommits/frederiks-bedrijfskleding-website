import { dashAuthed, magEigenaar } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { facturenInPeriode, facturenNaarCsv, isIsoDatum, ublBestandenVoor } from '@/lib/kms/boekhoudExport';
import { maakZip } from '@/lib/kms/zip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Export van alle definitieve facturen in een periode voor de boekhouding:
 *   ?formaat=csv&van=2026-07-01&tot=2026-09-30  -> CSV voor Excel
 *   ?formaat=ubl&van=...&tot=...                -> ZIP met een UBL-bestand per factuur
 * `tot` is inclusief.
 */
export async function GET(req: Request) {
  if (!(await dashAuthed())) return new Response('Niet ingelogd', { status: 401 });
  if (!(await magEigenaar())) return new Response('Geen toegang', { status: 403 });
  const sp = new URL(req.url).searchParams;
  const formaat = sp.get('formaat') === 'ubl' ? 'ubl' : 'csv';
  const van = sp.get('van');
  const tot = sp.get('tot');
  const tekst = (m: string, status = 400) => new Response(m, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  if (!isIsoDatum(van) || !isIsoDatum(tot)) return tekst('Kies een begin- en einddatum.');
  if (van > tot) return tekst('De begindatum ligt na de einddatum.');

  const facturen = await facturenInPeriode(van, tot);
  const naamBasis = `facturen-${van}-tm-${tot}`;
  await logAudit('facturen_export_boekhouding', { entiteit: 'facturen', details: { formaat, van, tot, aantal: facturen.length } });

  if (formaat === 'csv') {
    return new Response(facturenNaarCsv(facturen), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${naamBasis}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (facturen.length === 0) return tekst('Geen definitieve facturen in deze periode.', 404);
  const zip = maakZip(await ublBestandenVoor(facturen));
  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${naamBasis}-ubl.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
