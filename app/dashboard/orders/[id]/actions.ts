'use server';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { voegOrderregelToe, verwijderOrderregel, zetOrderStatus, zetGoedkeuring } from '@/lib/kms/orders';
import { genereerInkoopregels } from '@/lib/kms/inkoop';

function getalOfNull(raw: string): number | null {
  const s = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  return s === '' ? null : Number(s);
}

export async function voegRegelToe(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const item_naam = String(formData.get('item_naam') ?? '').trim();
  const product_id = String(formData.get('product_id') ?? '').trim() || null;
  const variant_id = String(formData.get('variant_id') ?? '').trim() || null;
  const maat = String(formData.get('maat') ?? '').trim() || null;
  const kleur = String(formData.get('kleur') ?? '').trim() || null;
  const aantal = Math.max(1, Math.round(getalOfNull(String(formData.get('aantal') ?? '1')) ?? 1));
  const stukprijs = getalOfNull(String(formData.get('stukprijs') ?? ''));
  if (orderId && item_naam) {
    await voegOrderregelToe(orderId, { item_naam, product_id, variant_id, maat, kleur, aantal, stukprijs });
  }
  redirect('/dashboard/orders/' + orderId);
}

export async function verwijderRegel(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  if (regelId) await verwijderOrderregel(regelId);
  redirect('/dashboard/orders/' + orderId);
}

export async function wijzigStatus(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (orderId && status) await zetOrderStatus(orderId, status);
  redirect('/dashboard/orders/' + orderId);
}

export async function beslisGoedkeuring(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const status = String(formData.get('goedkeuring') ?? '').trim();
  const doorWie = String(formData.get('door_wie') ?? '').trim() || null;
  if (orderId && status) await zetGoedkeuring(orderId, status, doorWie);
  redirect('/dashboard/orders/' + orderId);
}

export async function maakInkoopregels(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  if (orderId) await genereerInkoopregels(orderId);
  redirect('/dashboard/orders/' + orderId);
}

export async function zetTrackTrace(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = String(formData.get('orderId') ?? '').trim();
  const track_trace_code = String(formData.get('track_trace_code') ?? '').trim() || null;
  const vervoerder = String(formData.get('vervoerder') ?? '').trim() || null;
  const sb = kmsAdmin();
  if (sb && orderId) await sb.from('orders').update({ track_trace_code, vervoerder }).eq('id', orderId);
  redirect('/dashboard/orders/' + orderId);
}
