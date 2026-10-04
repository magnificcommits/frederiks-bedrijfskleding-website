import { getSpaarInstellingen, getSpaarsaldoAlle } from '@/lib/kms/sparen';
import { berekenStanden, laadSpaarBundel } from '@/lib/kms/sparenGrootboek';

/**
 * Spaarstanden voor de campagnetrigger "bijna een spaarniveau omhoog" en de
 * merge-tags {{spaarsaldo}} en {{volgend_niveau}}. Alleen lezen: geen
 * synchronisatie van het grootboek vanuit de campagnecron.
 */

export type SpaarStandKort = {
  organisatieId: string;
  saldo: number;
  /** Naam van het volgende niveau, null als er geen niveaus zijn of iemand al bovenaan zit. */
  volgendNiveau: string | null;
  /** 0..1 op weg naar het volgende niveau. */
  voortgang: number;
};

export async function spaarActief(): Promise<boolean> {
  try {
    return (await getSpaarInstellingen()).actief;
  } catch {
    return false;
  }
}

export async function spaarStanden(orgId?: string): Promise<SpaarStandKort[]> {
  try {
    const bundel = await laadSpaarBundel(orgId);
    return berekenStanden(bundel).map((s) => ({
      organisatieId: s.organisatieId,
      saldo: Math.max(0, s.saldo),
      volgendNiveau: s.niveau?.volgende?.naam ?? null,
      voortgang: Number(s.niveau?.voortgang) || 0,
    }));
  } catch {
    // Oudere spaarmodule zonder niveaus: alleen saldo.
    try {
      const alle = await getSpaarsaldoAlle();
      return alle.filter((s) => !orgId || s.organisatieId === orgId).map((s) => ({ organisatieId: s.organisatieId, saldo: s.saldo, volgendNiveau: null, voortgang: 0 }));
    } catch {
      return [];
    }
  }
}
