import { dashAuthed, getHuidigeAdmin, kmsAdmin, type HuidigeAdmin } from '@/lib/kms/adminClient';
import { DashboardShell, type NavOpslag } from '@/components/dashboard/DashboardShell';

/**
 * Menu-favorieten van de ingelogde beheerder. Zonder admin-account (wachtwoordlogin)
 * of zolang de kolom nav_favorieten nog niet bestaat, bewaart de browser ze zelf.
 * Een fout van Supabase mag de layout nooit laten crashen.
 */
async function leesNavFavorieten(
  admin: HuidigeAdmin | null,
): Promise<{ opslag: NavOpslag; favorieten: string[] | null }> {
  const lokaal = { opslag: 'lokaal' as const, favorieten: null };
  if (!admin) return lokaal;
  const sb = kmsAdmin();
  if (!sb) return lokaal;
  try {
    const { data, error } = await sb
      .from('admin_gebruikers')
      .select('nav_favorieten')
      .eq('email', admin.email)
      .maybeSingle();
    if (error || !data) return lokaal;
    const waarde = (data as { nav_favorieten?: unknown }).nav_favorieten;
    const favorieten = Array.isArray(waarde) ? waarde.filter((h): h is string => typeof h === 'string') : null;
    return { opslag: 'db', favorieten };
  } catch {
    return lokaal;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const authed = await dashAuthed();
  if (!authed) return <>{children}</>;
  const huidige = await getHuidigeAdmin();
  const nav = await leesNavFavorieten(huidige);
  return (
    <DashboardShell
      adminNaam={huidige?.naam ?? huidige?.email ?? null}
      adminRol={huidige?.rol ?? null}
      navOpslag={nav.opslag}
      navFavorieten={nav.favorieten}
    >
      {children}
    </DashboardShell>
  );
}
