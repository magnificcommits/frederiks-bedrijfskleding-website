import Link from 'next/link';
import type { ActiviteitItem } from '@/lib/kms/dashboardStats';
import { nlDelen, plusDagen, DAGEN_LANG, MAANDEN_KORT } from '@/app/dashboard/taken/tijd';
import LegeStaat from './LegeStaat';

const SOORT: Record<ActiviteitItem['soort'], { label: string; stip: string }> = {
  order: { label: 'Order', stip: 'bg-ink-900' },
  offerte: { label: 'Offerte', stip: 'bg-ink-500' },
  lead: { label: 'Lead', stip: 'bg-amber-500' },
  portaal: { label: 'Portaal', stip: 'bg-white border-2 border-ink-400' },
  factuur: { label: 'Factuur', stip: 'bg-green-600' },
};

function dagKop(datum: string, vandaag: string): string {
  if (datum === vandaag) return 'Vandaag';
  if (datum === plusDagen(vandaag, -1)) return 'Gisteren';
  const d = new Date(`${datum}T12:00:00Z`);
  const jaar = datum.slice(0, 4) !== vandaag.slice(0, 4) ? ` ${datum.slice(0, 4)}` : '';
  return `${DAGEN_LANG[d.getUTCDay()]} ${d.getUTCDate()} ${MAANDEN_KORT[d.getUTCMonth()]}${jaar}`;
}

/** Nieuwste orders, offertes, leads, portaalbestellingen en facturen door elkaar, per dag. */
export default function Activiteit({ items, vandaag, toonLogboek = false }: { items: ActiviteitItem[]; vandaag: string; toonLogboek?: boolean }) {
  const groepen: { datum: string; items: (ActiviteitItem & { tijd: string })[] }[] = [];
  for (const i of items) {
    const d = nlDelen(new Date(i.moment));
    const laatste = groepen[groepen.length - 1];
    if (laatste && laatste.datum === d.datum) laatste.items.push({ ...i, tijd: d.tijd });
    else groepen.push({ datum: d.datum, items: [{ ...i, tijd: d.tijd }] });
  }

  return (
    <section className="panel flex h-full flex-col p-4" aria-labelledby="activiteit-kop">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="activiteit-kop" className="font-display text-base font-bold text-ink-900">Recent binnen</h2>
        {toonLogboek && <Link href="/dashboard/audit" className="knop-tekst">Logboek</Link>}
      </div>

      {groepen.length === 0 ? (
        <div className="mt-3 flex-1">
          <LegeStaat
            titel="Nog niets gebeurd"
            tekst="Nieuwe leads, offertes, orders en portaalbestellingen verschijnen hier zodra ze binnenkomen."
          />
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          {groepen.map((g) => (
            <div key={g.datum}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{dagKop(g.datum, vandaag)}</h3>
              <ul className="mt-1">
                {g.items.map((i) => (
                  <li key={i.id}>
                    <Link href={i.href} className="group -mx-2 flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-mist">
                      <span aria-hidden className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${SOORT[i.soort].stip}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink-900 group-hover:underline">{i.titel}</span>
                        {i.detail && <span className="block truncate text-[12px] text-warm">{i.detail}</span>}
                      </span>
                      <span className="shrink-0 pt-px text-[11px] tabular-nums text-ink-400">
                        <span className="sr-only">{SOORT[i.soort].label}, </span>
                        {i.tijd}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
