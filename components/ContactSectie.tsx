import { LeadForm } from '@/components/LeadForm';
import { JessiPaneel } from '@/components/JessiPaneel';

/**
 * Contactsectie met formulier op de pagina zelf. Formulier en het paneel met
 * Jessi staan naast elkaar over de volle breedte, even hoog, zonder lege kolom.
 */
export function ContactSectie({
  title = 'Vertel wat je zoekt, wij bellen je terug',
  intro = 'Alleen je naam en e-mailadres zijn nodig. De rest helpt ons om goed voorbereid terug te bellen.',
  defaultBranche = '',
}: { title?: string; intro?: string; defaultBranche?: string }) {
  return (
    <section className="border-t border-line bg-mist" id="contact">
      <div className="container-x sec-md">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-8">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
            <h2 className="kop-2">{title}</h2>
            <p className="mt-2 max-w-[60ch] text-warm">{intro}</p>
            <div className="mt-6">
              <LeadForm defaultBranche={defaultBranche} kaal />
            </div>
          </div>
          <JessiPaneel plek="contact-sectie" className="self-start lg:sticky lg:top-28" />
        </div>
      </div>
    </section>
  );
}
