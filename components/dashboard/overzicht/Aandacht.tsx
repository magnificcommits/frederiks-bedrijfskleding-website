import Link from 'next/link';

export type AandachtItem = {
  key: string;
  aantal: number;
  label: string;
  detail?: string | null;
  href: string;
  /** Urgent = er wacht iemand of er loopt geld weg. Die staan bovenaan, in oranje. */
  urgent?: boolean;
};

/**
 * Wat er op Jessi ligt te wachten, met een directe link naar de lijst waar ze
 * het oppakt. Alleen punten met een aantal; een rij nullen is ruis.
 */
export default function Aandacht({ items }: { items: AandachtItem[] }) {
  const lijst = items.filter((i) => i.aantal > 0).sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent));
  const urgent = lijst.filter((i) => i.urgent).length;

  return (
    <section className="panel flex h-full flex-col p-4" aria-labelledby="aandacht-kop">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id="aandacht-kop" className="font-display text-base font-bold text-ink-900">Vraagt aandacht</h2>
          <p className="mt-0.5 text-[12px] text-warm">
            {lijst.length === 0 ? 'Alles is bij' : urgent > 0 ? `${urgent} ${urgent === 1 ? 'punt' : 'punten'} met haast` : 'Niets met haast'}
          </p>
        </div>
        <Link href="/dashboard/meldingen" className="knop-tekst">Meldingen</Link>
      </div>

      {lijst.length === 0 ? (
        <div className="mt-3 flex flex-1 items-center gap-3 rounded-md border border-dashed border-ink-200 bg-mist/60 px-4 py-5">
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-[15px] font-bold text-green-800">
            &#10003;
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink-900">Niets dat op je ligt te wachten.</p>
            <p className="mt-0.5 text-[13px] text-warm">Geen verlopen taken, vervallen facturen of orders die op goedkeuring wachten.</p>
          </div>
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {lijst.map((i) => (
            <li key={i.key}>
              <Link
                href={i.href}
                className={`group flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                  i.urgent ? 'border-amber-200 bg-amber-50/70 hover:border-amber-300 hover:bg-amber-50' : 'border-line bg-white hover:border-ink-300 hover:bg-mist'
                }`}
              >
                <span
                  className={`flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-md px-1.5 font-display text-[15px] font-bold tabular-nums ${
                    i.urgent ? 'bg-amber-500 text-ink-900' : 'bg-ink-100 text-ink-800'
                  }`}
                >
                  {i.aantal}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[13px] font-semibold ${i.urgent ? 'text-amber-900' : 'text-ink-900'}`}>{i.label}</span>
                  {i.detail && <span className="block truncate text-[12px] text-warm">{i.detail}</span>}
                </span>
                <span aria-hidden className="shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-700">
                  &rarr;
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
