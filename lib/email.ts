import { env, isEmailConfigured } from '@/lib/env';

/** Escape tegen HTML-injectie in e-mails (klantnaam, toelichting e.d.). */
export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type SendArgs = { to: string; subject: string; html: string; replyTo?: string };

/**
 * Verstuurt e-mail via Resend. Zonder RESEND_API_KEY wordt er niets verstuurd
 * (en faalt de flow niet) — handig voor preview/lokaal.
 */
export async function sendEmail({ to, subject, html, replyTo }: SendArgs): Promise<{ sent: boolean }> {
  if (!isEmailConfigured) return { sent: false };
  const { Resend } = await import('resend');
  const resend = new Resend(env.resendApiKey);
  await resend.emails.send({
    from: env.resendFrom,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
  return { sent: true };
}
