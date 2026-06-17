'use server';
import { redirect } from 'next/navigation';
import {
  getMijnWebshopOrganisatie,
  getAssortiment,
  getMijnMedewerker,
  getBudgetVerbruik,
  getWebshopMedewerkers,
  getVerstrekkingen,
  getVerstrektInPeriode,
  maakWebshopBestelling,
  bestelPakket,
  lijstprijs,
  nettoPrijs,
  type BestelRegelInput,
  type WebshopMedewerker,
  type Verstrekking,
} from '@/lib/portaal/webshop';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';

/** Bepaalt de medewerker: eigen match, anders de gekozen medewerker uit het formulier. */
async function bepaalMedewerker(
  formData: FormData,
): Promise<{ id: string | null; medewerker: WebshopMedewerker | null }> {
  const eigen = await getMijnMedewerker();
  if (eigen) return { id: eigen.id, medewerker: eigen };

  const gekozen = String(formData.get('medewerker_id') ?? '').trim();
  if (!gekozen) return { id: null, medewerker: null };

  const lijst = await getWebshopMedewerkers();
  const mw = lijst.find((m) => m.id === gekozen) ?? null;
  return { id: gekozen, medewerker: mw };
}

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
      // Stukprijs is de nettoprijs na klantkorting; zo kloppen order.bedrag en de factuur automatisch.
      stukprijs: nettoPrijs(lijstprijs(match.variant.verkoopprijs, match.variant.meerprijs), org.korting_pct),
    });
  }
  if (regels.length === 0) redirect('/portaal/webshop?leeg=1');

  const { id: medewerkerId, medewerker } = await bepaalMedewerker(formData);

  // Verbruik ophalen voor de budgetcheck (alleen relevant bij budget_actief en een medewerker met budget).
  let verbruikt = 0;
  if (org.budget_actief && medewerkerId) {
    verbruikt = await getBudgetVerbruik(medewerkerId);
  }

  // Verstrekking per artikel: altijd gratis en periodiek gratis tellen anders mee in het budget.
  const verstrekkingen = await getVerstrekkingen();
  // Tel per periodiek-gratis product hoeveel de medewerker er deze periode al heeft besteld.
  const reedsVerstrekt: Record<string, number> = {};
  if (medewerkerId) {
    const producten = new Map<string, Verstrekking>();
    for (const r of regels) {
      const v = verstrekkingen[r.product_id];
      if (v && v.verstrekking_type === 'periodiek_gratis') producten.set(r.product_id, v);
    }
    for (const [productId, v] of producten) {
      reedsVerstrekt[productId] = await getVerstrektInPeriode(medewerkerId, productId, v.periode);
    }
  }

  const notitie = String(formData.get('notitie') ?? '').trim();
  const referentienr = String(formData.get('referentienr') ?? '').trim();
  const door = auth.user.email ?? 'onbekend';

  const res = await maakWebshopBestelling(org, door, medewerkerId, regels, notitie, {
    medewerker,
    verbruikt,
    referentienr,
    verstrekkingen,
    reedsVerstrekt,
  });
  if (!res.ok) {
    // res.error bevat een nette reden (budget, productbudget, min/max bedrag); toon die aan de gebruiker.
    redirect(`/portaal/webshop?reden=${encodeURIComponent(res.error ?? 'Plaatsen mislukt')}`);
  }

  redirect('/portaal/webshop?ok=1');
}

export async function bestelPakketActie(formData: FormData) {
  const sb = await getServerSupabase();
  if (!sb) redirect('/portaal/login');
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect('/portaal/login');

  const org = await getMijnWebshopOrganisatie();
  if (!org) redirect('/portaal');

  const pakketId = String(formData.get('pakket_id') ?? '').trim();
  if (!pakketId) redirect('/portaal/webshop?fout=1');

  const { id: medewerkerId, medewerker } = await bepaalMedewerker(formData);

  let verbruikt = 0;
  if (org.budget_actief && medewerkerId) {
    verbruikt = await getBudgetVerbruik(medewerkerId);
  }

  const referentienr = String(formData.get('referentienr') ?? '').trim();
  const door = auth.user.email ?? 'onbekend';

  const res = await bestelPakket(pakketId, {
    org,
    aangevraagdDoor: door,
    medewerkerId,
    medewerker,
    verbruikt,
    referentienr,
  });
  if (!res.ok) {
    redirect(`/portaal/webshop?reden=${encodeURIComponent(res.error ?? 'Pakket bestellen mislukt')}`);
  }

  redirect('/portaal/webshop?pakketok=1');
}
