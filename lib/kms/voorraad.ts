import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor het voorraadoverzicht.
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export type VoorraadVariant = {
  id: string;
  maat: string | null;
  kleur: string | null;
  voorraad: number;
  verkoopprijs: number | null;
  actief: boolean;
};

export type VoorraadProduct = {
  id: string;
  naam: string;
  merk: string | null;
  min_voorraad: number | null;
  varianten: VoorraadVariant[];
  totaal: number;
  onderMinimum: boolean;
};

export async function getVoorraadOverzicht(): Promise<VoorraadProduct[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('producten')
    .select('id, naam, merk, min_voorraad, product_varianten(id, maat, kleur, voorraad, verkoopprijs, actief)')
    .order('naam');

  const rows = (data as unknown as {
    id: string;
    naam: string;
    merk: string | null;
    min_voorraad: number | null;
    product_varianten:
      | {
          id: string;
          maat: string | null;
          kleur: string | null;
          voorraad: number | null;
          verkoopprijs: number | null;
          actief: boolean;
        }[]
      | null;
  }[]) ?? [];

  return rows.map((r) => {
    const varianten: VoorraadVariant[] = (r.product_varianten ?? [])
      .map((v) => ({
        id: v.id,
        maat: v.maat,
        kleur: v.kleur,
        voorraad: v.voorraad ?? 0,
        verkoopprijs: v.verkoopprijs,
        actief: v.actief,
      }))
      .sort((a, b) => (a.maat ?? '').localeCompare(b.maat ?? '', 'nl') || (a.kleur ?? '').localeCompare(b.kleur ?? '', 'nl'));
    const totaal = varianten.reduce((som, v) => som + (v.voorraad ?? 0), 0);
    const onderMinimum = r.min_voorraad != null && totaal < r.min_voorraad;
    return {
      id: r.id,
      naam: r.naam,
      merk: r.merk,
      min_voorraad: r.min_voorraad,
      varianten,
      totaal,
      onderMinimum,
    };
  });
}
