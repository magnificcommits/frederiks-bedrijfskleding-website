import { LeadForm } from '@/components/LeadForm';
import Image from 'next/image';
import { JessiPaneel } from '@/components/JessiPaneel';
import { contactpersoon } from '@/content/vertrouwen';

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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-8">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
            <h2 className="kop-2">{title}</h2>
            <p className="mt-2 max-w-[60ch] text-warm">{intro}</p>
            {contactpersoon.foto && (
              <p className="mt-4 flex items-center gap-3 text-[14px] text-ink-800 md:hidden">
                <Image src={contactpersoon.foto} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full object-cover object-[62%_20%]" />
                <span><span className="font-semibold">{contactpersoon.naam.split(' ')[0]} belt je zelf terug.</span> Geen callcenter.</span>
              </p>
            )}
            <div className="mt-6">
              <LeadForm defaultBranche={defaultBranche} kaal />
            </div>
          </div>
          {/* Telefoon: het paneel is een extra scherm; bellen en WhatsApp staan al in de balk onderin. */}
          <JessiPaneel plek="contact-sectie" className="hidden self-start md:block lg:sticky lg:top-28" />
        </div>
      </div>
    </section>
  );
}
