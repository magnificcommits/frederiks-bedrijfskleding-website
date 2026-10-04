'use server';
import { redirect } from 'next/navigation';
import {
  getMijnWebshopOrganisatie,
  getMijnMedewerker,
  getWebshopMedewerkers,
  getBudgetVerbruik,
  getVerstrekkingen,
  getVerstrektInPeriode,
  getAssortiment,
  lijstprijs,
  nettoPrijs,
  maakWebshopBestelling,
  type BestelRegelInput,
  type WebshopMedewerker,
  type Verstrekking,
} from '@/lib/portaal/webshop';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import { getVertaler } from '@/lib/i18n/portaal/server';

/**
 * Plaatst een eerdere bestelling in één klik opnieuw. Haalt de orderregels van de
 * meegegeven order op (RLS borgt de eigen organisatie), spiegelt vervolgens de aanpak
 * van plaatsBestelling: zelfde argumenten aan maakWebshopBestelling, zodat budget,
 * verstrekking en goedkeuring identiek werken.
 */
export async function herbestelActie(formData: FormData) {
  const sb = await getServerSupabase();
  if (!sb) redirect('/portaal/login');
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect('/portaal/login');

  const orderId = String(formData.get('order_id') ?? '').trim();
  if (!orderId) redirect('/portaal/bestellingen?fout=onbekend');

  const org = await getMijnWebshopOrganisatie();
  if (!org) redirect('/portaal');

  // Haal de oorspronkelijke order op voor de medewerker; RLS borgt de eigen organisatie.
  const { data: order } = await sb
    .from('orders')
    .select('id, ordernummer, medewerker_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) redirect('/portaal/bestellingen?fout=nietgevonden');
  const oorspronkelijke = order as { id: string; ordernummer: number | null; medewerker_id: string | null };

  // Bepaal de medewerker: eigen match indien beschikbaar, anders die van de oorspronkelijke order.
  const eigen = await getMijnMedewerker();
  let medewerkerId: string | null;
  let medewerker: WebshopMedewerker | null;
  if (eigen) {
    medewerkerId = eigen.id;
    medewerker = eigen;
  } else if (oorspronkelijke.medewerker_id) {
    medewerkerId = oorspronkelijke.medewerker_id;
    const lijst = await getWebshopMedewerkers();
    medewerker = lijst.find((m) => m.id === oorspronkelijke.medewerker_id) ?? null;
  } else {
    medewerkerId = null;
    medewerker = null;
  }

  // Orderregels opnieuw opbouwen tegen het assortiment en de prijzen van vandaag, net als
  // plaatsBestelling. Een oude order kan een verouderde prijs, een variant die niet meer in
  // het assortiment staat, of een vrije regel (zoals de prijsregel van een pakket of een
  // nettoprijs uit een offerte) bevatten; die mogen niet zomaar opnieuw besteld worden.
  const assortiment = await getAssortiment(medewerker);
  const varianten = new Map<string, { product: (typeof assortiment)[number]; variant: (typeof assortiment)[number]['varianten'][number] }>();
  for (const p of assortiment) for (const v of p.varianten) varianten.set(v.id, { product: p, variant: v });
  const { data: regelData } = await sb.from('orderregels').select('variant_id, aantal').eq('order_id', orderId);
  const regels: BestelRegelInput[] = [];
  let overgeslagen = 0;
  for (const r of (regelData as { variant_id: string | null; aantal: number | null }[]) ?? []) {
    const aantal = Math.floor(Number(r.aantal) || 0);
    if (aantal <= 0) continue;
    const match = r.variant_id ? varianten.get(r.variant_id) : undefined;
    if (!match) {
      overgeslagen++;
      continue;
    }
    regels.push({
      product_id: match.product.id,
      variant_id: match.variant.id,
      item_naam: match.product.naam,
      maat: match.variant.maat,
      kleur: match.variant.kleur,
      aantal,
      stukprijs: nettoPrijs(lijstprijs(match.variant.verkoopprijs, match.variant.meerprijs), org.korting_pct),
    });
  }
  if (regels.length === 0) {
    redirect('/portaal/bestellingen?fout=geenregels');
  }

  // Verbruik ophalen voor de budgetcheck (alleen relevant bij budget_actief en een medewerker met budget).
  let verbruikt = 0;
  if (org.budget_actief && medewerkerId) {
    verbruikt = await getBudgetVerbruik(medewerkerId);
  }

  // Verstrekking per artikel: altijd gratis en periodiek gratis tellen anders mee in het budget.
  const verstrekkingen = await getVerstrekkingen();
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

  const ordernummer = oorspronkelijke.ordernummer != null ? `#${oorspronkelijke.ordernummer}` : 'een eerdere bestelling';
  // Overgeslagen regels staan in de notitie, zodat Jessi ziet dat de herbestelling kleiner is.
  const notitie = `Herbestelling van ${ordernummer}${overgeslagen ? ` (${overgeslagen} regel(s) niet meer in het assortiment, overgeslagen)` : ''}`;
  const door = auth.user.email ?? 'onbekend';

  const res = await maakWebshopBestelling(org, door, medewerkerId, regels, notitie, {
    medewerker,
    verbruikt,
    verstrekkingen,
    reedsVerstrekt,
  });
  if (!res.ok) {
    redirect(`/portaal/bestellingen?fout=${encodeURIComponent(res.error ?? (await getVertaler()).t('bestellingen.foutHerbestellen'))}`);
  }

  redirect('/portaal/bestellingen?herbesteld=1');
}
