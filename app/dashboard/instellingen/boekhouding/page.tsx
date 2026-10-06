import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { getBoekhoudInstellingen, getSyncLog, koppelBtwTarieven, SYNC_ACTIE_LABEL, type NaAanmaken } from '@/lib/kms/boekhouding';
import { isMoneybirdGeconfigureerd, mbBtwTarieven, mbOmzetGrootboeken, moneybirdAdministratieId, moneybirdToken, type MbGrootboek } from '@/lib/kms/moneybird';
import { opslaanBoekhoudingActie, testVerbindingActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Boekhouding', robots: { index: false, follow: false } };

const NA_AANMAKEN_TEKST: Record<NaAanmaken, { titel: string; uitleg: string }> = {
  concept: { titel: 'Als concept laten staan', uitleg: 'Je controleert en maakt hem zelf definitief in Moneybird.' },
  definitief: { titel: 'Definitief maken, niet mailen', uitleg: 'Aanbevolen. De klant krijgt de factuur al uit het KMS; Moneybird boekt hem en kan de betaling koppelen.' },
  email: { titel: 'Versturen per e-mail via Moneybird', uitleg: 'Moneybird mailt de factuur ook naar de klant. Let op: dan krijgt de klant hem twee keer als je ook uit het KMS mailt.' },
};

function fmtTijd(d: string) {
  try { return new Date(d).toLocaleString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }); }
  catch { return d; }
}

function JaNee({ ja }: { ja: boolean }) {
  return ja ? (
    <span className="inline-block rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">Ja</span>
  ) : (
    <span className="inline-block rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">Nee</span>
  );
}

export default async function BoekhoudingInstellingenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fout?: string; test?: string; testfout?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const sp = await searchParams;

  const tokenAanwezig = Boolean(moneybirdToken());
  const adminId = moneybirdAdministratieId();
  const gekoppeld = isMoneybirdGeconfigureerd();
  const [instellingen, log, grootboekRes, btwRes] = await Promise.all([
    getBoekhoudInstellingen(),
    getSyncLog({ limiet: 15 }),
    gekoppeld ? mbOmzetGrootboeken() : Promise.resolve(null),
    gekoppeld ? mbBtwTarieven() : Promise.resolve(null),
  ]);
  const grootboeken: MbGrootboek[] | null = grootboekRes && grootboekRes.ok ? grootboekRes.data : null;
  const btwKoppeling = btwRes && btwRes.ok ? koppelBtwTarieven(btwRes.data) : null;
  const ophaalFout = (grootboekRes && !grootboekRes.ok && grootboekRes.melding) || (btwRes && !btwRes.ok && btwRes.melding) || null;

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Boekhouding</h1>
        <Link href="/dashboard/instellingen" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar instellingen</Link>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-warm">
        Facturen uit het KMS gaan rechtstreeks naar Moneybird, zodat niemand ze nog een keer hoeft in te voeren. Betalingen die Moneybird ziet, komen elke ochtend terug in het KMS.
        Werk je met een ander pakket? Gebruik dan de export (CSV of UBL) op de <Link href="/dashboard/facturen" className="font-semibold text-amber-700 hover:text-amber-800">facturenpagina</Link>.
      </p>

      {sp.ok && <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">Instellingen opgeslagen.</p>}
      {sp.fout && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-800">Opslaan is niet gelukt. Probeer het nog eens.</p>}
      {sp.test && <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">De verbinding werkt. Gekoppeld aan administratie: {sp.test}</p>}
      {sp.testfout && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-800" role="alert">{sp.testfout}</p>}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="font-display text-lg font-bold text-ink-900">Koppeling met Moneybird</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3"><dt className="text-warm">API-token aanwezig</dt><dd><JaNee ja={tokenAanwezig} /></dd></div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-warm">Administratie-ID</dt>
              <dd>{adminId ? <span className="font-mono text-[13px] text-ink-900">{adminId}</span> : <JaNee ja={false} />}</dd>
            </div>
          </dl>
          {gekoppeld ? (
            <form action={testVerbindingActie} className="mt-4">
              <button type="submit" className="knop-donker">Verbinding testen</button>
            </form>
          ) : (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
              <p className="font-semibold">Zo zet je de koppeling aan</p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5">
                <li>Maak in Moneybird een persoonlijk API-token met rechten voor Verkoop, Contacten en Instellingen (Moneybird: je naam rechtsboven &gt; Ontwikkelaars).</li>
                <li>Zoek je administratie-ID: het lange getal in de adresbalk na moneybird.com/.</li>
                <li>Zet beide in Vercel als <code>MONEYBIRD_API_TOKEN</code> en <code>MONEYBIRD_ADMINISTRATIE_ID</code> (Production) en deploy opnieuw.</li>
              </ol>
              <p className="mt-2">De volledige uitleg staat in <code>docs/boekhouding-koppelen.md</code>. Tot die tijd werkt alles behalve doorzetten: de export van CSV en UBL kan altijd.</p>
            </div>
          )}
          {ophaalFout && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{ophaalFout}</p>}

          {btwKoppeling && (
            <div className="mt-4 border-t border-line pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-warm">Btw-tarieven</h3>
              <p className="mt-1 text-[12px] text-warm">Zo worden de tarieven uit het KMS gekoppeld aan die van Moneybird.</p>
              <ul className="mt-2 space-y-1 text-sm">
                {[21, 9, 0].map((p) => {
                  const t = btwKoppeling.get(p);
                  return (
                    <li key={p} className="flex justify-between gap-3">
                      <span className="text-warm">{p}% in het KMS</span>
                      {t ? <span className="text-ink-900">{t.name}</span> : <span className="font-semibold text-red-700">Geen tarief in Moneybird</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        <section className="panel p-4">
          <h2 className="font-display text-lg font-bold text-ink-900">Doorzetten</h2>
          <form action={opslaanBoekhoudingActie} className="mt-3 flex flex-col gap-4">
            <div>
              <label htmlFor="grootboek_id" className="veld-label">Standaard grootboekrekening (omzet)</label>
              {grootboeken && grootboeken.length > 0 ? (
                <select id="grootboek_id" name="grootboek_id" defaultValue={instellingen.grootboekId} className="veld">
                  <option value="">Standaard van Moneybird</option>
                  {instellingen.grootboekId && !grootboeken.some((g) => String(g.id) === instellingen.grootboekId) && (
                    <option value={instellingen.grootboekId}>Onbekende rekening ({instellingen.grootboekId})</option>
                  )}
                  {grootboeken.map((g) => (
                    <option key={g.id} value={String(g.id)}>{g.account_id ? `${g.account_id} · ` : ''}{g.name}</option>
                  ))}
                </select>
              ) : (
                <input id="grootboek_id" name="grootboek_id" inputMode="numeric" defaultValue={instellingen.grootboekId} placeholder="Leeg = standaard van Moneybird" className="veld" />
              )}
              <p className="veld-hint">Hierop boekt Moneybird de omzet van elke factuurregel. Leeg laten mag: dan kiest Moneybird zijn standaard omzetrekening.</p>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="auto_doorzetten" defaultChecked={instellingen.autoDoorzetten} className="mt-0.5 h-4 w-4 rounded border-line text-amber-600 focus:ring-amber-200" />
              <span>
                <span className="font-semibold text-ink-900">Automatisch doorzetten bij definitief maken</span>
                <span className="block text-[12px] text-warm">Zodra een factuur van Concept naar Verzonden of Betaald gaat (ook bij mailen naar de klant), gaat hij naar Moneybird. Lukt dat niet, dan probeert het systeem het elke ochtend opnieuw.</span>
              </span>
            </label>

            <fieldset>
              <legend className="veld-label">Wat Moneybird met een nieuwe factuur doet</legend>
              <div className="mt-1 space-y-2">
                {(Object.keys(NA_AANMAKEN_TEKST) as NaAanmaken[]).map((k) => (
                  <label key={k} className="flex items-start gap-2 text-sm">
                    <input type="radio" name="na_aanmaken" value={k} defaultChecked={instellingen.naAanmaken === k} className="mt-0.5 h-4 w-4 border-line text-amber-600 focus:ring-amber-200" />
                    <span>
                      <span className="font-semibold text-ink-900">{NA_AANMAKEN_TEKST[k].titel}</span>
                      <span className="block text-[12px] text-warm">{NA_AANMAKEN_TEKST[k].uitleg}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <button type="submit" className="self-start knop-donker">Opslaan</button>
          </form>
        </section>

        <section className="panel p-4 lg:col-span-2">
          <h2 className="font-display text-lg font-bold text-ink-900">Logboek</h2>
          <p className="mt-1 text-xs text-warm">De laatste pogingen, gelukt of niet. Per factuur staat het logboek ook op de factuurpagina.</p>
          {log.length === 0 ? (
            <p className="mt-3 text-sm text-warm">Nog niets gebeurd.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Wanneer</th>
                    <th>Wat</th>
                    <th>Resultaat</th>
                    <th>Melding</th>
                    <th className="hidden sm:table-cell">Door</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((l) => (
                    <tr key={l.id} className="border-b border-line align-top">
                      <td className="whitespace-nowrap text-warm">{fmtTijd(l.created_at)}</td>
                      <td className="whitespace-nowrap">
                        {l.factuur_id ? <Link href={`/dashboard/facturen/${l.factuur_id}`} className="font-semibold text-amber-700 hover:text-amber-800">{SYNC_ACTIE_LABEL[l.actie] ?? l.actie}</Link> : SYNC_ACTIE_LABEL[l.actie] ?? l.actie}
                      </td>
                      <td>{l.gelukt ? <span className="font-semibold text-green-800">Gelukt</span> : <span className="font-semibold text-red-700">Mislukt</span>}</td>
                      <td className="text-ink-700">{l.melding ?? '-'}</td>
                      <td className="hidden text-warm sm:table-cell">{l.actor ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
