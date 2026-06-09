/**
 * Veilige toegang tot omgevingsvariabelen. De site bouwt en draait ook
 * zonder dat alles is ingevuld (preview/lokaal); het contactformulier toont
 * dan een nette melding in plaats van te crashen.
 */
export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.frederiksbedrijfskleding.nl',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  resendFrom: process.env.RESEND_FROM_EMAIL ?? 'Frederiks Bedrijfskleding <offerte@frederiksbedrijfskleding.nl>',
  notifyEmail: process.env.LEAD_NOTIFY_EMAIL ?? 'info@frederiksbedrijfskleding.nl',
  gaId: process.env.NEXT_PUBLIC_GA_ID ?? '',
};

export const isEmailConfigured = Boolean(env.resendApiKey);
export const isAnalyticsConfigured = Boolean(env.gaId);
