'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { uploadMediaMetNaam } from '@/lib/kms/storage';
import { logAudit } from '@/lib/kms/audit';
import { maakLogo, verwijderLogo } from '@/lib/kms/logos';

/**
 * Terug naar de bibliotheek van dezelfde klant, met een melding voor Jessi.
 * redirect() gooit, dus na een aanroep loopt er niets meer door.
 */
function terug(orgId: string, ok: string): void {
  redirect(`/dashboard/logos?org=${encodeURIComponent(orgId)}&ok=${ok}`);
}

export async function nieuwLogo(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orgId = String(formData.get('orgId') ?? '').trim();
  const naam = String(formData.get('naam') ?? '').trim();

  // Eerst afkeuren, dan pas uploaden. Andersom staat het bestand al in de bucket
  // terwijl er nooit een rij komt die ernaar verwijst, en zulke wezen ruimt
  // niemand meer op.
  if (!orgId) return redirect('/dashboard/logos?ok=geen_klant');
  if (!naam) return terug(orgId, 'geen_naam');

  // Uploads geven naast de URL ook de originele bestandsnaam terug; die bewaren
  // we, want de opslagnaam in de bucket is gegenereerd en zegt Jessi niets.
  const logoUpload = await uploadMediaMetNaam(formData.get('logo_bestand') as File | null, 'logos');
  const vectorUpload = await uploadMediaMetNaam(formData.get('vectorbestand') as File | null, 'logos');
  const borduurUpload = await uploadMediaMetNaam(formData.get('borduurbestand') as File | null, 'logos');

  const logo_bestand_url = logoUpload?.url ?? (String(formData.get('logo_bestand_url') ?? '').trim() || null);
  const vectorbestand_url = vectorUpload?.url ?? (String(formData.get('vectorbestand_url') ?? '').trim() || null);
  const borduurbestand_url = borduurUpload?.url ?? (String(formData.get('borduurbestand_url') ?? '').trim() || null);
  const opmerkingen = String(formData.get('opmerkingen') ?? '').trim() || null;

  const gelukt = await maakLogo(orgId, {
    naam,
    logo_bestand_url,
    vectorbestand_url,
    borduurbestand_url,
    logo_bestand_naam: logoUpload?.origineleNaam ?? null,
    vectorbestand_naam: vectorUpload?.origineleNaam ?? null,
    borduurbestand_naam: borduurUpload?.origineleNaam ?? null,
    opmerkingen,
  });

  if (gelukt) {
    await logAudit('logo_toegevoegd', { entiteit: 'organisatie', entiteitId: orgId, details: { naam } });
  }
  revalidatePath('/dashboard/logos');
  return terug(orgId, gelukt ? 'toegevoegd' : 'mislukt');
}

export async function verwijderLogoActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orgId = String(formData.get('orgId') ?? '').trim();
  const logoId = String(formData.get('logoId') ?? '').trim();
  if (logoId) {
    await verwijderLogo(logoId);
    await logAudit('logo_verwijderd', { entiteit: 'organisatie', entiteitId: orgId, details: { logoId } });
  }
  revalidatePath('/dashboard/logos');
  return terug(orgId, 'verwijderd');
}
