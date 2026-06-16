'use server';
import { redirect } from 'next/navigation';
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

/** Alleen een beheerder met gekoppelde organisatie mag op deze pagina handelen. */
async function guardBeheerder() {
  const toegang = await getMijnToegang();
  if (!toegang.email) redirect('/portaal/login');
  if (toegang.rol !== 'beheerder' || !toegang.organisatieId) redirect('/portaal/team');
  return toegang;
}

export async function nieuwTeamlid(formData: FormData) {
  const toegang = await guardBeheerder();
  const naam = String(formData.get('naam') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const functie = String(formData.get('functie') ?? '').trim();
  const rol = leesRol(String(formData.get('rol') ?? 'medewerker'));
  const budget = leesBudget(String(formData.get('budget') ?? ''));
  if (!naam) redirect('/portaal/team?fout=naam');
  const res = await maakMedewerkerMetToegang({
    organisatieId: toegang.organisatieId!,
    naam,
    email,
    functie,
    rol,
    budget,
  });
  redirect(res.ok ? '/portaal/team?ok=toegevoegd' : '/portaal/team?fout=opslaan');
}

export async function geefToegangAction(formData: FormData) {
  const toegang = await guardBeheerder();
  const medewerkerId = String(formData.get('medewerker_id') ?? '').trim();
  const naam = String(formData.get('naam') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const rol = leesRol(String(formData.get('rol') ?? 'medewerker'));
  if (!medewerkerId || !email) redirect('/portaal/team?fout=email');
  const res = await geefToegang({ organisatieId: toegang.organisatieId!, medewerkerId, naam, email, rol });
  redirect(res.ok ? '/portaal/team?ok=toegang' : '/portaal/team?fout=opslaan');
}

export async function wijzigRolAction(formData: FormData) {
  await guardBeheerder();
  const email = String(formData.get('email') ?? '').trim();
  const rol = leesRol(String(formData.get('rol') ?? 'medewerker'));
  if (email) await wijzigRol(email, rol);
  redirect('/portaal/team?ok=rol');
}

export async function trekToegangInAction(formData: FormData) {
  await guardBeheerder();
  const email = String(formData.get('email') ?? '').trim();
  if (email) await trekToegangIn(email);
  redirect('/portaal/team?ok=ingetrokken');
}

export async function zetBudgetAction(formData: FormData) {
  await guardBeheerder();
  const medewerkerId = String(formData.get('medewerker_id') ?? '').trim();
  const budget = leesBudget(String(formData.get('budget') ?? ''));
  if (medewerkerId) await zetBudget(medewerkerId, budget);
  redirect('/portaal/team?ok=budget');
}
