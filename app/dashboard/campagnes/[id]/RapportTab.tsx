import { isEmailConfigured } from '@/lib/env';
import { getRapport, type CampagneDetail } from '@/lib/kms/campagnes';
import { DOEL_LABEL, alleKnopen, knoopTitel, type DoelSoort } from '@/lib/campagnes/flow';
import { pct } from '../onderdelen';

function Tegel({ label, waarde, sub }: { label: string; waarde: string | number; sub?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-warm">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink-900">{waarde}</p>
      {sub && <p className="text-[12px] text-warm">{sub}</p>}
    </div>
  );
}

/** Verzonden en geklikt per dag, laatste 30 dagen. Zelf getekend. */
function DagGrafiek({ dagen }: { dagen: { dag: string; verzonden: number; geklikt: number }[] }) {
  const max = Math.max(1, ...dagen.map((d) => d.verzonden));
  const H = 120;
  const n = dagen.length;
  const b = 100 / n;
  const label = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  return (
    <figure>
      <div className="relative">
        <span className="absolute -top-1 left-0 text-[10px] tabular-nums text-ink-400">{max}</span>
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="block h-36 w-full" role="img" aria-label={`Verzonden mails per dag, totaal ${dagen.reduce((s, d) => s + d.verzonden, 0)} in 30 dagen`}>
          <line x1="0" x2="100" y1={H - 0.5} y2={H - 0.5} stroke="#e4e2e0" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2="100" y1={H / 2} y2={H / 2} stroke="#f0eeec" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          {dagen.map((d, i) => {
            const hv = d.verzonden ? Math.max(1.5, (d.verzonden / max) * (H - 8)) : 0;
            const hk = d.geklikt ? Math.max(1.5, (d.geklikt / max) * (H - 8)) : 0;
            return (
              <g key={d.dag}>
                <title>{`${label(d.dag)}: ${d.verzonden} verzonden, ${d.geklikt} geklikt`}</title>
                <rect x={i * b + b * 0.15} y={H - hv} width={b * 0.7} height={hv} fill="#cfcfcf" />
                <rect x={i * b + b * 0.15} y={H - hk} width={b * 0.7} height={hk} fill="#ec6726" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink-400">
        <span>{label(dagen[0]?.dag ?? '')}</span>
        <span>{label(dagen[Math.floor(n / 2)]?.dag ?? '')}</span>
        <span>vandaag</span>
      </div>
      <figcaption className="mt-2 flex gap-4 text-[11px] text-warm">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-ink-200" /> Verzonden
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Daarvan geklikt
        </span>
      </figcaption>
    </figure>
  );
}

export default async function RapportTab({ campagne: c }: { campagne: CampagneDetail }) {
  const r = await getRapport(c.id);
  const stappen = alleKnopen(c.flow.stappen).filter((k) => k.type === 'mail' || k.type === 'voorwaarde' || k.type === 'taak');

  return (
    <div className="mt-4 flex flex-col gap-5">
      {!isEmailConfigured && r.verzonden === 0 && (
        <p className="rounded-md border border-line bg-mist px-4 py-2 text-[13px] text-ink-700">Er is nog niets verstuurd: mail staat niet aan. Zodra Resend is ingesteld vullen deze cijfers zich.</p>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Tegel label="Ingeschreven" waarde={r.totaal} sub={`${c.perStatus.actief ?? 0} nu in de flow`} />
        <Tegel label="Verzonden" waarde={r.verzonden} sub={r.mislukt ? `${r.mislukt} mislukt` : 'niets mislukt'} />
        <Tegel label="Geopend" waarde={pct(r.geopend, r.verzonden)} sub={`${r.geopend} mails`} />
        <Tegel label="Geklikt" waarde={pct(r.geklikt, r.verzonden)} sub={`${r.geklikt} mails`} />
        <Tegel label="Afgemeld" waarde={r.afgemeld} sub={r.afmeldkliks ? `${r.afmeldkliks} keer op afmelden geklikt` : pct(r.afgemeld, r.totaal)} />
        <Tegel label="Adres werkt niet" waarde={r.gebounced} sub="3x geweigerd door de mailserver" />
        <Tegel label="Doel bereikt" waarde={r.doelBereikt} sub={`conversie ${pct(r.doelBereikt, r.totaal)}`} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="panel p-4">
          <h2 className="text-[14px] font-bold text-ink-900">Laatste 30 dagen</h2>
          <div className="mt-4">
            <DagGrafiek dagen={r.perDag} />
          </div>
        </section>
        <section className="panel p-4">
          <h2 className="text-[14px] font-bold text-ink-900">Hoe het afliep</h2>
          <dl className="mt-3 space-y-1.5 text-[13px]">
            {Object.entries(c.perStatus).map(([s, n]) => (
              <div key={s} className="flex justify-between gap-3">
                <dt className="text-warm">{({ actief: 'Nog bezig', klaar: 'Hele flow doorlopen', doel: 'Doel bereikt', afgemeld: 'Afgemeld', gestopt: 'Gestopt', gebounced: 'Adres werkt niet' } as Record<string, string>)[s] ?? s}</dt>
                <dd className="tabular-nums text-ink-900">{n}</dd>
              </div>
            ))}
            {Object.keys(c.perStatus).length === 0 && <p className="text-warm">Nog niemand ingeschreven.</p>}
          </dl>
          {Object.keys(r.doelPerSoort).length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-warm">Doel, per soort</p>
              <ul className="mt-1.5 space-y-1 text-[13px]">
                {Object.entries(r.doelPerSoort).map(([s, n]) => (
                  <li key={s} className="flex justify-between gap-3">
                    <span className="text-warm">{DOEL_LABEL[s as DoelSoort] ?? s}</span>
                    <span className="tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.takenAangemaakt > 0 && <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink-800">{r.takenAangemaakt} taken aangemaakt voor opvolging.</p>}
        </section>
      </div>

      <section className="panel overflow-x-auto">
        <h2 className="px-4 pt-4 text-[14px] font-bold text-ink-900">Per stap</h2>
        <table className="tbl mt-3">
          <thead>
            <tr>
              <th>Stap</th>
              <th className="text-right">Verzonden</th>
              <th className="text-right">Geopend</th>
              <th className="text-right">Geklikt</th>
              <th className="text-right">Mislukt</th>
              <th className="text-right">Wachten nu</th>
            </tr>
          </thead>
          <tbody>
            {stappen.map((k) => {
              const m = c.perMail[k.id];
              const s = r.splitsingen[k.id];
              return (
                <tr key={k.id}>
                  <td className="max-w-[24rem]">
                    <span className="mr-2 text-[11px] font-semibold uppercase tracking-wide text-warm">{k.type === 'mail' ? 'Mail' : k.type === 'taak' ? 'Taak' : 'Splitsing'}</span>
                    <span className="font-semibold text-ink-900">{knoopTitel(k, c.flow)}</span>
                    {s && (
                      <span className="ml-2 text-[12px] text-warm">
                        {s.ja} ja, {s.nee} nee
                      </span>
                    )}
                  </td>
                  <td className="num">{k.type === 'mail' ? m?.verzonden ?? 0 : ''}</td>
                  <td className="num">{k.type === 'mail' && m ? `${pct(m.geopend, m.verzonden)}` : ''}</td>
                  <td className="num">{k.type === 'mail' && m ? `${pct(m.geklikt, m.verzonden)}` : ''}</td>
                  <td className="num">{k.type === 'mail' ? m?.mislukt || '' : ''}</td>
                  <td className="num">{c.opStap[k.id] ?? ''}</td>
                </tr>
              );
            })}
            {stappen.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-warm">
                  Deze campagne heeft nog geen mails.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <p className="text-[12px] leading-relaxed text-warm">
        Over de cijfers: <strong>geopend</strong> is een indicatie. Apple Mail laadt plaatjes vooraf, waardoor mails soms als geopend tellen die niemand las, en Outlook blokkeert ze juist vaak. <strong>Geklikt</strong> is betrouwbaarder, al klikken virusscanners van sommige bedrijven ook links aan. Een echte bounce (adres bestaat niet) zien we pas als de mailserver het direct weigert; meldingen die later binnenkomen vragen nog een Resend-webhook.
      </p>
    </div>
  );
}
