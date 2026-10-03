import Link from 'next/link';
import type { TopKlant } from '@/lib/kms/dashboardStats';
import LegeStaat from './LegeStaat';

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

/** De vijf klanten met de meeste gefactureerde omzet in de laatste twaalf maanden. */
export default function TopKlanten({ klanten }: { klanten: TopKlant[] }) {
  const max = Math.max(1, ...klanten.map((k) => k.bedrag));
  const samen = klanten.reduce((t, k) => t + k.aandeel, 0);

  return (
    <section className="panel flex h-full flex-col p-4" aria-labelledby="top-kop">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 id="top-kop" className="font-display text-base font-bold text-ink-900">Grootste klanten</h2>
          <p className="mt-0.5 text-[12px] text-warm">Gefactureerd, laatste 12 maanden</p>
        </div>
        <Link href="/dashboard/rapportages" className="knop-tekst">Rapportages</Link>
      </div>

      {klanten.length === 0 ? (
        <div className="mt-3 flex-1">
          <LegeStaat
            titel="Nog geen omzet per klant"
            tekst="Na de eerste verstuurde factuur zie je hier wie je belangrijkste klanten zijn en hoeveel van je omzet ze dragen."
            actieHref="/dashboard/klanten"
            actieLabel="Naar klanten"
          />
        </div>
      ) : (
        <>
          <ol className="mt-3 space-y-2.5">
            {klanten.map((k, i) => (
              <li key={k.id ?? k.naam}>
                <Link
                  href={k.id ? `/dashboard/klanten/${k.id}` : '/dashboard/klanten'}
                  className="group -mx-2 block rounded-md px-2 py-1 transition-colors hover:bg-mist"
                >
                  <span className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="w-3 shrink-0 text-[11px] tabular-nums text-ink-400">{i + 1}</span>
                      <span className="truncate font-medium text-ink-900 group-hover:underline">{k.naam}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-900">
                      {euro(k.bedrag)}
                      <span className="ml-1.5 text-[11px] text-ink-400">{Math.round(k.aandeel * 100)}%</span>
                    </span>
                  </span>
                  <span className="ml-5 mt-1 block h-1.5 overflow-hidden rounded-full bg-mist">
                    <span
                      className={`block h-full rounded-full ${i === 0 ? 'bg-amber-500' : 'bg-ink-700'}`}
                      style={{ width: `${Math.max(3, (k.bedrag / max) * 100)}%` }}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          {klanten.length > 1 && (
            <p className="mt-auto pt-3 text-[12px] text-warm">
              Deze {klanten.length} klanten zijn samen goed voor {Math.round(samen * 100)}% van de omzet.
            </p>
          )}
        </>
      )}
    </section>
  );
}
