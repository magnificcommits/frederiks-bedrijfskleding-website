import crypto from 'crypto';
import { env } from '@/lib/env';

/**
 * Afmeldlink voor campagnes en nieuwsbrieven. Los bestand zonder zware imports,
 * zodat /afmelden en de nieuwsbrief dit kunnen gebruiken zonder de hele
 * verzendmotor mee te laden. campagne-engine.ts exporteert dezelfde functies.
 */

// Zonder CRON_SECRET viel dit terug op een vaste tekst uit de broncode: dan kon
// iedereen geldige afmeldlinks maken. Eerst de service key als geheim gebruiken.
const AFMELD_GEHEIM = env.cronSecret || env.supabaseServiceKey || 'frederiks-afmeld-fallback';

/** Token om een afmeldlink te valideren, zodat niet zomaar iedereen adressen kan afmelden. */
export function afmeldToken(email: string): string {
  return crypto.createHmac('sha256', AFMELD_GEHEIM).update(email.toLowerCase()).digest('hex').slice(0, 16);
}

export function afmeldUrl(email: string): string {
  const base = env.siteUrl.replace(/\/$/, '');
  return `${base}/afmelden?e=${encodeURIComponent(email)}&t=${afmeldToken(email)}`;
}
