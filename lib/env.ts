/**
 * Veilige toegang tot omgevingsvariabelen. De site bouwt en draait ook
 * zonder dat alles is ingevuld (preview/lokaal); functies die een service
 * nodig hebben (mail, leaddatabase) doen dan niets in plaats van te crashen.
 */
export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.frederiksbedrijfskleding.nl',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  resendFrom: process.env.RESEND_FROM_EMAIL ?? 'Frederiks Bedrijfskleding <offerte@frederiksbedrijfskleding.nl>',
  notifyEmail: process.env.LEAD_NOTIFY_EMAIL ?? 'info@frederiksbedrijfskleding.nl',
  gaId: process.env.NEXT_PUBLIC_GA_ID ?? '',
  // AI (Claude / Anthropic). Functies die AI nodig hebben doen niets zonder key (env-gated).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  // Leaddatabase (Supabase). De service-role key staat ALLEEN server-side.
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  // Wachtwoord voor het interne lead-dashboard (/dashboard).
  dashboardPassword: process.env.DASHBOARD_PASSWORD ?? '',
  // Publieke Supabase-gegevens voor het klantportaal (auth in de browser).
  supabasePublicUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

export const isEmailConfigured = Boolean(env.resendApiKey);
export const isAnalyticsConfigured = Boolean(env.gaId);
export const isAiConfigured = Boolean(env.anthropicApiKey);
export const isLeadsDbConfigured = Boolean(env.supabaseUrl && env.supabaseServiceKey);
export const isDashboardConfigured = Boolean(env.dashboardPassword);
export const isPortalConfigured = Boolean(env.supabasePublicUrl && env.supabaseAnonKey);
