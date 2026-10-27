import { VOORWAARDEN_INTRO, VOORWAARDEN_PDF, VOORWAARDEN_VERSIE, voorwaarden } from '@/content/algemeneVoorwaarden';
import { bedrijf } from '@/content/bedrijf';

const datum = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${VOORWAARDEN_VERSIE}T12:00:00`));

/** De algemene voorwaarden, voor de website en het klantportaal. */
export default function VoorwaardenTekst() {
  return (
    <div className="text-[15px] leading-relaxed text-ink-800">
      <p className="text-warm">{VOORWAARDEN_INTRO}</p>
      <p className="mt-2 text-[13px] text-warm">
        Versie van {datum}.{' '}
        <a href={VOORWAARDEN_PDF} className="font-semibold text-amber-700 underline-offset-2 hover:underline" download>
          Download als PDF
        </a>
      </p>
      <ol className="mt-8 space-y-8">
        {voorwaarden.map((a) => (
          <li key={a.nummer} id={`artikel-${a.nummer}`} className="scroll-mt-24">
            <h2 className="font-display text-lg font-bold text-ink-900">
              <span className="mr-2 text-amber-700">Artikel {a.nummer}</span>
              {a.titel}
            </h2>
            <ol className="mt-3 space-y-2.5">
              {a.leden.map((l, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-9 shrink-0 tabular-nums text-warm">
                    {a.nummer}.{i + 1}
                  </span>
                  <span>
                    {l.kop && <strong className="block text-ink-900">{l.kop}</strong>}
                    {l.tekst}
                  </span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      <address className="mt-10 border-t border-line pt-5 text-[14px] not-italic text-warm">
        <strong className="text-ink-900">{bedrijf.naam}</strong>
        <br />
        {bedrijf.adres}, {bedrijf.postcode} {bedrijf.plaats}
        <br />
        {bedrijf.email} · {bedrijf.telefoon}
      </address>
    </div>
  );
}
