'use server';
import { redirect } from 'next/navigation';
import { adminSessieStatus } from '@/lib/kms/adminClient';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import { ipUitHeaders, loginGeblokkeerd, registreerMisluktePoging } from '@/lib/ratelimit';
import { logAudit } from '@/lib/kms/audit';

/**
 * Tweede inlogstap: de 6-cijferige code uit de authenticator-app controleren.
 * Maximaal 5 foute codes per e-mailadres en per IP-adres per 15 minuten.
 */
export async function bevestigTweeStap(formData: FormData) {
  const status = await adminSessieStatus();
  if (status.status === 'ok') redirect('/dashboard');
  if (status.status !== '2fa-nodig') redirect('/dashboard');

  const ip = await ipUitHeaders();
  const sleutels = [`email:${status.email}`, ip ? `ip:${ip}` : ''];
  if (await loginGeblokkeerd(sleutels)) redirect('/dashboard/auth/2fa?fout=geblokkeerd');

  const code = String(formData.get('code') ?? '').replace(/\D/g, '');
  if (code.length !== 6) redirect('/dashboard/auth/2fa?fout=formaat');

  const sb = await getServerSupabase('dashboard');
  if (!sb) redirect('/dashboard');

  let gelukt = false;
  try {
    const { data: factoren } = await sb.auth.mfa.listFactors();
    const factor = factoren?.totp?.find((f) => f.status === 'verified');
    if (factor) {
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      gelukt = !error;
    }
  } catch {
    gelukt = false;
  }

  if (!gelukt) {
    await registreerMisluktePoging(sleutels);
    redirect('/dashboard/auth/2fa?fout=code');
  }
  await logAudit('ingelogd_met_tweestapsverificatie', { entiteit: 'beveiliging', actor: status.email });
  redirect('/dashboard');
}
