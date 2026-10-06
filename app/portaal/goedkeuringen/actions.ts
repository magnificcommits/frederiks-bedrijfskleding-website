'use server';
import { logPortaal } from '@/lib/portaal/activiteit';
import { redirect } from 'next/navigation';
import { getMijnToegang } from '@/lib/portaal/team';
import { beslisOverOrder } from '@/lib/portaal/goedkeuringen';

/** Alleen beheerder en leidinggevende mogen beslissen over bestellingen. */
async function guardGoedkeurder() {
  const toegang = await getMijnToegang();
  if (!toegang.email) redirect('/portaal/login');
  if (toegang.rol !== 'beheerder' && toegang.rol !== 'leidinggevende') redirect('/portaal');
  return toegang;
}

export async function keurGoed(formData: FormData) {
  const toegang = await guardGoedkeurder();
  const orderId = String(formData.get('order_id') ?? '').trim();
  const door = toegang.email ?? 'onbekend';
  const res = orderId ? await beslisOverOrder(orderId, 'goedgekeurd', door) : { ok: false };
  if (res.ok) await logPortaal('order_goedgekeurd', { order_id: orderId });
  redirect(res.ok ? '/portaal/goedkeuringen?ok=goedgekeurd' : '/portaal/goedkeuringen?fout=opslaan');
}

export async function wijsAf(formData: FormData) {
  const toegang = await guardGoedkeurder();
  const orderId = String(formData.get('order_id') ?? '').trim();
  const door = toegang.email ?? 'onbekend';
  const res = orderId ? await beslisOverOrder(orderId, 'afgewezen', door) : { ok: false };
  if (res.ok) await logPortaal('order_afgewezen', { order_id: orderId });
  redirect(res.ok ? '/portaal/goedkeuringen?ok=afgewezen' : '/portaal/goedkeuringen?fout=opslaan');
}
