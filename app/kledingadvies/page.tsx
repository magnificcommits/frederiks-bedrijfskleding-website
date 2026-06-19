import type { Metadata } from 'next';
import { KledingadviesWizard } from '@/components/KledingadviesWizard';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Gratis kledingadvies aanvragen',
  description: 'Stel in een minuut samen waar je naar zoekt. Frederiks Bedrijfskleding belt je binnen een werkdag terug met passend advies en komt graag langs om te passen.',
  alternates: { canonical: '/kledingadvies' },
};

const punten = [
  { t: 'Binnen een werkdag contact', d: 'Geen offerterobot. Jessi belt je zelf terug om je wensen door te nemen.' },
  { t: 'Passen op locatie', d: 'We komen bij je langs, ook in grote maten. Jij raakt geen werktijd kwijt.' },
  { t: 'Logo in eigen huis', d: 'Bedrukken en borduren doen we zelf, dus snel en met grip op de kwaliteit.' },
  { t: 'Eén vast aanspreekpunt', d: 'Iemand die je bedrijf kent. Nabestellen gaat daarna met een belletje.' },
];

export default async function KledingadviesPage({ searchParams }: { searchParams: Promise<{ branche?: string }> }) {
  const { branche } = await searchParams;
  return (
    <section className="bg-ink-900">
      <div className="container-x grid gap-12 py-14 sm:py-20 lg:grid-cols-5">
        <div className="text-white lg:col-span-2">
          <p className="eyebrow text-amber-400">Kledingadvies in 1 minuut</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">Vertel ons wat je zoekt</h1>
          <p className="mt-4 text-lg text-ink-100">
            Vier korte vragen. Daarna bellen we je terug met advies dat past bij je werk en je budget. Vrijblijvend, geen verplichtingen.
          </p>
          <ul className="mt-8 space-y-5 border-t border-white/10 pt-8">
            {punten.map((p) => (
              <li key={p.t} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 bg-amber-500" aria-hidden="true" />
                <span><strong className="text-white">{p.t}.</strong> <span className="text-ink-200">{p.d}</span></span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-ink-300">Liever bellen? <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-400 hover:underline">{site.phone}</a></p>
          <div className="mt-8 rounded-xl border-l-2 border-dashed border-amber-500 bg-white/10 px-5 py-4">
            <p className="text-sm text-white">
              <strong className="text-amber-300">{site.owner.split(' ')[0]}</strong> neemt je aanvraag persoonlijk op. Vrijblijvend en binnen 1 werkdag contact.
            </p>
          </div>
        </div>
        <div className="lg:col-span-3">
          <KledingadviesWizard defaultBranche={branche ?? ''} />
        </div>
      </div>
    </section>
  );
}
