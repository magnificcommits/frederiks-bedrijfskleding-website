import { CtaBand } from '@/components/CtaBand';

/**
 * Contactsectie onderaan subpagina's. Vroeger een formulier; nu dezelfde
 * afsluiter als de homepage met WhatsApp, e-mail en bellen (werkdocument Jessi,
 * 20 okt 2026). De props blijven bestaan zodat pagina's niet hoeven te wijzigen.
 */
export function ContactSectie({
  title = 'Klaar voor bedrijfskleding die klopt?',
  intro,
}: { title?: string; intro?: string; defaultBranche?: string }) {
  const tekst = intro && !/naam en e-mailadres|formulier|terugbellen|bellen je terug/i.test(intro)
    ? intro
    : 'Vertel me wat je zoekt. Ik denk met je mee en maak een passend voorstel voor jouw bedrijfskleding.';
  return <div id="contact"><CtaBand title={title} text={tekst} plek="contact-sectie" /></div>;
}
