'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { maakContactpersoon } from '@/lib/kms/crm';
import { maakWerknemer } from '@/lib/kms/werknemers';
import { internePersonen, personenVanKlant } from '@/lib/kms/personen';
import { lijktOpEmail, normaleNaam, type PersoonOptie, type PersoonSoort } from '@/lib/personen';

/**
 * Serveracties achter de PersoonKiezer. Los van een pagina, zodat elk formulier
 * in het dashboard dezelfde kiezer kan gebruiken.
 */

/** Contactpersonen en/of werknemers van één klant. */
export async function haalKlantPersonenOptiesActie(orgId: string, soorten?: PersoonSoort[]): Promise<PersoonOptie[]> {
  if (!(await dashAuthed())) redirect('/dashboard');
  const toegestaan = (soorten ?? ['contact', 'medewerker']).filter((s) => s === 'contact' || s === 'medewerker');
  return personenVanKlant(String(orgId ?? ''), toegestaan);
}

/** Collega's van Frederiks. */
export async function haalInternePersonenActie(): Promise<PersoonOptie[]> {
  if (!(await dashAuthed())) redirect('/dashboard');
  return internePersonen();
}

export type NieuwePersoonUitkomst = { ok: true; persoon: PersoonOptie; bestond: boolean } | { ok: false; melding: string };

/**
 * Een nieuwe contactpersoon of werknemer aanmaken bij een klant, vanuit een
 * keuzeveld. Staat er al iemand met precies dezelfde naam (of hetzelfde
 * e-mailadres), dan wordt die gekozen in plaats van een dubbele aan te maken.
 */
export async function maakPersoonActie(invoer: {
  orgId: string;
  soort: 'contact' | 'medewerker';
  naam: string;
  email?: string | null;
  functie?: string | null;
}): Promise<NieuwePersoonUitkomst> {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orgId = String(invoer.orgId ?? '').trim();
  const naam = String(invoer.naam ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const emailRuw = String(invoer.email ?? '').trim().toLowerCase();
  const functie = String(invoer.functie ?? '').trim().slice(0, 120) || null;
  const soort = invoer.soort === 'medewerker' ? 'medewerker' : 'contact';

  if (!orgId) return { ok: false, melding: 'Kies eerst een klant.' };
  if (!naam) return { ok: false, melding: 'Vul een naam in.' };
  if (emailRuw && !lijktOpEmail(emailRuw)) return { ok: false, melding: 'Dat e-mailadres klopt niet.' };
  const email = emailRuw || null;

  const sb = kmsAdmin();
  if (!sb) return { ok: false, melding: 'De database is niet bereikbaar.' };
  const { data: org } = await sb.from('organisaties').select('id').eq('id', orgId).maybeSingle();
  if (!org) return { ok: false, melding: 'Deze klant bestaat niet (meer).' };

  // Dubbele voorkomen: dezelfde naam of hetzelfde e-mailadres bij deze klant.
  const bestaande = await personenVanKlant(orgId, [soort]);
  const zelfde = bestaande.find(
    (p) => normaleNaam(p.naam) === normaleNaam(naam) || (email && normaleNaam(p.email) === email),
  );
  if (zelfde) return { ok: true, persoon: zelfde, bestond: true };

  const id =
    soort === 'contact'
      ? await maakContactpersoon(orgId, { naam, email, functie })
      : await maakWerknemer(orgId, { naam, email });
  if (!id) return { ok: false, melding: 'Aanmaken is niet gelukt. Probeer het opnieuw.' };

  await logAudit(soort === 'contact' ? 'contactpersoon_toegevoegd' : 'werknemer_aangemaakt', {
    entiteit: soort === 'contact' ? 'contactpersoon' : 'medewerker',
    entiteitId: id,
    details: { organisatie_id: orgId, naam, via: 'persoonkiezer' },
  });
  revalidatePath(`/dashboard/klanten/${orgId}`);
  return { ok: true, bestond: false, persoon: { id, soort, naam, email, functie: soort === 'contact' ? functie : null } };
}
