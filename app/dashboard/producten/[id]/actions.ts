'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { uploadMedia } from '@/lib/kms/storage';
import { getProduct, werkProduct as werkProductDb, zetProductActief, maakVariant, werkVariant as werkVariantDb, verwijderVariant as verwijderVariantDb } from '@/lib/kms/producten';
import { zetKleurAfbeelding, verwijderKleurAfbeelding } from '@/lib/kms/afbeeldingen';

function getalOfNull(raw: string): number | null {
  const s = String(raw ?? '').replace(/[^0-9.,-]/g, '').replace(',', '.');
  return s === '' ? null : Number(s);
}
function getalOf0(raw: string): number {
  const n = getalOfNull(raw);
  return n == null ? 0 : n;
}

export async function werkProduct(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  const naam = String(formData.get('naam') ?? '').trim();
  if (!id || !naam) redirect('/dashboard/producten');
  const afbeeldingen = formData.getAll('afbeelding').map((a) => String(a).trim()).filter(Boolean);
  const geupload = await uploadMedia(formData.get('afbeelding_bestand') as File | null, 'producten');
  if (geupload) afbeeldingen.push(geupload);
  await werkProductDb(id, {
    naam,
    omschrijving: String(formData.get('omschrijving') ?? '').trim() || null,
    sku: String(formData.get('sku') ?? '').trim() || null,
    ean: String(formData.get('ean') ?? '').trim() || null,
    art_nr_leverancier: String(formData.get('art_nr_leverancier') ?? '').trim() || null,
    merk: String(formData.get('merk') ?? '').trim() || null,
    categorie: String(formData.get('categorie') ?? '').trim() || null,
    subcategorie: String(formData.get('subcategorie') ?? '').trim() || null,
    geslacht: String(formData.get('geslacht') ?? '').trim() || null,
    materiaal: String(formData.get('materiaal') ?? '').trim() || null,
    normeringen: String(formData.get('normeringen') ?? '').trim() || null,
    btw: getalOfNull(String(formData.get('btw') ?? '')) ?? 21,
    min_voorraad: (() => {
      const n = getalOfNull(String(formData.get('min_voorraad') ?? ''));
      return n == null ? null : Math.trunc(n);
    })(),
    wasinstructies: String(formData.get('wasinstructies') ?? '').trim() || null,
    leverancier_id: String(formData.get('leverancier_id') ?? '').trim() || null,
    afbeeldingen,
  });
  redirect('/dashboard/producten/' + id);
}

export async function verwijderAfbeelding(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  const url = String(formData.get('url') ?? '').trim();
  if (!id || !url) redirect('/dashboard/producten/' + id);
  const product = await getProduct(id);
  if (product) {
    const afbeeldingen = (product.afbeeldingen ?? []).filter((a) => a !== url);
    await werkProductDb(id, { naam: product.naam, afbeeldingen });
  }
  redirect('/dashboard/producten/' + id);
}

export async function schakelActief(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  const actief = String(formData.get('actief') ?? '') === 'true';
  if (id) await zetProductActief(id, actief);
  redirect('/dashboard/producten/' + id);
}

export async function voegVariantToe(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  if (!id) redirect('/dashboard/producten');
  await maakVariant(id, {
    maat: String(formData.get('maat') ?? '').trim() || null,
    kleur: String(formData.get('kleur') ?? '').trim() || null,
    ean: String(formData.get('ean') ?? '').trim() || null,
    inkoopprijs: getalOfNull(String(formData.get('inkoopprijs') ?? '')),
    verkoopprijs: getalOfNull(String(formData.get('verkoopprijs') ?? '')),
    meerprijs: getalOf0(String(formData.get('meerprijs') ?? '')),
    voorraad: Math.trunc(getalOf0(String(formData.get('voorraad') ?? ''))),
  });
  redirect('/dashboard/producten/' + id);
}

export async function werkVariant(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  const variantId = String(formData.get('variantId') ?? '');
  if (!variantId) redirect('/dashboard/producten/' + id);
  await werkVariantDb(variantId, {
    maat: String(formData.get('maat') ?? '').trim() || null,
    kleur: String(formData.get('kleur') ?? '').trim() || null,
    inkoopprijs: getalOfNull(String(formData.get('inkoopprijs') ?? '')),
    verkoopprijs: getalOfNull(String(formData.get('verkoopprijs') ?? '')),
    meerprijs: getalOf0(String(formData.get('meerprijs') ?? '')),
    voorraad: Math.trunc(getalOf0(String(formData.get('voorraad') ?? ''))),
  });
  redirect('/dashboard/producten/' + id);
}

export async function verwijderVariant(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  const variantId = String(formData.get('variantId') ?? '');
  if (variantId) await verwijderVariantDb(variantId);
  redirect('/dashboard/producten/' + id);
}

export async function zetKleurAfbeeldingActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  const kleur = String(formData.get('kleur') ?? '').trim();
  if (!id || !kleur) redirect('/dashboard/producten/' + id);
  let url = String(formData.get('afbeelding_url') ?? '').trim();
  const geupload = await uploadMedia(formData.get('afbeelding_bestand') as File | null, 'producten');
  if (geupload) url = geupload;
  if (url) await zetKleurAfbeelding(id, kleur, url);
  redirect('/dashboard/producten/' + id);
}

export async function verwijderKleurAfbeeldingActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  const kleur = String(formData.get('kleur') ?? '').trim();
  if (id && kleur) await verwijderKleurAfbeelding(id, kleur);
  redirect('/dashboard/producten/' + id);
}
