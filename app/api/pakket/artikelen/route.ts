import { NextResponse } from 'next/server';
import { artikelenVoorType } from '@/lib/kms/publiekeCatalogus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Artikelsuggesties voor de pakketsamensteller op de publieke site.
 *
 * Openbaar, en dat mag: er gaat alleen naam, merk, foto en een vanaf-prijs uit —
 * precies wat elders op de site ook staat. Inkoopprijzen, kortingen en voorraad
 * blijven hier expliciet buiten.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const type = (sp.get('type') ?? '').trim();
  const kleur = (sp.get('kleur') ?? '').trim() || undefined;
  if (!type) return NextResponse.json({ artikelen: [] });
  const artikelen = await artikelenVoorType(type, kleur);
  return NextResponse.json(
    { artikelen },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=3600' } },
  );
}
