import { cache } from 'react';
import type { KennismakingData } from '@/lib/prospect/types';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { bouwMockups, kiesVoorBranche, laadPool, leesMockupKeuzes } from '@/lib/prospect/artikelen';
import { prospectOpToken } from '@/lib/prospect/prospect';

/**
 * Laadt alles wat de kennismakingspagina en het voorbeeldportaal nodig hebben.
 * Null als het token niet bestaat of de prospect is afgemeld.
 *
 * Artikelen: wat Jessi in het dashboard koos (`mockup_artikelen`), anders vier
 * artikelen automatisch gekozen op branche (content/kennismaking.ts).
 * React cache(): pagina, metadata en portaal delen binnen één request dezelfde
 * uitkomst; tussen requests wordt niets bewaard.
 */
export const haalKennismaking = cache(async (token: string): Promise<KennismakingData | null> => {
  const sb = kmsAdmin();
  if (!sb) return null;
  try {
    const p = await prospectOpToken(sb, String(token ?? '').trim());
    if (!p || p.afgemeld_op) return null;

    const gekozen = leesMockupKeuzes(p.mockup_artikelen);
    let artikelen: KennismakingData['artikelen'] = [];
    if (gekozen) {
      const pool = await laadPool(sb, { ids: gekozen.map((k) => k.productId) });
      [artikelen] = await bouwMockups(sb, pool, [gekozen]);
    }
    // Niets gekozen, of de gekozen artikelen bestaan niet meer: automatisch kiezen.
    if (artikelen.length === 0) {
      const pool = await laadPool(sb);
      [artikelen] = await bouwMockups(sb, pool, [kiesVoorBranche(pool, p.branche)]);
    }

    return {
      prospectId: p.id,
      token: p.token,
      bedrijfsnaam: p.bedrijfsnaam,
      contactpersoon: p.contactpersoon,
      plaats: p.plaats,
      branche: p.branche,
      website: p.website,
      logoUrl: p.logo_url,
      huisstijlKleur: p.huisstijl_kleur,
      artikelen,
    };
  } catch {
    return null;
  }
});
