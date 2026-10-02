'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { updateLead } from '@/lib/supabase';
import {
  dashAuthed,
  DASH_COOKIE,
  ADMIN_SESSIE_COOKIE,
  maakDashToken,
  sessieCookieOpties,
  veiligGelijk,
} from '@/lib/kms/adminClient';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import { ipUitHeaders, loginGeblokkeerd, registreerMisluktePoging } from '@/lib/ratelimit';
import { logAudit } from '@/lib/kms/audit';

async function isAuthed() {
  return dashAuthed();
}

/**
 * Inloggen met het gedeelde dashboardwachtwoord. Maximaal 5 mislukte pogingen per
 * IP-adres per 15 minuten; daarna een duidelijke blokkadepagina. Bij succes krijgt
 * de browser een ondertekend token (8 uur geldig), nooit het wachtwoord zelf.
 */
export async function login(formData: FormData) {
  const ip = await ipUitHeaders();
  const sleutels = ip ? [`ip:${ip}`] : [];
  if (await loginGeblokkeerd(sleutels)) redirect('/dashboard/auth/geblokkeerd');

  const pw = String(formData.get('password') ?? '').trim();
  const expected = env.dashboardPassword.trim();
  if (expected && pw && veiligGelijk(pw, expected)) {
    const token = maakDashToken();
    if (token) {
      (await cookies()).set(DASH_COOKIE, token, sessieCookieOpties());
      await logAudit('ingelogd_met_wachtwoord', { entiteit: 'beveiliging', actor: 'dashboard-wachtwoord' });
      redirect('/dashboard');
    }
  }
  await registreerMisluktePoging(sleutels);
  redirect('/dashboard?fout=1');
}

/**
 * Controle vóór het aanvragen van een inloglink (e-maillink). Maximaal 5 aanvragen
 * per e-mailadres en 10 per IP-adres per 15 minuten. Elke aanvraag telt mee.
 */
export async function controleerLinkAanvraag(emailRuw: string): Promise<{ ok: boolean; fout?: string }> {
  const email = String(emailRuw ?? '').toLowerCase().trim().slice(0, 254);
  if (!email || !email.includes('@')) return { ok: false, fout: 'Vul een geldig e-mailadres in.' };
  const ip = await ipUitHeaders();
  const blokkadeTekst =
    'Er zijn te veel inloglinks aangevraagd. Wacht 15 minuten en probeer het dan opnieuw.';
  if (await loginGeblokkeerd([`link-email:${email}`])) return { ok: false, fout: blokkadeTekst };
  if (ip && (await loginGeblokkeerd([`link-ip:${ip}`], 10))) return { ok: false, fout: blokkadeTekst };
  await registreerMisluktePoging([`link-email:${email}`, ip ? `link-ip:${ip}` : '']);
  return { ok: true };
}

export async function logout() {
  const jar = await cookies();
  jar.delete(DASH_COOKIE);
  jar.delete(ADMIN_SESSIE_COOKIE);
  try {
    const sb = await getServerSupabase();
    if (sb) await sb.auth.signOut();
  } catch {
    // best-effort: account-sessie afmelden mag niet crashen
  }
  redirect('/dashboard');
}

export async function saveLeadEdit(formData: FormData) {
  if (!(await isAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  const ruw = String(formData.get('offertewaarde') ?? '').replace(/[^0-9.,]/g, '').replace(',', '.');
  const offertewaarde = ruw === '' ? null : Number(ruw);
  const notitie = String(formData.get('notitie') ?? '').slice(0, 1000) || null;
  const terugRuw = String(formData.get('terug') ?? '/dashboard');
  // Alleen interne paden: voorkomt doorsturen naar een externe site.
  const terug = terugRuw.startsWith('/') && !terugRuw.startsWith('//') && !terugRuw.startsWith('/\\') ? terugRuw : '/dashboard';
  if (id) await updateLead(id, { status, offertewaarde, notitie });
  redirect(terug);
}
