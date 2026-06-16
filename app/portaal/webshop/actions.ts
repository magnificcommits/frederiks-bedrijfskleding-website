'use server';
import { redirect } from 'next/navigation';
import {
  getMijnWebshopOrganisatie,
  getAssortiment,
  getMijnMedewerker,
  getBudgetVerbruik,
  getWebshopMedewerkers,
  maakWebshopBestelling,
  type BestelRegelInput,
} from '@/lib/portaal/webshop';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';

const effectievePrijs = (verkoopprijs: number | null, meerprijs: number | null) =>
  (Number(verkoopprijs) || 0) + (Number(meerprijs) || 0);

export async function plaatsBestelling(formData: FormData) {
  const sb = await getServerSupabase();
  if (!sb) redirect('/portaal/login');
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect('/portaal/login');

  const org = await getMijnWebshopOrganisatie();
  if (!org) redirect('/portaal');

  const assortiment = await getAssortiment();
  const varianten = new Map<string, { product: (typeof assortiment)[number]; variant: (typeof assortiment)[number]['varianten'][number] }>();
  for (const p of assortiment) {
    for (const v of p.varianten) varianten.set(v.id, { product: p, variant: v });
  }

  // De winkelwagen komt binnen als JSON: [{ variantId, aantal }, ...].
  let mand: { variantId: string; aantal: number }[] = [];
  try {
    mand = JSON.parse(String(formData.get('mand') ?? '[]'));
  } catch {
    mand = [];
  }

  const regels: BestelRegelInput[] = [];
  for (const item of mand) {
    const match = varianten.get(item.variantId);
    const aantal = Math.floor(Number(item.aantal) || 0);
    if (!match || aantal <= 0) continue;
    regels.push({
      product_id: match.product.id,
      variant_id: match.variant.id,
      item_naam: match.product.naam,
      maat: match.variant.maat,
      kleur: match.variant.kleur,
      aantal,
      stukprijs: effectievePrijs(match.variant.verkoopprijs, match.variant.meerprijs),
    });
  }
  if (regels.length === 0) redirect('/portaal/webshop?leeg=1');

  // Bepaal de medewerker: eigen match, anders de gekozen medewerker uit het formulier.
  const eigen = await getMijnMedewerker();
  let medewerkerId: string | null = eigen?.id ?? null;
  const gekozen = String(formData.get('medewerker_id') ?? '').trim();
  if (!medewerkerId && gekozen) medewerkerId = gekozen;

  // Budgetcontrole als budget actief is en er een medewerker met budget is.
  if (org.budget_actief && medewerkerId) {
    const lijst = await getWebshopMedewerkers();
    const mw = (eigen?.id === medewerkerId ? eigen : lijst.find((m) => m.id === medewerkerId)) ?? null;
    if (mw && mw.budget != null) {
      const verbruikt = await getBudgetVerbruik(medewerkerId);
      const resterend = Number(mw.budget) - verbruikt;
      const totaal = regels.reduce((sum, r) => sum + r.aantal * r.stukprijs, 0);
      if (totaal > resterend) redirect('/portaal/webshop?budget=1');
    }
  }

  const notitie = String(formData.get('notitie') ?? '').trim();
  const door = auth.user.email ?? 'onbekend';
  const res = await maakWebshopBestelling(org, door, medewerkerId, regels, notitie);
  if (!res.ok) redirect('/portaal/webshop?fout=1');

  redirect('/portaal/webshop?ok=1');
}
