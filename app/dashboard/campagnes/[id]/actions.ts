'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import {
  zetCampagneStatus,
  voegStapToe,
  werkStap,
  verwijderStap,
  schrijfProspectenIn,
} from '@/lib/kms/campagnes';
import { logAudit } from '@/lib/kms/audit';

function getalOfNul(raw: string): number {
  const s = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  return s === '' ? 0 : Number(s);
}

export async function wijzigCampagneStatusActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('campagneId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (id && status) {
    await zetCampagneStatus(id, status);
    await logAudit('campagne_status_gewijzigd', { entiteit: 'campagnes', entiteitId: id, details: { status } });
  }
  redirect('/dashboard/campagnes/' + id + '?ok=status');
}

export async function voegStapActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const campagneId = String(formData.get('campagneId') ?? '').trim();
  const onderwerp = String(formData.get('onderwerp') ?? '').trim();
  const body = String(formData.get('body') ?? '');
  const volgorde = getalOfNul(String(formData.get('volgorde') ?? '1')) || 1;
  const wacht_dagen = getalOfNul(String(formData.get('wacht_dagen') ?? '0'));
  const ai_personaliseer = formData.get('ai_personaliseer') === 'on';
  if (campagneId && onderwerp && body.trim()) {
    await voegStapToe(campagneId, { volgorde, wacht_dagen, onderwerp, body, ai_personaliseer });
    await logAudit('campagnestap_toegevoegd', { entiteit: 'campagnes', entiteitId: campagneId });
  }
  redirect('/dashboard/campagnes/' + campagneId);
}

export async function werkStapActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const campagneId = String(formData.get('campagneId') ?? '').trim();
  const stapId = String(formData.get('stapId') ?? '').trim();
  const onderwerp = String(formData.get('onderwerp') ?? '').trim();
  const body = String(formData.get('body') ?? '');
  const volgorde = getalOfNul(String(formData.get('volgorde') ?? '1')) || 1;
  const wacht_dagen = getalOfNul(String(formData.get('wacht_dagen') ?? '0'));
  const ai_personaliseer = formData.get('ai_personaliseer') === 'on';
  if (stapId && onderwerp && body.trim()) {
    await werkStap(stapId, { volgorde, wacht_dagen, onderwerp, body, ai_personaliseer });
    await logAudit('campagnestap_gewijzigd', { entiteit: 'campagnes', entiteitId: campagneId });
  }
  redirect('/dashboard/campagnes/' + campagneId);
}

export async function verwijderStapActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const campagneId = String(formData.get('campagneId') ?? '').trim();
  const stapId = String(formData.get('stapId') ?? '').trim();
  if (stapId) {
    await verwijderStap(stapId);
    await logAudit('campagnestap_verwijderd', { entiteit: 'campagnes', entiteitId: campagneId });
  }
  redirect('/dashboard/campagnes/' + campagneId);
}

export async function schrijfInActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const campagneId = String(formData.get('campagneId') ?? '').trim();
  const prospectStatus = String(formData.get('prospectStatus') ?? '').trim();
  if (!campagneId) redirect('/dashboard/campagnes');
  const aantal = await schrijfProspectenIn(campagneId, prospectStatus || undefined);
  await logAudit('campagne_prospecten_ingeschreven', { entiteit: 'campagnes', entiteitId: campagneId, details: { aantal, prospectStatus: prospectStatus || 'alle' } });
  redirect('/dashboard/campagnes/' + campagneId + '?ok=ingeschreven&aantal=' + aantal);
}
