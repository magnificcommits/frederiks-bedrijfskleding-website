import Link from 'next/link';
import type { AgendaItem } from '@/lib/kms/dashboardStats';
import { DAGEN_KORT, MAANDEN_KORT, plusDagen } from '@/app/dashboard/taken/tijd';

const SOORT_LABEL: Record<AgendaItem['soort'], string> = { afspraak: 'Afspraak', taak: 'Taak', passessie: 'Passessie' };

function Stip({ soort, klaar }: { soort: AgendaItem['soort']; klaar: boolean }) {
  if (klaar) return <span className="block h-2.5 w-2.5 rounded-full bg-green-600 ring-4 ring-white" />;
  if (soort === 'afspraak') return <span className="block h-2.5 w-2.5 rounded-full bg-ink-900 ring-4 ring-white" />;
  if (soort === 'passessie') return <span className="block h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-white" />;
  return <span className="block h-2.5 w-2.5 rounded-[3px] border-2 border-ink-400 bg-white ring-4 ring-white" />;
}

function dagLabel(datum: string, vandaag: string): string {
  if (datum === plusDagen(vandaag, 1)) return 'Morgen';
  const d = new Date(`${datum}T12:00:00Z`);
  return `${DAGEN_KORT[d.getUTCDay()]} ${d.getUTCDate()} ${MAANDEN_KORT[d.getUTCMonth()]}`;
}

/**
 * Wat er vandaag op de planning staat, als tijdlijn. Het eerstvolgende punt krijgt
 * een markering, afgevinkte taken blijven zichtbaar maar grijs. Daaronder een
 * korte blik op de komende dagen.
 */
export default function Vandaag({ items, vandaag, nuTijd }: { items: AgendaItem[]; vandaag: string; nuTijd: string }) {
  const vandaagItems = items.filter((i) => i.datum === vandaag);
  const komend = items.filter((i) => i.datum > vandaag && !i.klaar).slice(0, 5);
  const volgende = vandaagItems.find((i) => !i.klaar && i.tijd && i.tijd >= nuTijd)?.id ?? null;
  const afspraken = vandaagItems.filter((i) => i.soort !== 'taak').length;
  const taken = vandaagItems.filter((i) => i.soort === 'taak').length;
  const klaar = vandaagItems.filter((i) => i.klaar).length;

  return (
    <section className="panel flex h-full flex-col p-4" aria-labelledby="vandaag-kop">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id="vandaag-kop" className="font-display text-base font-bold text-ink-900">Vandaag</h2>
          <p className="mt-0.5 text-[12px] text-warm">
            {vandaagItems.length === 0
              ? 'Niets gepland'
              : [
                  afspraken > 0 ? `${afspraken} ${afspraken === 1 ? 'afspraak' : 'afspraken'}` : null,
                  taken > 0 ? `${taken} ${taken === 1 ? 'taak' : 'taken'}` : null,
                  klaar > 0 ? `${klaar} afgerond` : null,
                ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Link href="/dashboard/taken?weergave=agenda" className="knop-tekst">Agenda</Link>
      </div>

      {vandaagItems.length === 0 ? (
        <div className="mt-3 rounded-md border border-dashed border-ink-200 bg-mist/60 px-4 py-5">
          <p className="text-[13px] font-semibold text-ink-900">Een lege dag in de agenda.</p>
          <p className="mt-1 text-[13px] text-warm">Tijd om offertes na te bellen of een pasdag in te plannen.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard/taken?nieuw=afspraak" className="knop-stil">Afspraak plannen</Link>
            <Link href="/dashboard/taken?nieuw=taak" className="knop-tekst">Taak toevoegen</Link>
          </div>
        </div>
      ) : (
        <ol className="relative mt-3">
          {/* De verticale lijn van de tijdlijn. */}
          <span aria-hidden className="absolute bottom-3 left-[calc(4.125rem-0.5px)] top-3 w-px bg-line" />
          {vandaagItems.map((i) => {
            const isVolgende = i.id === volgende;
            const voorbij = !i.klaar && i.tijd !== null && i.tijd < nuTijd;
            return (
              <li key={`${i.soort}-${i.id}`}>
                <Link
                  href={i.href}
                  className={`group relative -mx-2 flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-mist ${
                    isVolgende ? 'bg-amber-50/70 hover:bg-amber-50' : ''
                  }`}
                >
                  <span className={`w-12 shrink-0 pt-px text-right text-[12px] tabular-nums ${i.tijd ? 'font-semibold text-ink-800' : 'text-ink-400'}`}>
                    {i.tijd ?? 'hele dag'}
                  </span>
                  <span className="relative z-[1] mt-1 flex w-3 shrink-0 justify-center">
                    <Stip soort={i.soort} klaar={i.klaar} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className={`text-[13px] font-semibold ${i.klaar ? 'text-ink-400 line-through' : voorbij ? 'text-ink-600' : 'text-ink-900'} group-hover:underline`}>
                        {i.titel}
                      </span>
                      {isVolgende && <span className="badge-actie">volgende</span>}
                      {i.hoog && !i.klaar && <span className="badge bg-red-50 text-red-700">hoog</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-warm">
                      {[SOORT_LABEL[i.soort], i.eindTijd && i.tijd ? `${i.tijd}–${i.eindTijd}` : null, i.klant, i.locatie]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {komend.length > 0 && (
        <div className="mt-auto pt-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-warm">Komende dagen</h3>
          <ul className="mt-1.5 space-y-0.5">
            {komend.map((i) => (
              <li key={`${i.soort}-${i.id}`}>
                <Link href={i.href} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1 text-[12px] transition-colors hover:bg-mist">
                  <span className="w-16 shrink-0 text-ink-500">{dagLabel(i.datum, vandaag)}</span>
                  <span className="w-10 shrink-0 tabular-nums text-ink-400">{i.tijd ?? ''}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-800">
                    {i.titel}
                    {i.klant && <span className="text-warm"> · {i.klant}</span>}
                  </span>
                  <span className="shrink-0 text-ink-400">{SOORT_LABEL[i.soort]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
