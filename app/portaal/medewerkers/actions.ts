'use server';
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
 * Voegt een persoon toe. Met e-mail + rol wordt meteen een login aangemaakt;
 * dat mag alleen een beheerder. Zonder e-mail wordt alleen de persoon vastgelegd
 * (ook een leidinggevende mag dat).
 */
export async function nieuweMedewerker(formData: FormData) {
  const toegang = await guardBeheren();
  const naam = String(formData.get('naam') ?? '').trim();
  const functie = String(formData.get('functie') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const rol = leesRol(String(formData.get('rol') ?? 'medewerker'));
  const budget = leesBudget(String(formData.get('budget') ?? ''));
  if (!naam) redirect('/portaal/medewerkers?fout=naam');
  // Een leidinggevende mag geen login meegeven: negeer de e-mail in dat geval.
  const mailVoorLogin = toegang.rol === 'beheerder' ? email : '';
  const res = await maakMedewerkerMetToegang({
    organisatieId: toegang.organisatieId!,
    naam,
    email: mailVoorLogin,
    functie,
    rol,
    budget,
  });
  redirect(res.ok ? '/portaal/medewerkers?ok=toegevoegd' : '/portaal/medewerkers?fout=opslaan');
}

export async function verwijderMedewerkerAction(formData: FormData) {
  await guardBeheren();
  const id = String(formData.get('id') ?? '');
  if (id) await verwijderMedewerker(id);
  redirect('/portaal/medewerkers?ok=verwijderd');
}

export async function bewaarBudget(formData: FormData) {
  await guardBeheren();
  const id = String(formData.get('medewerker_id') ?? '');
  const budget = leesBudget(String(formData.get('budget') ?? ''));
  if (id) await zetBudget(id, budget);
  redirect('/portaal/medewerkers?ok=budget');
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
  redirect(res.ok ? '/portaal/medewerkers?ok=toegang' : '/portaal/medewerkers?fout=opslaan');
}

/** Wijzigt de rol van een bestaande login. Alleen beheerder. */
export async function wijzigRolAction(formData: FormData) {
  await guardBeheerder();
  const email = String(formData.get('email') ?? '').trim();
  const rol = leesRol(String(formData.get('rol') ?? 'medewerker'));
  if (email) await wijzigRol(email, rol);
  redirect('/portaal/medewerkers?ok=rol');
}

/** Trekt de login van een persoon in. Alleen beheerder. */
export async function trekToegangInAction(formData: FormData) {
  await guardBeheerder();
  const email = String(formData.get('email') ?? '').trim();
  if (email) await trekToegangIn(email);
  redirect('/portaal/medewerkers?ok=ingetrokken');
}
