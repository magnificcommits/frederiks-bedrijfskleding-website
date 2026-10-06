'use server';
import { logPortaal } from '@/lib/portaal/activiteit';
import { redirect } from 'next/navigation';
import { getKledinglijn, verwijderMedewerker, zetMaat } from '@/lib/portaal/queries';
import {
  getMijnToegang,
  maakMedewerkerMetToegang,
  geefToegang,
  wijzigRol,
  trekToegangIn,
  zetBudget,
  type PortaalRol,
} from '@/lib/portaal/team';
import { maakVerzoek } from '@/lib/portaal/verzoeken';

const rollen: PortaalRol[] = ['beheerder', 'leidinggevende', 'medewerker'];
function leesRol(waarde: string): PortaalRol {
  return rollen.includes(waarde as PortaalRol) ? (waarde as PortaalRol) : 'medewerker';
}
function leesBudget(waarde: string): number | null {
  const ruw = waarde.replace(/[^0-9.,]/g, '').replace(',', '.');
  return ruw === '' ? null : Number(ruw);
}

/**
 * Beheerder of leidinggevende mag personen, maten en budget beheren.
 * Geeft de eigen toegang terug zodat acties de organisatie en rol kennen.
 */
async function guardBeheren() {
  const toegang = await getMijnToegang();
  if (!toegang.email) redirect('/portaal/login');
  if ((toegang.rol !== 'beheerder' && toegang.rol !== 'leidinggevende') || !toegang.organisatieId) {
    redirect('/portaal/medewerkers');
  }
  return toegang;
}

/** Alleen een beheerder mag logins en rollen instellen of intrekken. */
async function guardBeheerder() {
  const toegang = await getMijnToegang();
  if (!toegang.email) redirect('/portaal/login');
  if (toegang.rol !== 'beheerder' || !toegang.organisatieId) redirect('/portaal/medewerkers');
  return toegang;
}

/**
 * Dient een verzoek in om een persoon toe te voegen. Beheerders en leidinggevenden
 * voegen niet meer direct toe: het verzoek gaat pas in als Jessi het goedkeurt.
 */
export async function nieuweMedewerker(formData: FormData) {
  const toegang = await guardBeheren();
  const naam = String(formData.get('naam') ?? '').trim();
  const functie = String(formData.get('functie') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const budget = leesBudget(String(formData.get('budget') ?? ''));
  if (!naam) redirect('/portaal/medewerkers?fout=naam');
  await maakVerzoek({
    organisatieId: toegang.organisatieId!,
    type: 'toevoegen',
    naam,
    email,
    functie,
    budget,
    aangevraagdDoor: toegang.email,
  });
  redirect('/portaal/medewerkers?ok=verzoek');
}

/**
 * Dient een verzoek in om een persoon te verwijderen. Verwijderen gaat niet meer
 * direct: het verzoek gaat pas in als Jessi het goedkeurt.
 */
export async function verwijderMedewerkerAction(formData: FormData) {
  const toegang = await guardBeheren();
  const id = String(formData.get('id') ?? '');
  const naam = String(formData.get('naam') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  if (id) {
    await maakVerzoek({
      organisatieId: toegang.organisatieId!,
      type: 'verwijderen',
      medewerkerId: id,
      naam,
      email,
      aangevraagdDoor: toegang.email,
    });
  }
  redirect('/portaal/medewerkers?ok=verzoek');
}

export async function bewaarBudget(formData: FormData) {
  await guardBeheren();
  const id = String(formData.get('medewerker_id') ?? '');
  const budget = leesBudget(String(formData.get('budget') ?? ''));
  const res = id ? await zetBudget(id, budget) : { ok: false };
  if (res.ok) await logPortaal('budget_gewijzigd');
  redirect(res.ok ? '/portaal/medewerkers?ok=budget' : '/portaal/medewerkers?fout=opslaan');
}

export async function bewaarMaten(formData: FormData) {
  await guardBeheren();
  const medewerkerId = String(formData.get('medewerker_id') ?? '');
  if (!medewerkerId) redirect('/portaal/medewerkers');
  const items = await getKledinglijn();
  for (const it of items) {
    const maat = String(formData.get(`maat_${it.id}`) ?? '').trim();
    await zetMaat(medewerkerId, it.id, maat);
  }
  redirect('/portaal/medewerkers?ok=maten');
}

/** Geeft een bestaande persoon (zonder login) toegang met een rol. Alleen beheerder. */
export async function geefToegangAction(formData: FormData) {
  const toegang = await guardBeheerder();
  const medewerkerId = String(formData.get('medewerker_id') ?? '').trim();
  const naam = String(formData.get('naam') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const rol = leesRol(String(formData.get('rol') ?? 'medewerker'));
  if (!medewerkerId || !email) redirect('/portaal/medewerkers?fout=email');
  const res = await geefToegang({ organisatieId: toegang.organisatieId!, medewerkerId, naam, email, rol });
  if (res.ok) await logPortaal('toegang_gegeven', { email, rol });
  redirect(res.ok ? '/portaal/medewerkers?ok=toegang' : '/portaal/medewerkers?fout=opslaan');
}

/** Wijzigt de rol van een bestaande login. Alleen beheerder. */
export async function wijzigRolAction(formData: FormData) {
  await guardBeheerder();
  const email = String(formData.get('email') ?? '').trim();
  const rol = leesRol(String(formData.get('rol') ?? 'medewerker'));
  const res = email ? await wijzigRol(email, rol) : { ok: false };
  if (res.ok) await logPortaal('rol_gewijzigd', { email, rol });
  redirect(res.ok ? '/portaal/medewerkers?ok=rol' : '/portaal/medewerkers?fout=opslaan');
}

/** Trekt de login van een persoon in. Alleen beheerder. */
export async function trekToegangInAction(formData: FormData) {
  await guardBeheerder();
  const email = String(formData.get('email') ?? '').trim();
  const res = email ? await trekToegangIn(email) : { ok: false };
  if (res.ok) await logPortaal('toegang_ingetrokken', { email });
  redirect(res.ok ? '/portaal/medewerkers?ok=ingetrokken' : '/portaal/medewerkers?fout=opslaan');
}
