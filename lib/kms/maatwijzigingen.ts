import { kmsAdmin } from '@/lib/kms/adminClient';
import { sendEmail } from '@/lib/email';
import { medewerkerBerichtHtml } from '@/lib/kms/medewerkerVerzoeken';

/**
 * Maatwijzigingsverzoeken, KMS-kant (servicesleutel). Werknemers vragen in het
 * portaal een andere maat aan; Jessi keurt goed (dan wordt medewerker_maten
 * bijgewerkt) of wijst af. In beide gevallen krijgt de werknemer bericht.
 */
export type Maatwijziging = {
  id: string;
  organisatie_id: string;
  medewerker_id: string;
  product_id: string;
  huidige_maat: string | null;
  gewenste_maat: string;
  toelichting: string | null;
  status: string;
  aangevraagd_door: string | null;
  behandeld_door: string | null;
  behandeld_op: string | null;
  notitie: string | null;
  created_at: string;
  organisatie_naam: string | null;
  medewerker_naam: string | null;
  product_naam: string | null;
};

export async function listMaatwijzigingen(): Promise<Maatwijziging[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data, error } = await sb
    .from('maatwijzigingen')
    .select('*, organisaties(naam), medewerkers(naam), producten(naam)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return [];
  type Rij = Omit<Maatwijziging, 'organisatie_naam' | 'medewerker_naam' | 'product_naam'> & {
    organisaties: { naam: string } | null; medewerkers: { naam: string } | null; producten: { naam: string } | null;
  };
  return ((data as unknown as Rij[]) ?? []).map(({ organisaties, medewerkers, producten, ...r }) => ({
    ...r, organisatie_naam: organisaties?.naam ?? null, medewerker_naam: medewerkers?.naam ?? null, product_naam: producten?.naam ?? null,
  }));
}

export async function aantalWachtMaatwijzigingen(): Promise<number> {
  const sb = kmsAdmin(); if (!sb) return 0;
  const { count, error } = await sb.from('maatwijzigingen').select('id', { count: 'exact', head: true }).eq('status', 'wacht');
  return error ? 0 : count ?? 0;
}

async function bericht(orgId: string, medewerkerId: string, tekst: string): Promise<void> {
  const sb = kmsAdmin(); if (!sb) return;
  await sb.from('portaal_meldingen').insert({ organisatie_id: orgId, medewerker_id: medewerkerId, tekst });
  const { data } = await sb.from('medewerkers').select('email').eq('id', medewerkerId).maybeSingle();
  const email = (data as { email: string | null } | null)?.email?.trim();
  if (email) await sendEmail({ to: email, subject: 'Je maat is bekeken', html: medewerkerBerichtHtml(tekst) }).catch(() => {});
}

export async function behandelMaatwijziging(id: string, besluit: 'goedgekeurd' | 'afgewezen', door: string, notitie?: string | null): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { data } = await sb.from('maatwijzigingen').select('*, producten(naam), medewerkers(organisatie_id)').eq('id', id).eq('status', 'wacht').maybeSingle();
  const r = data as (Maatwijziging & { producten: { naam: string } | null; medewerkers: { organisatie_id: string } | null }) | null;
  if (!r) return false;
  // Alleen als de werknemer echt bij deze klant hoort.
  if (r.medewerkers?.organisatie_id !== r.organisatie_id) return false;

  if (besluit === 'goedgekeurd') {
    const { data: bestaand } = await sb.from('medewerker_maten').select('id').eq('medewerker_id', r.medewerker_id).eq('product_id', r.product_id).maybeSingle();
    const nu = new Date().toISOString();
    const { error } = bestaand
      ? await sb.from('medewerker_maten').update({ voorkeursmaat: r.gewenste_maat, bijgewerkt_op: nu }).eq('id', (bestaand as { id: string }).id)
      : await sb.from('medewerker_maten').insert({ medewerker_id: r.medewerker_id, product_id: r.product_id, voorkeursmaat: r.gewenste_maat, plus_minus_toegestaan: false, bijgewerkt_op: nu });
    if (error) return false;
  }
  const { error } = await sb
    .from('maatwijzigingen')
    .update({ status: besluit, behandeld_door: door, behandeld_op: new Date().toISOString(), notitie: notitie?.trim() || null })
    .eq('id', id);
  if (error) return false;

  const artikel = r.producten?.naam ?? 'je artikel';
  await bericht(
    r.organisatie_id,
    r.medewerker_id,
    besluit === 'goedgekeurd'
      ? `Je maat voor ${artikel} is aangepast naar ${r.gewenste_maat}. Bij je volgende bestelling staat deze maat voor je klaar.`
      : `Je verzoek om ${artikel} in maat ${r.gewenste_maat} is niet doorgevoerd.${notitie?.trim() ? ` ${notitie.trim()}` : ''} Vragen? Neem gerust contact op.`,
  );
  return true;
}
