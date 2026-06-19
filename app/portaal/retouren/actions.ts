'use server';
import { redirect } from 'next/navigation';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { meldRetour, type RetourRegel } from '@/lib/portaal/service';

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
  const reden = String(formData.get('reden') ?? '').trim();
  const regels = leesRegels(formData.get('regels'));
  if (!reden) redirect('/portaal/retouren?leeg=1');
  if (!orderId || regels.length === 0) redirect('/portaal/retouren?geenregels=1');

  const res = await meldRetour({ orderId, reden, regels });
  if (!res.ok) redirect('/portaal/retouren?fout=1');
  redirect('/portaal/retouren?ok=1');
}
