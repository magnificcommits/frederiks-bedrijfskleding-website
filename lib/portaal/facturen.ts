import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Portaal-data-access voor facturen. De facturen worden dashboard-side beheerd
 * (module Facturatie), dus we lezen ze via kmsAdmin() (service-role, omzeilt RLS).
 * We scopen strikt op de meegegeven organisatie-id, zodat een klant alleen de
 * eigen bedrijfsfacturen ziet. Alleen server-side gebruiken, achter een
 * rolcheck (beheerder/leidinggevende).
 */

export type PortaalFactuur = {
  id: string;
  factuurnummer: string | null;
  status: string;
  bedrag_incl: number | null;
  factuurdatum: string | null;
};

export async function getFacturenVanOrg(orgId: string): Promise<PortaalFactuur[]> {
  if (!orgId) return [];
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('facturen')
    .select('id, factuurnummer, status, bedrag_incl, factuurdatum')
    .eq('organisatie_id', orgId)
    .order('factuurdatum', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  return (data as PortaalFactuur[]) ?? [];
}
