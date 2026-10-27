/**
 * Rollen in het KMS (tabel admin_gebruikers, kolom rol). Puur, zonder database,
 * zodat de regels los te testen zijn.
 *
 * - eigenaar: alles.
 * - medewerker: alles behalve instellingen, beheerders, facturatie en cijfers.
 * - magazijn: alleen het planbord (werkbonnen, logo's, drukproeven) en de
 *   statussen van productie tot factureren (Jessi, 27 okt).
 * - lezer: mag kijken, niets wijzigen.
 */
export const DASH_ROLLEN = ['eigenaar', 'medewerker', 'magazijn', 'lezer'] as const;
export type DashRol = (typeof DASH_ROLLEN)[number];

export const DASH_ROL_LABEL: Record<DashRol, string> = {
  eigenaar: 'Eigenaar',
  medewerker: 'Medewerker',
  magazijn: 'Magazijnmedewerker',
  lezer: 'Alleen lezen',
};

export const DASH_ROL_UITLEG: Record<DashRol, string> = {
  eigenaar: 'Alles, ook instellingen, beheerders, facturen en cijfers.',
  medewerker: 'Klanten, offertes, orders en productie. Geen instellingen, facturen of cijfers.',
  magazijn: 'Alleen het planbord: werkbonnen, logo’s en drukproeven, en de status van productie tot factureren. Geen prijzen of klantgegevens.',
  lezer: 'Mag alles bekijken, maar niets wijzigen.',
};

export function isDashRol(s: unknown): s is DashRol {
  return (DASH_ROLLEN as readonly string[]).includes(String(s));
}

/** Waar de magazijnmedewerker na het inloggen begint. */
export const MAGAZIJN_START = '/dashboard/logos';

/**
 * Mag een magazijnmedewerker dit pad openen (pagina of actie op die pagina)?
 * De startpagina /dashboard alleen om door te sturen, niet voor acties.
 */
export function magazijnMagPad(pad: string, isActie = false): boolean {
  const p = (pad.split('?')[0] || '').replace(/\/+$/, '') || '/';
  if (p === '/dashboard') return !isActie;
  if (p === '/dashboard/logos' || p.startsWith('/dashboard/logos/')) return true;
  if (p === '/dashboard/drukproeven' || p.startsWith('/dashboard/drukproeven/')) return true;
  if (/^\/dashboard\/orders\/[0-9a-f-]{36}\/werkbon$/i.test(p)) return true;
  if (p.startsWith('/dashboard/auth/') || p === '/dashboard/beveiliging' || p === '/dashboard/app') return true;
  return false;
}
