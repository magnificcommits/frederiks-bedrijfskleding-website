import { env, isEmailConfigured } from '@/lib/env';
import { site } from '@/content/site';

/** Escape tegen HTML-injectie in e-mails (klantnaam, toelichting e.d.). */
export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Gebrand e-mailsjabloon in de Frederiks-huisstijl (charcoal + oranje, wordmark,
 * stiksel-accent, footer met bedrijfsgegevens). bodyHtml is al opgemaakte HTML.
 */
export function emailLayout({ heading, bodyHtml, preheader }: { heading: string; bodyHtml: string; preheader?: string }): string {
  return `
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader ?? '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f5f4;margin:0;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border:1px solid #e4e2e0;border-radius:14px;overflow:hidden;">
      <tr><td align="center" style="padding:30px 32px 12px;">
        <div style="font-size:24px;font-weight:800;color:#1c1c1c;letter-spacing:0.02em;line-height:1;">FREDERIKS</div>
        <div style="margin-top:5px;font-size:11px;font-weight:700;letter-spacing:0.32em;color:#ec6726;">BEDRIJFSKLEDING</div>
      </td></tr>
      <tr><td style="padding:8px 32px 0;"><div style="border-top:2px dashed #ec6726;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td style="padding:26px 32px 6px;">
        <h1 style="margin:0;color:#1c1c1c;font-size:22px;font-weight:800;">${escapeHtml(heading)}</h1>
      </td></tr>
      <tr><td style="padding:0 32px 28px;color:#52504e;font-size:15px;line-height:1.6;">
        ${bodyHtml}
      </td></tr>
      <tr><td style="background-color:#1c1c1c;padding:22px 32px;">
        <p style="margin:0;color:#ffffff;font-size:13px;font-weight:700;">Frederiks Bedrijfskleding</p>
        <p style="margin:6px 0 0;color:#adadad;font-size:12px;line-height:1.6;">${escapeHtml(site.address.street)}, ${escapeHtml(site.address.postalCode)} ${escapeHtml(site.address.city)}<br/>${escapeHtml(site.phone)} &middot; ${escapeHtml(site.email)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

type SendArgs = { to: string; subject: string; html: string; replyTo?: string; attachments?: { filename: string; content: string }[] };

/**
 * Verstuurt e-mail via Resend. Zonder RESEND_API_KEY wordt er niets verstuurd
 * (en faalt de flow niet), handig voor preview/lokaal.
 */
export async function sendEmail({ to, subject, html, replyTo, attachments }: SendArgs): Promise<{ sent: boolean }> {
  if (!isEmailConfigured) return { sent: false };
  const { Resend } = await import('resend');
  const resend = new Resend(env.resendApiKey);
  await resend.emails.send({
    from: env.resendFrom,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(attachments && attachments.length ? { attachments } : {}),
  });
  return { sent: true };
}
