import { cache } from 'react';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isLeadsDbConfigured } from '@/lib/env';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';

/**
 * Gedeelde basis voor de KMS/ERP-beheerpagina's onder /dashboard.
 * Service-role client (omzeilt RLS) plus de toegangscontrole van het dashboard.
 * Alleen server-side gebruiken, altijd achter dashAuthed().
 *
 * Twee manieren van inloggen:
 *  1. Het gedeelde dashboardwachtwoord. Het cookie `fb_dash` bevat NIET het
 *     wachtwoord, maar een HMAC-SHA256-ondertekend token `v1.<verloop>.<handtekening>`
 *     dat 8 uur geldig is.
 *  2. Een persoonlijk Supabase-account (e-maillink) van een actieve admin. Naast de
 *     Supabase-sessie zet de callback een eigen ondertekend cookie `fb_admin_sessie`
 *     met de inlogtijd; na 8 uur moet opnieuw worden ingelogd. Heeft de admin
 *     tweestapsverificatie aan, dan telt de sessie pas na de 6-cijferige code (aal2).
 */
export const DASH_COOKIE = 'fb_dash';
export const ADMIN_SESSIE_COOKIE = 'fb_admin_sessie';
/** Maximale sessieduur voor beide inlogmanieren: 8 uur. */
export const SESSIE_DUUR_SEC = 8 * 60 * 60;
/** Toegestane klokafwijking bij het controleren van tijdstempels. */
const KLOK_MARGE_SEC = 60;

export function kmsAdmin(): SupabaseClient | null {
  if (!isLeadsDbConfigured) return null;
  return createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false } });
}

// ---------------------------------------------------------------------------
// Ondertekende tokens
// ---------------------------------------------------------------------------

/**
 * Geheim voor het ondertekenen van sessiecookies. Bij voorkeur DASHBOARD_SESSION_SECRET;
 * anders afgeleid (sha256) van het dashboardwachtwoord + de service key. Wijzigt het
 * wachtwoord, dan worden alle bestaande sessies daardoor automatisch ongeldig.
 * Zonder enige bron geen geheim: dan is geen enkel token geldig.
 */
function sessieGeheim(): Buffer | null {
  const eigen = (process.env.DASHBOARD_SESSION_SECRET ?? '').trim();
  if (eigen) return createHash('sha256').update(`fb-sessie|${eigen}`).digest();
  const pw = env.dashboardPassword.trim();
  const sk = env.supabaseServiceKey.trim();
  if (!pw && !sk) return null;
  return createHash('sha256').update(`fb-sessie|${pw}|${sk}`).digest();
}

function onderteken(doel: string, inhoud: string): string | null {
  const geheim = sessieGeheim();
  if (!geheim) return null;
  return createHmac('sha256', geheim).update(`${doel}|${inhoud}`).digest('base64url');
}

function handtekeningKlopt(doel: string, inhoud: string, handtekening: string): boolean {
  const verwacht = onderteken(doel, inhoud);
  if (!verwacht || !handtekening) return false;
  const a = Buffer.from(verwacht);
  const b = Buffer.from(handtekening);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function nuSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** Vergelijkt twee geheimen in constante tijd (ook bij verschillende lengte). */
export function veiligGelijk(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

/** Token voor het wachtwoordcookie: v1.<verloop>.<handtekening>. */
export function maakDashToken(): string | null {
  const verloop = nuSec() + SESSIE_DUUR_SEC;
  const inhoud = `v1.${verloop}`;
  const sig = onderteken('dash', inhoud);
  return sig ? `${inhoud}.${sig}` : null;
}

function dashTokenGeldig(token: string | undefined): boolean {
  if (!token) return false;
  const delen = token.split('.');
  if (delen.length !== 3 || delen[0] !== 'v1') return false;
  const verloop = Number(delen[1]);
  if (!Number.isInteger(verloop)) return false;
  const nu = nuSec();
  if (verloop <= nu || verloop > nu + SESSIE_DUUR_SEC + KLOK_MARGE_SEC) return false;
  return handtekeningKlopt('dash', `v1.${delen[1]}`, delen[2]);
}

/** Token voor de Supabase-adminsessie: v1.<inlogtijd>.<gebruikers-id>.<handtekening>. */
export function maakAdminSessieToken(userId: string): string | null {
  if (!userId || userId.includes('.')) return null;
  const inhoud = `v1.${nuSec()}.${userId}`;
  const sig = onderteken('admin', inhoud);
  return sig ? `${inhoud}.${sig}` : null;
}

/** Geeft de inlogtijd (unix-seconden) terug als het token geldig is voor deze gebruiker, anders null. */
function adminSessieInlogtijd(token: string | undefined, userId: string): number | null {
  if (!token) return null;
  const delen = token.split('.');
  if (delen.length !== 4 || delen[0] !== 'v1') return null;
  const inlogtijd = Number(delen[1]);
  if (!Number.isInteger(inlogtijd)) return null;
  const nu = nuSec();
  if (inlogtijd > nu + KLOK_MARGE_SEC || nu - inlogtijd >= SESSIE_DUUR_SEC) return null;
  if (delen[2] !== userId) return null;
  if (!handtekeningKlopt('admin', `v1.${delen[1]}.${delen[2]}`, delen[3])) return null;
  return inlogtijd;
}

/** Cookie-instellingen voor beide sessiecookies. */
export function sessieCookieOpties() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSIE_DUUR_SEC,
  };
}

// ---------------------------------------------------------------------------
// Toegangscontrole
// ---------------------------------------------------------------------------

/** Wachtwoord-cookie: geldig ondertekend token zolang er een dashboardwachtwoord is ingesteld. */
async function wachtwoordCookieGeldig(): Promise<boolean> {
  if (!env.dashboardPassword.trim()) return false;
  return dashTokenGeldig((await cookies()).get(DASH_COOKIE)?.value);
}

/** Leest het aal-niveau ('aal1' of 'aal2') uit een Supabase access token. */
function aalUitToken(accessToken: string | undefined): string {
  try {
    const deel = accessToken?.split('.')[1];
    if (!deel) return 'aal1';
    const payload = JSON.parse(Buffer.from(deel, 'base64url').toString('utf8')) as { aal?: string };
    return payload.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}

export type HuidigeAdmin = { email: string; naam: string | null; rol: string };

export type AdminSessieStatus =
  /** Geen Supabase-gebruiker ingelogd. */
  | { status: 'geen' }
  /** Wel ingelogd, maar geen (actieve) beheerder. */
  | { status: 'geen-admin'; email: string }
  /** Beheerder, maar de 8 uur zijn voorbij (of het sessiecookie ontbreekt). */
  | { status: 'verlopen'; email: string; userId: string }
  /** Beheerder met tweestapsverificatie die de code nog moet invoeren. */
  | { status: '2fa-nodig'; email: string; userId: string; inlogtijd: number }
  /** Volledig ingelogd. */
  | { status: 'ok'; email: string; userId: string; inlogtijd: number; admin: HuidigeAdmin; tweeStapAan: boolean };

/**
 * Bepaalt in één keer (per request gecachet) de status van de Supabase-adminsessie:
 * geldige gebruiker, actieve admin_gebruikers-rij, ondertekend sessiecookie jonger
 * dan 8 uur, en voldoende zekerheidsniveau (currentLevel === nextLevel).
 */
export const adminSessieStatus = cache(async (): Promise<AdminSessieStatus> => {
  try {
    const sb = await getServerSupabase();
    if (!sb) return { status: 'geen' };
    const { data: { user } } = await sb.auth.getUser();
    const email = user?.email?.toLowerCase().trim();
    if (!user || !email) return { status: 'geen' };

    const admin = kmsAdmin();
    if (!admin) return { status: 'geen-admin', email };
    const { data, error } = await admin
      .from('admin_gebruikers')
      .select('email, naam, rol, actief')
      .eq('email', email)
      .maybeSingle();
    if (error || !data || !data.actief) return { status: 'geen-admin', email };

    const inlogtijd = adminSessieInlogtijd((await cookies()).get(ADMIN_SESSIE_COOKIE)?.value, user.id);
    if (inlogtijd === null) return { status: 'verlopen', email, userId: user.id };

    // Zekerheidsniveau. getUser() hierboven heeft het access token bij Supabase
    // gecontroleerd, dus de aal-claim uit hetzelfde token is betrouwbaar.
    const { data: { session } } = await sb.auth.getSession();
    const huidig = aalUitToken(session?.access_token);
    const tweeStapAan = (user.factors ?? []).some((f) => f.status === 'verified');
    const volgend = tweeStapAan ? 'aal2' : huidig;
    if (huidig !== volgend) return { status: '2fa-nodig', email, userId: user.id, inlogtijd };

    return {
      status: 'ok',
      email,
      userId: user.id,
      inlogtijd,
      admin: { email: data.email, naam: data.naam ?? null, rol: data.rol },
      tweeStapAan,
    };
  } catch {
    return { status: 'geen' };
  }
});

/** Geldige Supabase-sessie van een actieve admin, binnen 8 uur en met voldoende zekerheidsniveau. */
async function sessieIsAdmin(): Promise<boolean> {
  return (await adminSessieStatus()).status === 'ok';
}

/** Is de gebruiker ingelogd met het gedeelde dashboardwachtwoord? */
export async function isWachtwoordLogin(): Promise<boolean> {
  return wachtwoordCookieGeldig();
}

/**
 * dashAuthed = (geldig wachtwoord-cookie) OF (geldige Supabase-sessie van een
 * actieve admin). Het wachtwoordpad blijft intact: met alleen het wachtwoord-cookie
 * blijft toegang gegarandeerd, ook zonder Supabase-sessie.
 */
export async function dashAuthed(): Promise<boolean> {
  if (await wachtwoordCookieGeldig()) return true;
  if (!(await sessieIsAdmin())) return false;
  // Rol 'lezer' mag kijken, niet wijzigen. Elke wijziging in het KMS loopt via een
  // Server Action (herkenbaar aan de header Next-Action); die weigeren we hier
  // centraal, zodat niet elke actie apart een rolcheck nodig heeft.
  if ((await getHuidigeAdmin())?.rol === 'lezer' && (await isServerAction())) return false;
  return true;
}

/** Is het huidige verzoek een Server Action-aanroep? */
async function isServerAction(): Promise<boolean> {
  try {
    return (await headers()).has('next-action');
  } catch {
    return false;
  }
}

/**
 * De ingelogde admin op basis van de Supabase-sessie + admin_gebruikers-rij.
 * Null als er geen volledig geldige sessie/admin is (bv. wachtwoord-login zonder account).
 */
export async function getHuidigeAdmin(): Promise<HuidigeAdmin | null> {
  const s = await adminSessieStatus();
  return s.status === 'ok' ? s.admin : null;
}

/**
 * Mag de huidige gebruiker de eigenaar-only delen (instellingen, beheerders,
 * facturatie, rapportage, groei, systeem)? Een wachtwoord-login zonder admin-account
 * houdt volledige toegang (eigenaar); een ingelogde admin moet rol 'eigenaar' hebben.
 * Medewerker en lezer worden geweerd.
 */
export async function magEigenaar(): Promise<boolean> {
  const admin = await getHuidigeAdmin();
  return admin === null || admin.rol === 'eigenaar';
}

/** Guard voor eigenaar-only pagina's en acties: stuurt niet-eigenaren terug. */
export async function eisEigenaar(): Promise<void> {
  if (!(await magEigenaar())) redirect('/dashboard?fout=geen-toegang');
}
