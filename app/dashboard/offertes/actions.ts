'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { maakOfferte, zetOfferteStatus, listContactenVoorOfferte, bepaalOfferteContact, type OfferteContact } from '@/lib/kms/offertes';
import { maakContactpersoon } from '@/lib/kms/crm';
import { logAudit } from '@/lib/kms/audit';

export async function maakOfferteActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const organisatie_id = String(formData.get('organisatie_id') ?? '').trim();
  const contactId = String(formData.get('contactpersoon_id') ?? '').trim();
  const losseNaam = String(formData.get('contactpersoon') ?? '').trim();
  const geldig_tot = String(formData.get('geldig_tot') ?? '').trim();
  const notitie = String(formData.get('notitie') ?? '').trim();
  const contact = await bepaalOfferteContact(organisatie_id || null, contactId || null, losseNaam || null);
  const id = await maakOfferte({
    organisatie_id: organisatie_id || null,
    ...contact,
    geldig_tot: geldig_tot || null,
    notitie: notitie || null,
  });
  if (id) {
    await logAudit('offerte_aangemaakt', { entiteit: 'offertes', entiteitId: id, details: { organisatie_id: organisatie_id || null } });
    redirect('/dashboard/offertes/' + id + '?ok=aangemaakt');
  }
  redirect('/dashboard/offertes/nieuw?fout=aanmaken');
}

/**
 * Contactpersonen van een klant, voor de kiezer op het offerteformulier.
 * Wordt vanuit de browser aangeroepen zodra er een klant gekozen is.
 */
export async function haalContactenActie(organisatieId: string): Promise<OfferteContact[]> {
  if (!(await dashAuthed())) return [];
  const id = String(organisatieId ?? '').trim();
  if (!id) return [];
  return listContactenVoorOfferte(id);
}

export type NieuwContactUitkomst = { ok: true; contact: OfferteContact } | { ok: false; fout: string };

/**
 * Nieuwe contactpersoon bij een klant, vanuit de kiezer op de offerte. Maakt direct
 * een rij in contactpersonen aan, zodat de persoon daarna overal te vinden is
 * (klantkaart, zoeken, volgende offerte). De kiezer selecteert hem meteen.
 */
export async function maakContactVoorOfferteActie(
  organisatieId: string,
  velden: { naam: string; email?: string; functie?: string; telefoon?: string },
): Promise<NieuwContactUitkomst> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Je bent niet meer ingelogd. Log opnieuw in en probeer het nog een keer.' };
  const orgId = String(organisatieId ?? '').trim();
  const naam = String(velden?.naam ?? '').trim();
  const email = String(velden?.email ?? '').trim();
  const functie = String(velden?.functie ?? '').trim();
  const telefoon = String(velden?.telefoon ?? '').trim();
  if (!orgId) return { ok: false, fout: 'Kies eerst een klant.' };
  if (!naam) return { ok: false, fout: 'Vul een naam in.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, fout: 'Dit e-mailadres klopt niet helemaal.' };

  const id = await maakContactpersoon(orgId, {
    naam,
    email: email || null,
    functie: functie || null,
    telefoon: telefoon || null,
  });
  if (!id) return { ok: false, fout: 'Opslaan is niet gelukt. Probeer het nog een keer.' };
  await logAudit('contactpersoon_toegevoegd', {
    entiteit: 'contactpersoon',
    entiteitId: id,
    details: { organisatie_id: orgId, naam, via: 'offerte' },
  });
  revalidatePath(`/dashboard/klanten/${orgId}`);
  return {
    ok: true,
    contact: { id, naam, functie: functie || null, email: email || null, telefoon: telefoon || null, hoofdcontact: false },
  };
}

/** Bulk-statuswijziging voor alle aangevinkte offertes in een keer. */
export async function bulkOfferteStatusActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const ids = formData.getAll('offerte_ids').map((v) => String(v).trim()).filter(Boolean);
  const status = String(formData.get('bulk_status') ?? '').trim();
  const terug = String(formData.get('terug') ?? '').trim() || '/dashboard/offertes';
  if (ids.length && status) {
    for (const id of ids) await zetOfferteStatus(id, status);
  }
  revalidatePath('/dashboard/offertes');
  redirect(`${terug}${terug.includes('?') ? '&' : '?'}ok=status`);
}
