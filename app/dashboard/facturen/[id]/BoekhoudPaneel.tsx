import Link from 'next/link';
import type { Factuur } from '@/lib/kms/facturen';
import { boekhoudWeergave, getSyncLog, SYNC_ACTIE_LABEL } from '@/lib/kms/boekhouding';
import { isMoneybirdGeconfigureerd, moneybirdFactuurUrl, MB_STATUS_LABEL } from '@/lib/kms/moneybird';
import BoekhoudBadge from '@/components/dashboard/BoekhoudBadge';
import { naarMoneybirdActie, statusOphalenActie } from '../boekhoudActions';

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
function fmtTijd(d: string | null | undefined) {
  if (!d) return '-';
  try { return new Date(d).toLocaleString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }); }
  catch { return d; }
}

/** Paneel "Boekhouding" op de factuurpagina: Moneybird-status, knoppen en logboek. */
export default async function BoekhoudPaneel({ factuur, totaalKms }: { factuur: Factuur; totaalKms: number }) {
  const gekoppeld = isMoneybirdGeconfigureerd();
  const log = await getSyncLog({ factuurId: factuur.id, limiet: 5 });
  const weergave = boekhoudWeergave(factuur);
  const concept = factuur.status === 'concept';
  const mbTotaal = factuur.moneybird_totaal != null ? Number(factuur.moneybird_totaal) : null;
  const verschil = mbTotaal != null && Math.abs(mbTotaal - totaalKms) >= 0.01;
  // Een poging die langer dan 5 minuten "bezig" is, is afgebroken (bv. time-out): dan mag het opnieuw.
  const vastgelopen = weergave === 'bezig' && (!factuur.moneybird_gesynct_op || Date.now() - Date.parse(factuur.moneybird_gesynct_op) > 5 * 60_000);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-ink-900">Boekhouding</h2>
        {!concept && <BoekhoudBadge factuur={factuur} />}
      </div>

      {concept ? (
        <p className="mt-2 text-[13px] text-warm">Een concept gaat nog niet naar de boekhouding. Zet de factuur eerst op Verzonden.</p>
      ) : (
        <dl className="mt-3 space-y-1.5 text-sm">
          {factuur.moneybird_status && (
            <div className="flex justify-between gap-3"><dt className="text-warm">In Moneybird</dt><dd className="text-ink-900">{MB_STATUS_LABEL[factuur.moneybird_status] ?? factuur.moneybird_status}</dd></div>
          )}
          {factuur.moneybird_gesynct_op && (
            <div className="flex justify-between gap-3"><dt className="text-warm">Laatst bijgewerkt</dt><dd className="text-right text-ink-900">{fmtTijd(factuur.moneybird_gesynct_op)}</dd></div>
          )}
          {mbTotaal != null && (
            <div className="flex justify-between gap-3"><dt className="text-warm">Totaal in Moneybird</dt><dd className={verschil ? 'font-semibold text-red-700' : 'text-ink-900'}>{euro(mbTotaal)}</dd></div>
          )}
        </dl>
      )}

      {verschil && (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Het totaal in Moneybird wijkt af van deze factuur ({euro(totaalKms)}). Is de factuur na het doorzetten nog gewijzigd? Pas hem dan ook in Moneybird aan.
        </p>
      )}
      {factuur.boekhouding_fout && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{factuur.boekhouding_fout}</p>
      )}

      {!concept && (
        <div className="mt-3 flex flex-col gap-2">
          {gekoppeld && weergave !== 'doorgezet' && (
            <form action={naarMoneybirdActie}>
              <input type="hidden" name="factuurId" value={factuur.id} />
              <button type="submit" disabled={weergave === 'bezig' && !vastgelopen} className="knop-donker w-full disabled:opacity-50">
                {weergave === 'fout' || vastgelopen ? 'Opnieuw proberen' : weergave === 'bezig' ? 'Wordt doorgezet...' : 'Naar Moneybird'}
              </button>
            </form>
          )}
          {gekoppeld && factuur.moneybird_factuur_id && (
            <form action={statusOphalenActie}>
              <input type="hidden" name="factuurId" value={factuur.id} />
              <button type="submit" className="knop-stil w-full">Status ophalen</button>
            </form>
          )}
          {factuur.moneybird_factuur_id && gekoppeld && (
            <a href={moneybirdFactuurUrl(factuur.moneybird_factuur_id)} target="_blank" rel="noopener noreferrer" className="knop-tekst w-full text-center">Openen in Moneybird</a>
          )}
          <a href={`/dashboard/facturen/${factuur.id}/ubl`} className="knop-stil w-full text-center" download>UBL downloaden</a>
        </div>
      )}

      {!gekoppeld && !concept && (
        <p className="mt-3 text-[12px] text-warm">
          Moneybird is nog niet gekoppeld, dus doorzetten kan nog niet. UBL downloaden werkt wel; dat bestand lees je in elk boekhoudpakket in.{' '}
          <Link href="/dashboard/instellingen/boekhouding" className="font-semibold text-amber-700 hover:text-amber-800">Zo zet je de koppeling aan</Link>
        </p>
      )}

      {log.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-warm">Logboek</h3>
          <ul className="mt-2 space-y-2 text-[12px]">
            {log.map((l) => (
              <li key={l.id}>
                <span className={l.gelukt ? 'font-semibold text-green-800' : 'font-semibold text-red-700'}>{l.gelukt ? 'Gelukt' : 'Mislukt'}</span>
                <span className="text-warm"> · {SYNC_ACTIE_LABEL[l.actie] ?? l.actie} · {fmtTijd(l.created_at)}</span>
                {l.melding && <span className="block text-ink-700">{l.melding}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
