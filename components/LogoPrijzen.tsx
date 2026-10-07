import { euro } from '@/lib/kms/prijsindicatie';
import type { Prijsindicatie } from '@/lib/kms/prijsindicatieData';

/** Staffels voor borduren en bedrukken, uit het KMS. Alleen zichtbaar als prijsindicaties aan staan. */
export function LogoPrijzen({ p }: { p: Prijsindicatie }) {
  const kolommen = (techniek: string) =>
    [...new Set(p.staffel.filter((s) => s.techniek === techniek).map((s) => s.vanaf_aantal))].sort((a, b) => a - b);
  const prijs = (techniek: string, formaat: string, aantal: number) =>
    p.staffel.find((s) => s.techniek === techniek && s.formaat === formaat && s.vanaf_aantal === aantal)?.stukprijs;
  const label = (n: number, alle: number[]) => {
    const i = alle.indexOf(n);
    const volgende = alle[i + 1];
    return volgende ? `${n}-${volgende - 1} st.` : `${n}+ st.`;
  };
  const blok = (techniek: string, titel: string) => {
    const k = kolommen(techniek);
    const formaten = p.formaten.filter((f) => f.techniek === techniek && k.some((n) => prijs(techniek, f.formaat, n) != null));
    if (!formaten.length) return null;
    return (
      <div className="min-w-0">
        <h3 className="font-display text-lg font-extrabold text-ink-900">{titel}</h3>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="bg-mist text-left text-xs uppercase tracking-wide text-warm">
                <th className="px-3 py-2">Formaat</th>
                {k.map((n) => (
                  <th key={n} className="px-3 py-2 text-right">{label(n, k)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {formaten.map((f) => (
                <tr key={f.formaat}>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-ink-900">{f.formaat}</span>
                    {f.omschrijving && <span className="ml-1 text-warm">{f.omschrijving}</span>}
                  </td>
                  {k.map((n) => {
                    const v = prijs(techniek, f.formaat, n);
                    return (
                      <td key={n} className="px-3 py-2 text-right tabular-nums">{v != null ? euro(v, 2) : ''}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  return (
    <section className="container-x sec-md">
      <h2 className="kop-2">Wat kost een logo?</h2>
      <p className="mt-2 max-w-[62ch] text-warm">
        Prijs per stuk, excl. btw. Hoe meer stuks per bestelling, hoe lager de prijs. Een borstlogo is meestal formaat S, een groot logo op de rug L
        of XL.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {blok('borduren', 'Borduren')}
        {blok('bedrukken', 'Bedrukken')}
      </div>
      {p.kosten.length > 0 && (
        <ul className="mt-6 space-y-1 text-sm text-warm">
          {p.kosten.map((k) => (
            <li key={`${k.techniek}-${k.soort}`}>
              <span className="font-semibold text-ink-900">{k.techniek === 'borduren' ? 'Borduren' : 'Bedrukken'}:</span>{' '}
              {(k.omschrijving ?? k.soort).replace(/,?\s*excl\.? btw/i, '')} {euro(k.bedrag, 2)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
