import Link from 'next/link';
import LegeStaat from '@/components/dashboard/overzicht/LegeStaat';
import { celTekst, type Cel, type KolomSoort, type RapportTabel } from '@/lib/kms/rapportages';

const rechts = (s: KolomSoort) => s === 'euro' || s === 'getal' || s === 'pct';

function CelInhoud({ waarde, soort }: { waarde: Cel; soort: KolomSoort }) {
  const tekst = celTekst(waarde, soort);
  if (!tekst) return <span className="text-ink-300">–</span>;
  return <>{tekst}</>;
}

/** Samenvatting, tabel met totalen en toelichting van één rapport. */
export default function RapportWeergave({ tabel }: { tabel: RapportTabel }) {
  const { kolommen, rijen, totalen, samenvatting, toelichting } = tabel;

  return (
    <div className="space-y-4">
      {samenvatting && samenvatting.length > 0 && rijen.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {samenvatting.map((s) => (
            <div key={s.label} className="panel p-3">
              <dt className="text-[12px] font-medium text-warm">{s.label}</dt>
              <dd className="mt-1 font-display text-lg font-bold tabular-nums text-ink-900">{celTekst(s.waarde, s.soort) || '–'}</dd>
              {s.uitleg && <dd className="mt-0.5 text-[11px] leading-snug text-warm">{s.uitleg}</dd>}
            </div>
          ))}
        </dl>
      )}

      {rijen.length === 0 ? (
        <LegeStaat titel={tabel.leeg.titel} tekst={tabel.leeg.tekst} />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                {kolommen.map((k) => (
                  <th key={k.kop} className={rechts(k.soort) ? 'text-right' : ''}>{k.kop}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rijen.map((r, i) => (
                <tr key={i} className={r.subtotaal ? 'bg-mist font-semibold' : ''}>
                  {r.cellen.map((c, j) => {
                    const k = kolommen[j];
                    const lang = k.kop === 'Artikelen' || k.kop === 'Omschrijving';
                    return (
                      <td key={j} className={`${rechts(k.soort) ? 'num' : ''} ${k.soort === 'datum' ? 'whitespace-nowrap stil' : ''} ${lang ? 'min-w-[260px] text-[12px] text-warm' : ''}`}>
                        {j === 0 && r.href ? (
                          <Link href={r.href} className="rij-link"><CelInhoud waarde={c} soort={k.soort} /></Link>
                        ) : j === 1 && r.href && r.subtotaal ? (
                          <Link href={r.href} className="rij-link"><CelInhoud waarde={c} soort={k.soort} /></Link>
                        ) : (
                          <CelInhoud waarde={c} soort={k.soort} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {totalen && (
              <tfoot>
                <tr className="border-t-2 border-ink-200 bg-mist">
                  {totalen.map((c, j) => (
                    <td key={j} className={`px-3 py-2 text-[13px] font-semibold text-ink-900 ${rechts(kolommen[j].soort) ? 'whitespace-nowrap text-right tabular-nums' : ''}`}>
                      {c === null ? '' : celTekst(c, kolommen[j].soort)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {toelichting && <p className="max-w-3xl text-[12px] leading-snug text-warm">{toelichting}</p>}
    </div>
  );
}
