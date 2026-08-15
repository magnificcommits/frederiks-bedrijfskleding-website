import { dashAuthed } from '@/lib/kms/adminClient';
import { kmsAdmin } from '@/lib/kms/adminClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Exporteert de productlijst als CSV, met dezelfde filters als het scherm.
 *
 * Gebouwd voor één concrete klus: de artikelen zonder foto op een lijst zetten
 * die je naar de leverancier kunt mailen ("hebben jullie hier beeld van?").
 * Met `?zonderfoto=1` krijg je precies die selectie, inclusief een lege kolom
 * waar de leverancier de foto-URL in kan zetten.
 */
export async function GET(req: Request) {
  if (!(await dashAuthed())) return new Response('Niet toegestaan', { status: 401 });
  const sb = kmsAdmin();
  if (!sb) return new Response('Niet geconfigureerd', { status: 400 });

  const sp = new URL(req.url).searchParams;
  const zonderFoto = sp.get('zonderfoto') === '1';
  const merk = (sp.get('merk') ?? '').trim();

  let q = sb
    .from('producten')
    .select('merk, sku, naam, categorie, afbeeldingen, product_varianten(count)')
    .eq('actief', true)
    .order('merk')
    .order('naam');
  if (merk) q = q.eq('merk', merk);
  if (zonderFoto) q = q.or('afbeeldingen.is.null,afbeeldingen.eq.{}');

  const { data } = await q;
  type Rij = {
    merk: string | null; sku: string | null; naam: string; categorie: string | null;
    afbeeldingen: string[] | null; product_varianten: { count: number }[] | null;
  };
  const rijen = (data as Rij[]) ?? [];

  const kolommen = ['merk', 'artikelnummer', 'naam', 'categorie', 'aantal varianten', 'foto-URL (in te vullen)'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const regels = [
    kolommen.map(esc).join(';'),
    ...rijen.map((r) =>
      [r.merk, r.sku, r.naam, r.categorie, r.product_varianten?.[0]?.count ?? 0, ''].map(esc).join(';'),
    ),
  ];
  // BOM zodat Excel de accenten goed leest; puntkomma omdat Excel-NL daarop splitst.
  const csv = '﻿' + regels.join('\r\n');
  const naam = zonderFoto ? 'producten-zonder-foto' : 'producten';

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${naam}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
