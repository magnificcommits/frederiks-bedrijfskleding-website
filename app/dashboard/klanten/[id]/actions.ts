'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { addGebruiker, maakItem, zetItemActief, zetBestellingStatus } from '@/lib/portaalAdmin';

const DASH_COOKIE = 'fb_dash';

async function authed() {
  return Boolean(env.dashboardPassword) && (await cookies()).get(DASH_COOKIE)?.value === env.dashboardPassword.trim();
}

export async function koppelGebruiker(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const email = String(formData.get('email') ?? '').trim();
  const naam = String(formData.get('naam') ?? '').trim();
  if (id && email) await addGebruiker(id, email, naam);
  redirect('/dashboard/klanten/' + id);
}

export async function voegItemToe(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const naam = String(formData.get('naam') ?? '').trim();
  const merk = String(formData.get('merk') ?? '').trim() || null;
  const kleur = String(formData.get('kleur') ?? '').trim() || null;
  const logopositie = String(formData.get('logopositie') ?? '').trim() || null;
  const techniek = String(formData.get('techniek') ?? '').trim() || null;
  const ruw = String(formData.get('richtprijs') ?? '').replace(/[^0-9.,]/g, '').replace(',', '.');
  const richtprijs = ruw === '' ? null : Number(ruw);
  if (id && naam) await maakItem(id, { naam, merk, kleur, logopositie, techniek, richtprijs });
  redirect('/dashboard/klanten/' + id);
}

export async function wisselItemActief(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const itemId = String(formData.get('itemId') ?? '');
  const actief = String(formData.get('actief') ?? '') === 'true';
  if (itemId) await zetItemActief(itemId, actief);
  redirect('/dashboard/klanten/' + id);
}

export async function zetStatus(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const bestelId = String(formData.get('bestelId') ?? '');
  const status = String(formData.get('status') ?? '').trim();
  if (bestelId && status) await zetBestellingStatus(bestelId, status);
  redirect('/dashboard/klanten/' + id);
}
