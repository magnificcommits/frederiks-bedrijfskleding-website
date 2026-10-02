'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { listWerknemers, werknemerVanContact } from '@/lib/kms/werknemers';
import { listContactpersonen } from '@/lib/kms/crm';

export type KlantPersonen = {
  werknemers: { id: string; naam: string; afdeling_id: string | null; vestiging_id: string | null }[];
  afdelingen: { id: string; naam: string }[];
  vestigingen: { id: string; naam: string }[];
  contactpersonen: { id: string; naam: string; email: string | null }[];
};

/**
 * Werknemers, afdelingen, vestigingen en contactpersonen van één klant, op het
 * moment dat Jessi de klant kiest. Zo is de lijst altijd compleet en actueel,
 * ook bij klanten met veel werknemers.
 */
export async function haalKlantPersonenActie(orgId: string): Promise<KlantPersonen> {
  if (!(await dashAuthed())) redirect('/dashboard');
  const leeg: KlantPersonen = { werknemers: [], afdelingen: [], vestigingen: [], contactpersonen: [] };
  const id = String(orgId ?? '').trim();
  const sb = kmsAdmin();
  if (!id || !sb) return leeg;

  const [werknemers, contactpersonen, afdRes, vestRes] = await Promise.all([
    listWerknemers(id),
    listContactpersonen(id),
    sb.from('afdelingen').select('id, naam').eq('organisatie_id', id).order('naam'),
    sb.from('vestigingen').select('id, naam').eq('organisatie_id', id).order('naam'),
  ]);

  return {
    werknemers: werknemers
      .filter((w) => w.actief)
      .map((w) => ({ id: w.id, naam: w.naam, afdeling_id: w.afdeling_id, vestiging_id: w.vestiging_id })),
    afdelingen: ((afdRes.data as { id: string; naam: string | null }[]) ?? []).map((a) => ({
      id: a.id,
      naam: a.naam ?? 'Zonder naam',
    })),
    vestigingen: ((vestRes.data as { id: string; naam: string | null }[]) ?? []).map((v) => ({
      id: v.id,
      naam: v.naam ?? 'Zonder naam',
    })),
    contactpersonen: contactpersonen.map((c) => ({ id: c.id, naam: c.naam, email: c.email })),
  };
}

/**
 * Een contactpersoon kiezen als werknemer voor de order: er wordt een werknemer
 * aangemaakt met dezelfde naam, e-mail en telefoon (of de bestaande gebruikt als
 * die er al is).
 */
export async function contactAlsWerknemerActie(invoer: {
  orgId: string;
  contactId: string;
}): Promise<{ ok: boolean; id?: string; naam?: string; melding: string }> {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orgId = String(invoer.orgId ?? '').trim();
  const contactId = String(invoer.contactId ?? '').trim();
  if (!orgId || !contactId) return { ok: false, melding: 'Geen contactpersoon gekozen.' };

  const uitkomst = await werknemerVanContact(contactId);
  if (!uitkomst || uitkomst.organisatie_id !== orgId) {
    return { ok: false, melding: 'De werknemer kon niet worden aangemaakt. Probeer het opnieuw.' };
  }
  if (!uitkomst.bestond) {
    await logAudit('werknemer_aangemaakt', {
      entiteit: 'medewerker',
      entiteitId: uitkomst.id,
      details: { organisatie_id: orgId, naam: uitkomst.naam, uit_contactpersoon: contactId, via: 'nieuwe order' },
    });
  }
  revalidatePath('/dashboard/klanten/' + orgId);
  return {
    ok: true,
    id: uitkomst.id,
    naam: uitkomst.naam,
    melding: uitkomst.bestond
      ? `${uitkomst.naam} stond al als werknemer bij deze klant en is gekozen.`
      : `${uitkomst.naam} is als werknemer aangemaakt en gekozen.`,
  };
}
