import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Algemene instellingen voor alle campagnes, opgeslagen in de bestaande
 * sleutel/waarde-tabel `instellingen`. Geen migratie nodig.
 */

export type CampagneInstellingen = {
  /** Maximaal aantal campagnemails per dag, over alle campagnes samen. */
  dagLimiet: number;
  /** Noodrem: niets versturen en geen stappen uitvoeren. */
  allesGepauzeerd: boolean;
  /** Adres voor testmails. Leeg = het adres van de ingelogde beheerder. */
  testadres: string;
  /** Link naar de Google-reviewpagina, voor {{reviewlink}}. */
  reviewlink: string;
  /** Standaard afzendernaam als een campagne er zelf geen heeft. */
  afzenderNaam: string;
};

export const STANDAARD_INSTELLINGEN: CampagneInstellingen = {
  dagLimiet: 60,
  allesGepauzeerd: false,
  testadres: '',
  reviewlink: '',
  afzenderNaam: 'Jessi Frederiks',
};

const SLEUTELS = {
  dagLimiet: 'campagnes_dag_limiet',
  allesGepauzeerd: 'campagnes_alles_gepauzeerd',
  testadres: 'campagnes_testadres',
  reviewlink: 'campagnes_reviewlink',
  afzenderNaam: 'campagnes_afzender_naam',
} as const;

export async function getCampagneInstellingen(): Promise<CampagneInstellingen> {
  const sb = kmsAdmin();
  if (!sb) return STANDAARD_INSTELLINGEN;
  const { data } = await sb.from('instellingen').select('sleutel, waarde').in('sleutel', Object.values(SLEUTELS));
  const map = new Map(((data as { sleutel: string; waarde: string | null }[]) ?? []).map((r) => [r.sleutel, r.waarde ?? '']));
  const limiet = Number(map.get(SLEUTELS.dagLimiet));
  return {
    dagLimiet: Number.isFinite(limiet) && limiet > 0 ? Math.min(2000, Math.round(limiet)) : STANDAARD_INSTELLINGEN.dagLimiet,
    allesGepauzeerd: map.get(SLEUTELS.allesGepauzeerd) === 'true',
    testadres: map.get(SLEUTELS.testadres) ?? '',
    reviewlink: map.get(SLEUTELS.reviewlink) ?? '',
    afzenderNaam: map.get(SLEUTELS.afzenderNaam) || STANDAARD_INSTELLINGEN.afzenderNaam,
  };
}

export async function zetCampagneInstellingen(v: Partial<CampagneInstellingen>): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const rijen: { sleutel: string; waarde: string }[] = [];
  if (v.dagLimiet !== undefined) rijen.push({ sleutel: SLEUTELS.dagLimiet, waarde: String(Math.max(1, Math.min(2000, Math.round(v.dagLimiet)))) });
  if (v.allesGepauzeerd !== undefined) rijen.push({ sleutel: SLEUTELS.allesGepauzeerd, waarde: v.allesGepauzeerd ? 'true' : 'false' });
  if (v.testadres !== undefined) rijen.push({ sleutel: SLEUTELS.testadres, waarde: v.testadres.trim() });
  if (v.reviewlink !== undefined) rijen.push({ sleutel: SLEUTELS.reviewlink, waarde: v.reviewlink.trim() });
  if (v.afzenderNaam !== undefined) rijen.push({ sleutel: SLEUTELS.afzenderNaam, waarde: v.afzenderNaam.trim() });
  if (!rijen.length) return true;
  const { error } = await sb.from('instellingen').upsert(rijen.map((r) => ({ ...r, bijgewerkt_op: new Date().toISOString() })), { onConflict: 'sleutel' });
  return !error;
}
