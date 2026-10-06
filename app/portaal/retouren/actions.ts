'use server';
import { logPortaal } from '@/lib/portaal/activiteit';
import { redirect } from 'next/navigation';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { meldReparatie, meldRetour, type RetourRegel } from '@/lib/portaal/service';
import { uploadMedia } from '@/lib/kms/storage';
import { isOnderdeel } from '@/lib/kms/service';

function leesRegels(raw: FormDataEntryValue | null): RetourRegel[] {
  const tekst = String(raw ?? '').trim();
  if (!tekst) return [];
  try {
    const parsed = JSON.parse(tekst);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r) => {
        const o = (r ?? {}) as Record<string, unknown>;
        const aantal = Number(o.aantal);
        return {
          orderregel_id: String(o.orderregel_id ?? ''),
          item_naam: String(o.item_naam ?? ''),
          maat: o.maat == null ? null : String(o.maat),
          kleur: o.kleur == null ? null : String(o.kleur),
          aantal: Number.isFinite(aantal) && aantal > 0 ? aantal : 1,
        };
      })
      .filter((r) => r.orderregel_id !== '');
  } catch {
    return [];
  }
}

export async function vraagRetour(formData: FormData) {
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const org = await getMijnOrganisatie();
  if (!org) redirect('/portaal');

  const orderId = String(formData.get('order_id') ?? '').trim() || null;
  const toelichting = String(formData.get('reden') ?? '').trim();
  const redenKeuze = String(formData.get('reden_keuze') ?? '').trim().slice(0, 120) || null;
  const reden = toelichting || redenKeuze || '';
  const regels = leesRegels(formData.get('regels'));
  if (!reden) redirect('/portaal/retouren?leeg=1');
  if (!orderId || regels.length === 0) redirect('/portaal/retouren?geenregels=1');

  const soort = formData.get('soort') === 'ruilen' ? 'ruilen' : 'retour';
  const res = await meldRetour({ orderId, reden, redenKeuze, regels, soort });
  if (!res.ok) redirect('/portaal/retouren?fout=1');
  await logPortaal('retour_aangevraagd', { order_id: orderId });
  redirect('/portaal/retouren?ok=1');
}

const FOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const FOTO_MAX = 5 * 1024 * 1024;

export async function vraagReparatie(formData: FormData) {
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const org = await getMijnOrganisatie();
  if (!org) redirect('/portaal');

  const onderdeel = String(formData.get('onderdeel') ?? '');
  const toelichting = String(formData.get('toelichting') ?? '').trim().slice(0, 2000);
  const kledingstuk = String(formData.get('kledingstuk') ?? '').trim();
  const orderId = String(formData.get('order_id') ?? '').trim() || null;
  const orderregelId = String(formData.get('orderregel_id') ?? '').trim() || null;
  const aantal = Number(formData.get('aantal') ?? 1);
  if (!isOnderdeel(onderdeel)) redirect('/portaal/retouren?soort=reparatie&rep=onderdeel');
  if (onderdeel === 'anders' && !toelichting) redirect('/portaal/retouren?soort=reparatie&rep=toelichting');
  if (!orderregelId && !kledingstuk) redirect('/portaal/retouren?soort=reparatie&rep=kledingstuk');

  // Maximaal drie foto's; de browser verkleint ze al, dit is de vangrail.
  const bestanden = formData
    .getAll('fotos')
    .filter((f): f is File => typeof f === 'object' && f !== null && 'size' in f && (f as File).size > 0)
    .slice(0, 3);
  const fotos: string[] = [];
  for (const f of bestanden) {
    if (f.size > FOTO_MAX || (f.type && !FOTO_TYPES.includes(f.type))) continue;
    const url = await uploadMedia(f, 'reparaties');
    if (url) fotos.push(url);
  }

  const res = await meldReparatie({
    orderId,
    orderregelId,
    kledingstuk,
    aantal: Number.isFinite(aantal) ? aantal : 1,
    onderdeel,
    toelichting,
    fotos,
  });
  if (!res.ok) redirect('/portaal/retouren?soort=reparatie&rep=fout');
  await logPortaal('reparatie_aangevraagd');
  redirect('/portaal/retouren?rep=ok');
}
