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
 *
 * De kaart is 100% breed met een maximum van 600px: zo past hij ook op een
 * telefoon zonder dat de lezer opzij moet schuiven.
 */
export function emailLayout({ heading, bodyHtml, preheader }: { heading: string; bodyHtml: string; preheader?: string }): string {
  return `
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader ?? '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f5f4;margin:0;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center" style="padding:24px 10px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e4e2e0;border-radius:14px;overflow:hidden;">
      <tr><td align="center" style="padding:30px 28px 12px;">
        <div style="font-size:24px;font-weight:800;color:#1c1c1c;letter-spacing:0.02em;line-height:1;">FREDERIKS</div>
        <div style="margin-top:5px;font-size:11px;font-weight:700;letter-spacing:0.32em;color:#ec6726;">BEDRIJFSKLEDING</div>
      </td></tr>
      <tr><td style="padding:8px 28px 0;"><div style="border-top:2px dashed #ec6726;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td style="padding:26px 28px 6px;">
        <h1 style="margin:0;color:#1c1c1c;font-size:22px;line-height:1.3;font-weight:800;">${escapeHtml(heading)}</h1>
      </td></tr>
      <tr><td style="padding:8px 28px 30px;color:#52504e;font-size:15px;line-height:1.6;">
        ${bodyHtml}
      </td></tr>
      <tr><td style="background-color:#1c1c1c;padding:22px 28px;">
        <p style="margin:0;color:#ffffff;font-size:13px;font-weight:700;">Frederiks Bedrijfskleding</p>
        <p style="margin:6px 0 0;color:#adadad;font-size:12px;line-height:1.6;">${escapeHtml(site.address.street)}, ${escapeHtml(site.address.postalCode)} ${escapeHtml(site.address.city)}<br/>${escapeHtml(site.phone)} &middot; ${escapeHtml(site.email)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

/**
 * Knop voor de belangrijkste link in een mail. Opgebouwd als tabel met een
 * gekleurde cel, zodat hij ook in Outlook een knop blijft. tekst en href worden
 * hier ge-escaped.
 */
export function emailKnop(tekst: string, href: string, opties: { marge?: string } = {}): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:${opties.marge ?? '22px 0 0'};border-collapse:separate;">
  <tr><td align="center" bgcolor="#ec6726" style="background-color:#ec6726;border-radius:8px;">
    <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(tekst)}</a>
  </td></tr>
</table>`;
}

/**
 * Rustige tabel met gegevens (label links, waarde rechts) voor meldingen.
 * De waarde is al opgemaakte HTML; lege waarden worden een streepje.
 */
export function emailGegevens(rijen: [label: string, waardeHtml: string | null | undefined][]): string {
  const tr = rijen
    .map(
      ([label, waarde]) =>
        `<tr><td valign="top" width="1%" style="padding:8px 18px 8px 0;border-bottom:1px solid #eeeceb;color:#8a8785;font-size:13px;line-height:20px;white-space:nowrap;">${escapeHtml(label)}</td><td valign="top" style="padding:8px 0;border-bottom:1px solid #eeeceb;color:#1c1c1c;font-size:14px;line-height:20px;">${waarde && String(waarde).trim() ? waarde : '<span style="color:#b5b2af;">-</span>'}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0;border-collapse:collapse;border-top:1px solid #eeeceb;">${tr}</table>`;
}

/** Gekleurd kader voor een waarschuwing of korte notitie in een mail. bodyHtml is al opgemaakt. */
export function emailKader(bodyHtml: string, soort: 'fout' | 'let-op' | 'info' = 'info'): string {
  const kleur = { fout: ['#fdecea', '#f5c2c0', '#8a1c14'], 'let-op': ['#fff6e5', '#f3d9a4', '#6b4a0c'], info: ['#f6f5f4', '#e4e2e0', '#1c1c1c'] }[soort];
  return `<div style="margin:16px 0 0;padding:12px 16px;background-color:${kleur[0]};border:1px solid ${kleur[1]};border-radius:10px;color:${kleur[2]};font-size:14px;line-height:1.55;">${bodyHtml}</div>`;
}

/** contentId: de bijlage is ook als inline-afbeelding te tonen met src="cid:<contentId>". */
type SendArgs = { to: string; subject: string; html: string; replyTo?: string; from?: string; attachments?: { filename: string; content: string; contentId?: string }[] };

/**
 * Verstuurt e-mail via Resend. Zonder RESEND_API_KEY wordt er niets verstuurd
 * (en faalt de flow niet), handig voor preview/lokaal.
 */
export async function sendEmail({ to, subject, html, replyTo, from, attachments }: SendArgs): Promise<{ sent: boolean; error?: string }> {
  if (!isEmailConfigured) return { sent: false, error: 'E-mail is niet ingesteld (RESEND_API_KEY ontbreekt).' };
  const { Resend } = await import('resend');
  const resend = new Resend(env.resendApiKey);
  // De Resend-SDK gooit geen fout bij een API-weigering maar geeft { error } terug.
  const { error } = await resend.emails.send({
    from: from || env.resendFrom,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(attachments && attachments.length ? { attachments } : {}),
  });
  if (error) return { sent: false, error: error.message || 'Versturen geweigerd door de mailserver.' };
  return { sent: true };
}
