'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { adminSessieStatus, dashAuthed } from '@/lib/kms/adminClient';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import { logAudit } from '@/lib/kms/audit';

/**
 * Tweestapsverificatie (authenticator-app) koppelen en ontkoppelen voor de
 * ingelogde beheerder. Werkt alleen met een eigen account (e-maillink), niet met
 * het gedeelde wachtwoord: de koppeling hoort bij één persoon.
 */

export type KoppelStart =
  | { ok: true; factorId: string; qr: string; sleutel: string }
  | { ok: false; fout: string };

/** QR-code als base64-data-URL (robuuster in een <img> dan de ruwe svg-tekst). */
function qrAlsDataUrl(qr: string): string {
  const svg = qr.startsWith('data:') ? qr.slice(qr.indexOf(',') + 1) : qr;
  let tekst = svg;
  try {
    tekst = decodeURIComponent(svg);
  } catch {
    // Was niet ge-encodeerd; gebruik zoals hij is.
  }
  return `data:image/svg+xml;base64,${Buffer.from(tekst, 'utf8').toString('base64')}`;
}

async function eigenAccount() {
  if (!(await dashAuthed())) return null;
  const status = await adminSessieStatus();
  if (status.status !== 'ok') return null;
  const sb = await getServerSupabase();
  if (!sb) return null;
  return { sb, status };
}

export async function startKoppeling(): Promise<KoppelStart> {
  const ctx = await eigenAccount();
  if (!ctx) return { ok: false, fout: 'Log in met je eigen account (e-maillink) om dit in te stellen.' };
  const { sb } = ctx;
  try {
    // Halve koppelingen van een eerdere poging opruimen, anders weigert Supabase een nieuwe.
    const { data: lijst } = await sb.auth.mfa.listFactors();
    for (const f of lijst?.all ?? []) {
      if (f.status !== 'verified' && f.factor_type === 'totp') {
        await sb.auth.mfa.unenroll({ factorId: f.id });
      }
    }
    const naam = `Authenticator-app ${new Date().toLocaleDateString('nl-NL')} ${Date.now().toString().slice(-4)}`;
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: naam, issuer: 'Frederiks KMS' });
    if (error || !data || data.type !== 'totp') {
      return { ok: false, fout: 'Koppelen lukt nu niet. Probeer het later opnieuw.' };
    }
    return { ok: true, factorId: data.id, qr: qrAlsDataUrl(data.totp.qr_code), sleutel: data.totp.secret };
  } catch {
    return { ok: false, fout: 'Koppelen lukt nu niet. Probeer het later opnieuw.' };
  }
}

export async function bevestigKoppeling(factorId: string, codeRuw: string): Promise<{ ok: boolean; fout?: string }> {
  const ctx = await eigenAccount();
  if (!ctx) return { ok: false, fout: 'Log in met je eigen account (e-maillink) om dit in te stellen.' };
  const code = String(codeRuw ?? '').replace(/\D/g, '');
  if (code.length !== 6) return { ok: false, fout: 'Vul de 6 cijfers uit de app in.' };
  if (!factorId) return { ok: false, fout: 'Begin opnieuw met koppelen.' };
  try {
    const { error } = await ctx.sb.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) return { ok: false, fout: 'Deze code klopt niet. Probeer de nieuwste code uit de app.' };
  } catch {
    return { ok: false, fout: 'Bevestigen lukt nu niet. Probeer het opnieuw.' };
  }
  await logAudit('tweestapsverificatie_aangezet', {
    entiteit: 'beveiliging',
    entiteitId: ctx.status.userId,
    actor: ctx.status.email,
  });
  revalidatePath('/dashboard/beveiliging');
  return { ok: true };
}

export async function ontkoppel(formData: FormData) {
  const ctx = await eigenAccount();
  if (!ctx) redirect('/dashboard/beveiliging?fout=account');
  const factorId = String(formData.get('factor_id') ?? '');
  let gelukt = false;
  try {
    // Alleen een eigen factor mag worden ontkoppeld.
    const { data: lijst } = await ctx.sb.auth.mfa.listFactors();
    const eigen = (lijst?.all ?? []).find((f) => f.id === factorId);
    if (eigen) {
      const { error } = await ctx.sb.auth.mfa.unenroll({ factorId });
      gelukt = !error;
    }
  } catch {
    gelukt = false;
  }
  if (!gelukt) redirect('/dashboard/beveiliging?fout=ontkoppelen');
  await logAudit('tweestapsverificatie_uitgezet', {
    entiteit: 'beveiliging',
    entiteitId: ctx.status.userId,
    actor: ctx.status.email,
  });
  revalidatePath('/dashboard/beveiliging');
  redirect('/dashboard/beveiliging?ok=ontkoppeld');
}
