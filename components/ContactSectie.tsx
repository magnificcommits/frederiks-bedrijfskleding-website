import { LeadForm } from '@/components/LeadForm';
import { site } from '@/content/site';

/** Contactsectie met formulier op de pagina zelf. Verlaagt de drempel tot aanvragen. */
export function ContactSectie({
  title = 'Graag komen we met je in contact',
  intro = 'Elke branche en elk bedrijf is anders. Vertel ons wat je zoekt, dan denken we mee en stemmen we alles af op jouw situatie. We nemen snel persoonlijk contact op.',
  defaultBranche = '',
}: { title?: string; intro?: string; defaultBranche?: string }) {
  return (
    <section className="border-t border-line bg-mist">
      <div className="container-x py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Contact</p>
            <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">{title}</h2>
            <p className="mt-4 text-warm">{intro}</p>

            <div className="mt-8 rounded-xl border border-line bg-white p-6">
              <h3 className="text-lg font-bold text-ink-900">Kom gerust langs</h3>
              <p className="mt-2 text-sm text-warm">{site.name}<br />{site.address.street}<br />{site.address.postalCode} {site.address.city}</p>
              <p className="mt-3 text-sm">
                <a href={`tel:${site.phoneIntl}`} className="font-bold text-ink-900 hover:text-amber-600">{site.phone}</a><br />
                <a href={`mailto:${site.email}`} className="font-semibold text-amber-600 hover:underline">{site.email}</a>
              </p>
              <p className="mt-3 text-xs text-warm">{site.openingNote}</p>
            </div>
          </div>
          <div>
            <p className="mb-4 rounded-xl border-l-2 border-dashed border-amber-500 bg-white px-4 py-3 text-sm text-warm">
              <strong className="text-ink-900">{site.owner.split(' ')[0]}</strong> neemt binnen 1 werkdag persoonlijk contact met je op. Vrijblijvend, je zit nergens aan vast.
            </p>
            <LeadForm defaultBranche={defaultBranche} />
          </div>
        </div>
      </div>
    </section>
  );
}
