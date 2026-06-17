'use server';
import { redirect } from 'next/navigation';
import {
  getMijnToegang,
  zetBudgetInstellingen,
  zetVestiging,
  zetVoorkeursmaat,
  verwijderVoorkeursmaat,
  type BudgetType,
  type BudgetPeriode,
} from '@/lib/portaal/team';

function leesBudgetType(waarde: string): BudgetType {
  return waarde === 'punten' ? 'punten' : 'euro';
}
function leesBudgetPeriode(waarde: string): BudgetPeriode {
  return waarde === 'maand' || waarde === 'kwartaal' || waarde === 'jaar' ? waarde : 'geen';
}
function leesGetal(waarde: string): number | null {
  const ruw = String(waarde ?? '').replace(/[^0-9.,-]/g, '').replace(',', '.');
  return ruw === '' ? null : Number(ruw);
}
function leesGeheel(waarde: string): number | null {
  const ruw = String(waarde ?? '').replace(/[^0-9]/g, '');
  return ruw === '' ? null : parseInt(ruw, 10);
}

/** Alleen een beheerder met gekoppelde organisatie mag op de detailpagina handelen. */
async function guardBeheerder() {
  const toegang = await getMijnToegang();
  if (!toegang.email) redirect('/portaal/login');
  if (toegang.rol !== 'beheerder' || !toegang.organisatieId) redirect('/portaal/medewerkers');
  return toegang;
}

export async function zetBudgetInstellingenAction(formData: FormData) {
  await guardBeheerder();
  const id = String(formData.get('medewerker_id') ?? '').trim();
  if (!id) redirect('/portaal/medewerkers');

  const budgetType = leesBudgetType(String(formData.get('budget_type') ?? 'euro'));
  const vestigingRaw = String(formData.get('vestiging_id') ?? '').trim();

  const res = await zetBudgetInstellingen(id, {
    budget_type: budgetType,
    startbudget: leesGetal(String(formData.get('startbudget') ?? '')),
    budget: leesGetal(String(formData.get('budget') ?? '')),
    productbudget: leesGeheel(String(formData.get('productbudget') ?? '')),
    buiten_budget_toegestaan: formData.get('buiten_budget_toegestaan') === 'on',
    periodiek_budget: leesGetal(String(formData.get('periodiek_budget') ?? '')),
    budget_periode: leesBudgetPeriode(String(formData.get('budget_periode') ?? 'geen')),
    behoud_restbudget: formData.get('behoud_restbudget') === 'on',
  });
  if (!res.ok) redirect(`/portaal/team/${id}?fout=opslaan`);

  const vest = await zetVestiging(id, vestigingRaw || null);
  redirect(vest.ok ? `/portaal/team/${id}?ok=budget` : `/portaal/team/${id}?fout=opslaan`);
}

export async function zetVoorkeursmaatAction(formData: FormData) {
  await guardBeheerder();
  const id = String(formData.get('medewerker_id') ?? '').trim();
  const productId = String(formData.get('product_id') ?? '').trim();
  if (!id || !productId) redirect('/portaal/team');
  const voorkeursmaat = String(formData.get('voorkeursmaat') ?? '').trim();
  const plusMinus = formData.get('plus_minus_toegestaan') === 'on';
  const res = await zetVoorkeursmaat(id, productId, voorkeursmaat || null, plusMinus);
  redirect(res.ok ? `/portaal/team/${id}?ok=maat` : `/portaal/team/${id}?fout=opslaan`);
}

export async function verwijderVoorkeursmaatAction(formData: FormData) {
  await guardBeheerder();
  const id = String(formData.get('medewerker_id') ?? '').trim();
  const maatId = String(formData.get('maat_id') ?? '').trim();
  if (!id || !maatId) redirect('/portaal/team');
  const res = await verwijderVoorkeursmaat(maatId);
  redirect(res.ok ? `/portaal/team/${id}?ok=maat_weg` : `/portaal/team/${id}?fout=opslaan`);
}
