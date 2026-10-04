'use server';
import { cookies } from 'next/headers';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import { ADMIN_SESSIE_COOKIE, maakAdminSessieToken, sessieCookieOpties } from '@/lib/kms/adminClient';
import { ipUitHeaders, loginGeblokkeerd, registreerMisluktePoging } from '@/lib/ratelimit';

/**
 * Inloggen in het KMS met de code uit de inlogmail in plaats van met de link.
 * Nodig voor het KMS als app op de iPhone: de link opent Safari, en Safari deelt
 * zijn cookies niet met de geïnstalleerde app. Doet verder hetzelfde als
 * /dashboard/auth/callback: eigen sessiecookie (8 uur) en zo nodig door naar 2FA.
 * Maximaal 5 foute codes per e-mailadres en 10 per IP-adres per 15 minuten.
 */
export async function verifieerAdminCode(
  emailRuw: string,
  codeRuw: string,
): Promise<{ ok: true; naar: string } | { ok: false; fout: string }> {
  const email = String(emailRuw ?? '').toLowerCase().trim().slice(0, 254);
  const token = String(codeRuw ?? '').replace(/\D/g, '').slice(0, 10);
  if (!email.includes('@')) return { ok: false, fout: 'Vul een geldig e-mailadres in.' };
  if (token.length < 6) return { ok: false, fout: 'Vul de code uit de mail in (6 cijfers).' };

  const ip = await ipUitHeaders();
  const sleutels = [`code-email:${email}`, ip ? `code-ip:${ip}` : ''];
  const blokkade = 'Te veel foute codes. Wacht 15 minuten en vraag dan een nieuwe inlogmail aan.';
  if (await loginGeblokkeerd([`code-email:${email}`])) return { ok: false, fout: blokkade };
  if (ip && (await loginGeblokkeerd([`code-ip:${ip}`], 10))) return { ok: false, fout: blokkade };

  const sb = await getServerSupabase();
  if (!sb) return { ok: false, fout: 'Inloggen met e-mail is nog niet geconfigureerd.' };

  const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data?.user) {
    await registreerMisluktePoging(sleutels);
    return { ok: false, fout: 'Deze code klopt niet of is verlopen. Controleer de cijfers, of vraag een nieuwe mail aan.' };
  }

  const sessieToken = maakAdminSessieToken(data.user.id);
  if (sessieToken) (await cookies()).set(ADMIN_SESSIE_COOKIE, sessieToken, sessieCookieOpties());

  const heeftFactor = (data.user.factors ?? []).some((f) => f.status === 'verified');
  return { ok: true, naar: heeftFactor ? '/dashboard/auth/2fa' : '/dashboard' };
}
