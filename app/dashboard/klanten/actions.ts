'use server';
import { redirect } from 'next/navigation';
import { maakOrganisatie, addGebruiker } from '@/lib/portaalAdmin';
import { logAudit } from '@/lib/kms/audit';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { maakContactpersoon } from '@/lib/kms/crm';


/** Zelfde toegangsregel als de dashboard-layout: wachtwoord-cookie OF ingelogde admin. */
async function authed() {
  return dashAuthed();
}

export async function nieuweOrganisatie(formData: FormData) {
  if (!(await authed())) redirect('/dashboard');
  const naam = String(formData.get('naam') ?? '').trim();
  const plaats = String(formData.get('plaats') ?? '').trim();
  const adres = String(formData.get('adres') ?? '').trim();
  const postcode = String(formData.get('postcode') ?? '').trim();
  const telefoon = String(formData.get('telefoon') ?? '').trim();
  const contactpersoon = String(formData.get('contactpersoon') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const branche = String(formData.get('branche') ?? '').trim();
  if (!naam) redirect('/dashboard/klanten');
  const id = await maakOrganisatie({ naam, plaats, adres, postcode, telefoon });
  // Branche en contactpersoon (voor de kolom in de klantenlijst) alleen meesturen als ze zijn ingevuld.
  const extra: Record<string, string> = {};
  if (branche) extra.branche = branche;
  if (contactpersoon) extra.contactpersoon = contactpersoon;
  if (id && Object.keys(extra).length > 0) {
    const sb = kmsAdmin();
    if (sb) await sb.from('organisaties').update(extra).eq('id', id);
  }
  if (id && email) await addGebruiker(id, email, contactpersoon);
  // De contactpersoon ook echt als contactpersoon vastleggen (hoofdcontact), zodat
  // hij op het tabblad Contact staat en niet alleen als portaal-inlog.
  if (id && contactpersoon) {
    await maakContactpersoon(id, { naam: contactpersoon, email: email || null, hoofdcontact: true });
  }
  if (id) await logAudit('klant_aangemaakt', { entiteit: 'organisatie', entiteitId: id, details: { naam, branche: branche || null } });
  redirect(id ? '/dashboard/klanten/' + id : '/dashboard/klanten');
}
