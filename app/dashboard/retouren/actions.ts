'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import {
  isOnderdeel,
  isReparatieStatus,
  isUuid,
  maakCreditfactuur,
  maakReparatieFactuur,
  maakRetour,
  maakRetourTaak,
  maakVervangendeOrder,
  mailRetourBeslissing,
  zetRetourBeslissing,
  zetRetourStatus,
  zetReparatieKosten,
  zetReparatieStatus,
  RETOUR_BESLISSINGEN,
  RETOUR_STATUSSEN,
  type RetourBeslissing,
} from '@/lib/kms/service';

function tekstOfNull(raw: FormDataEntryValue | null): string | null {
  const s = String(raw ?? '').trim();
  return s === '' ? null : s;
}

/** Terug naar de lijst met dezelfde filters en het open paneel; alleen paden binnen Retouren. */
function terugUrl(formData: FormData, extra: Record<string, string>): string {
  const ruw = String(formData.get('terug') ?? '');
  const basis = ruw.startsWith('/dashboard/retouren') ? ruw : '/dashboard/retouren';
  const [pad, qs = ''] = basis.split('?');
  const p = new URLSearchParams(qs);
  for (const k of ['melding', 'ok', 'fout', 'nieuw']) p.delete(k);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return s ? `${pad}?${s}` : pad;
}

export async function nieuwRetour(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const organisatie_id = tekstOfNull(formData.get('organisatie_id'));
  if (!isUuid(organisatie_id)) redirect('/dashboard/retouren?melding=klant-nodig');
  const soortRuw = String(formData.get('soort') ?? 'retour');
  const soort = soortRuw === 'reparatie' || soortRuw === 'ruilen' ? soortRuw : 'retour';
  const onderdeelRuw = String(formData.get('onderdeel') ?? '');
  const onderdeel = isOnderdeel(onderdeelRuw) ? onderdeelRuw : null;
  const keuze = soort === 'reparatie' ? null : tekstOfNull(formData.get('reden_keuze'));
  const toelichting = tekstOfNull(formData.get('reden'));
  const ok = await maakRetour({
    organisatie_id,
    order_id: tekstOfNull(formData.get('order_id')),
    reden: [keuze ? `${keuze}.` : null, toelichting].filter(Boolean).join(' ') || null,
    soort,
    reparatie_onderdeel: onderdeel,
    kledingstuk: tekstOfNull(formData.get('kledingstuk')),
  });
  if (ok) await logAudit('retour_aangemaakt', { entiteit: 'retour', details: { organisatie_id, soort } });
  redirect(`/dashboard/retouren?melding=${ok ? 'aangemaakt' : 'mislukt'}`);
}

export async function wijzigRetourStatus(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('retourId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (isUuid(id) && (RETOUR_STATUSSEN as readonly string[]).includes(status)) {
    await zetRetourStatus(id, status);
    await logAudit('retourstatus_gewijzigd', { entiteit: 'retour', entiteitId: id, details: { status } });
  }
  redirect(terugUrl(formData, { melding: 'status' }));
}

export async function retourBeslissing(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('retourId') ?? '').trim();
  const ruw = String(formData.get('beslissing') ?? '');
  if (!isUuid(id) || !(RETOUR_BESLISSINGEN as readonly string[]).includes(ruw)) redirect(terugUrl(formData, { melding: 'kies' }));
  const beslissing = ruw as RetourBeslissing;
  const res = await zetRetourBeslissing(id, beslissing, {
    notitie: tekstOfNull(formData.get('notitie')),
    retouradres: tekstOfNull(formData.get('retouradres')),
    instructie: tekstOfNull(formData.get('instructie')),
  });
  if (!res.ok) redirect(terugUrl(formData, { melding: 'mislukt' }));
  await logAudit('retour_beslissing', { entiteit: 'retour', entiteitId: id, details: { beslissing } });

  let melding = res.zonderMigratie ? 'beslissing-migratie' : 'beslissing';
  if (formData.get('mailen') === 'on') {
    const mail = await mailRetourBeslissing(id);
    melding = mail.sent ? 'beslissing-gemaild' : 'beslissing-niet-gemaild';
  }
  redirect(terugUrl(formData, { melding }));
}

export async function retourVervangendeOrder(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('retourId') ?? '').trim();
  if (!isUuid(id)) redirect(terugUrl(formData, {}));
  const res = await maakVervangendeOrder(id);
  if ('fout' in res) redirect(terugUrl(formData, { melding: 'order-mislukt' }));
  await logAudit('retour_vervangende_order', { entiteit: 'retour', entiteitId: id, details: { order_id: res.orderId } });
  redirect(terugUrl(formData, { melding: 'order', nieuw: res.orderId }));
}

export async function retourCreditfactuur(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('retourId') ?? '').trim();
  if (!isUuid(id)) redirect(terugUrl(formData, {}));
  const res = await maakCreditfactuur(id);
  if ('fout' in res) redirect(terugUrl(formData, { melding: 'credit-mislukt' }));
  await logAudit('retour_creditfactuur', { entiteit: 'retour', entiteitId: id, details: { factuur_id: res.factuurId } });
  redirect(terugUrl(formData, { melding: 'credit', nieuw: res.factuurId }));
}

export async function retourTaak(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('retourId') ?? '').trim();
  if (!isUuid(id)) redirect(terugUrl(formData, {}));
  const persoon = tekstOfNull(formData.get('persoon_id'));
  const res = await maakRetourTaak(id, isUuid(persoon) ? persoon : null);
  if ('fout' in res) redirect(terugUrl(formData, { melding: 'taak-mislukt' }));
  await logAudit('retour_taak', { entiteit: 'retour', entiteitId: id, details: { taak_id: res.taakId } });
  redirect(terugUrl(formData, { melding: 'taak' }));
}

export async function reparatieStap(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('retourId') ?? '').trim();
  const stap = String(formData.get('stap') ?? '').trim();
  if (!isUuid(id) || !isReparatieStatus(stap)) redirect(terugUrl(formData, { melding: 'mislukt' }));
  const ok = await zetReparatieStatus(id, stap);
  if (ok) await logAudit('reparatie_status', { entiteit: 'retour', entiteitId: id, details: { reparatie_status: stap } });
  redirect(terugUrl(formData, { melding: ok ? 'reparatie-stap' : 'mislukt' }));
}

export async function reparatieKosten(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('retourId') ?? '').trim();
  if (!isUuid(id)) redirect(terugUrl(formData, {}));
  const ruw = String(formData.get('kosten') ?? '').trim().replace(',', '.');
  const kosten = ruw === '' ? null : Number(ruw);
  if (kosten != null && (!Number.isFinite(kosten) || kosten < 0)) redirect(terugUrl(formData, { melding: 'kosten-ongeldig' }));
  const ok = await zetReparatieKosten(id, kosten);
  if (ok) await logAudit('reparatie_kosten', { entiteit: 'retour', entiteitId: id, details: { reparatie_kosten: kosten } });
  redirect(terugUrl(formData, { melding: ok ? 'kosten' : 'mislukt' }));
}

export async function reparatieFactuur(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('retourId') ?? '').trim();
  if (!isUuid(id)) redirect(terugUrl(formData, {}));
  const res = await maakReparatieFactuur(id);
  if ('fout' in res) redirect(terugUrl(formData, { melding: 'reparatie-factuur-mislukt' }));
  await logAudit('reparatie_factuur', { entiteit: 'retour', entiteitId: id, details: { factuur_id: res.factuurId } });
  redirect(terugUrl(formData, { melding: 'reparatie-factuur', nieuw: res.factuurId }));
}
