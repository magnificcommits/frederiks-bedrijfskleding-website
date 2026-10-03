'use server';
import { dashAuthed, getHuidigeAdmin, kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Resultaat van het bewaren van menu-favorieten.
 *  - ok: opgeslagen bij de beheerder in admin_gebruikers.nav_favorieten.
 *  - lokaal: niet in de database gelukt (geen admin-account, kolom ontbreekt nog,
 *    database niet gekoppeld). De client bewaart dan in localStorage.
 */
export type NavFavorietenResultaat = { ok: true } | { ok: false; reden: 'niet-ingelogd' | 'lokaal' | 'ongeldig' };

const MAX_FAVORIETEN = 40;
const HREF_PATROON = /^\/dashboard(\/[a-z0-9-]+)*$/;

/** Bewaart de favorieten (hrefs, op volgorde) van de ingelogde beheerder. */
export async function bewaarNavFavorieten(hrefs: unknown): Promise<NavFavorietenResultaat> {
  if (!(await dashAuthed())) return { ok: false, reden: 'niet-ingelogd' };

  if (!Array.isArray(hrefs) || hrefs.length > MAX_FAVORIETEN) return { ok: false, reden: 'ongeldig' };
  const schoon: string[] = [];
  for (const h of hrefs) {
    if (typeof h !== 'string' || h.length > 120 || !HREF_PATROON.test(h)) return { ok: false, reden: 'ongeldig' };
    if (!schoon.includes(h)) schoon.push(h);
  }

  // Wachtwoordlogin heeft geen eigen account: dan blijft het bij de browser.
  const admin = await getHuidigeAdmin();
  const sb = kmsAdmin();
  if (!admin || !sb) return { ok: false, reden: 'lokaal' };

  try {
    const { error } = await sb
      .from('admin_gebruikers')
      .update({ nav_favorieten: schoon })
      .eq('email', admin.email);
    // Ontbreekt de kolom nog (migratie 20261004 niet gedraaid), dan geeft Supabase
    // hier een fout. Geen crash: de client valt terug op localStorage.
    if (error) return { ok: false, reden: 'lokaal' };
    return { ok: true };
  } catch {
    return { ok: false, reden: 'lokaal' };
  }
}
