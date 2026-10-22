'use server';
import { headers } from 'next/headers';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { heeftPortaalToegang } from '@/lib/ssoToegang';
import { ipUitHeaders, loginGeblokkeerd, registreerMisluktePoging } from '@/lib/ratelimit';
import { sendEmail, emailLayout, emailKnop, escapeHtml } from '@/lib/email';
import { isEmailConfigured } from '@/lib/env';

/**
 * Inlogmail voor het portaal via onze eigen mailserver (Resend) in plaats van
 * via de ingebouwde mail van Supabase. Die laatste stuurt maar een paar mails per
 * uur, waardoor Jessi bij het wisselen tussen rollen steeds "te veel inloglinks"
 * kreeg (werkdocument portaal 21 okt, punt 5).
 *
 * De link en de code maakt Supabase zelf (admin.generateLink), dus de beveiliging
 * blijft gelijk: eenmalig, kort geldig. Eigen limiet: 8 mails per adres en 30 per
 * IP-adres per 15 minuten. Lukt het hier niet (mail niet ingesteld), dan valt het
 * scherm terug op de oude manier.
 */
export type InlogmailUitkomst = { ok: true } | { ok: false; reden: 'geen-toegang' | 'te-veel' | 'terugval' };

const PER_ADRES = 8;
const PER_IP = 30;
const VENSTER = 15 * 60_000;

export async function stuurPortaalInlogmail(emailRuw: string): Promise<InlogmailUitkomst> {
  const email = String(emailRuw ?? '').toLowerCase().trim().slice(0, 254);
  if (!email.includes('@')) return { ok: false, reden: 'geen-toegang' };
  const sb = kmsAdmin();
  if (!sb || !isEmailConfigured) return { ok: false, reden: 'terugval' };

  const ip = await ipUitHeaders();
  const sleutelAdres = `portaal-mail:${email}`;
  const sleutelIp = ip ? `portaal-mail-ip:${ip}` : '';
  if (await loginGeblokkeerd([sleutelAdres], PER_ADRES, VENSTER)) return { ok: false, reden: 'te-veel' };
  if (sleutelIp && (await loginGeblokkeerd([sleutelIp], PER_IP, VENSTER))) return { ok: false, reden: 'te-veel' };
  await registreerMisluktePoging([sleutelAdres, sleutelIp]);

  if (!(await heeftPortaalToegang(email))) return { ok: false, reden: 'geen-toegang' };

  const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email });
  const props = data?.properties;
  if (error || !props?.hashed_token) return { ok: false, reden: 'terugval' };

  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim();
  const basis = host ? `https://${host}` : '';
  const link = `${basis}/portaal/auth/bevestig?token_hash=${encodeURIComponent(props.hashed_token)}&type=magiclink`;
  const code = props.email_otp ?? '';

  const html = emailLayout({
    heading: 'Inloggen op het klantportaal',
    preheader: code ? `Je inlogcode is ${code}` : 'Je persoonlijke inloglink voor het klantportaal.',
    bodyHtml: `
      <p style="margin:14px 0 0;">Klik op de knop om in te loggen op het klantportaal van Frederiks Bedrijfskleding.</p>
      ${emailKnop('Inloggen', link)}
      ${code ? `<p style="margin:18px 0 0;">Of vul deze code in op het inlogscherm (handig als je het portaal als app gebruikt):</p>
      <p style="margin:8px 0 0;font-size:28px;font-weight:800;letter-spacing:6px;color:#1c1c1c;">${escapeHtml(code)}</p>` : ''}
      <p style="margin:18px 0 0;color:#6b6460;font-size:13px;">De link en de code werken één keer en zijn een uur geldig. Heb je dit niet aangevraagd? Dan kun je deze mail negeren.</p>`,
  });
  const uit = await sendEmail({ to: email, subject: 'Je inlogcode voor Frederiks Bedrijfskleding', html }).catch(() => ({ sent: false }));
  return uit.sent ? { ok: true } : { ok: false, reden: 'terugval' };
}
