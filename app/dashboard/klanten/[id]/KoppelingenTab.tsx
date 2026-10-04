import Link from 'next/link';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import { magEigenaar } from '@/lib/kms/adminClient';
import { listApiLog, listSleutels, SCOPE_LABEL } from '@/lib/api/sleutels';
import { listHrMedewerkers, verwerkVerlopenUitDienst } from '@/lib/kms/hrKoppeling';
import NieuweSleutel from './_koppelingen/NieuweSleutel';
import CsvImport from './_koppelingen/CsvImport';
import { trekApiSleutelInActie } from './_koppelingen/actions';

const MELDINGEN: Record<string, { tekst: string; fout?: boolean }> = {
  'sleutel-ingetrokken': { tekst: 'Sleutel ingetrokken. Verzoeken met deze sleutel worden vanaf nu geweigerd.' },
  'geen-eigenaar': { tekst: 'Alleen de eigenaar kan sleutels intrekken.', fout: true },
  mislukt: { tekst: 'Dat is niet gelukt. Probeer het opnieuw.', fout: true },
};

function fmt(d: string | null) {
  if (!d) return 'nog nooit';
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(d));
}

const ACTIE_LABEL: Record<string, string> = {
  lijst: 'lijst opgevraagd',
  ophalen: 'medewerker opgevraagd',
  in_dienst: 'in dienst',
  wijzigen: 'gewijzigd',
  uit_dienst: 'uit dienst',
  csv_import: 'CSV-import',
  geweigerd: 'geweigerd',
  fout: 'fout',
};

/**
 * Koppelingen op de klantkaart: API-sleutels voor het HR-systeem van de klant, het
 * logboek van de API en de CSV-import van medewerkers.
 */
export default async function KoppelingenTab({ orgId, melding }: { orgId: string; melding: string | null }) {
  await verwerkVerlopenUitDienst(orgId);
  const [sleutels, log, medewerkers, eigenaar] = await Promise.all([
    listSleutels(orgId),
    listApiLog(orgId, 15),
    listHrMedewerkers(orgId),
    magEigenaar(),
  ]);
  const m = melding ? MELDINGEN[melding] : null;
  const naamVan = new Map(sleutels.map((s) => [s.id, s.naam]));
  const actief = sleutels.filter((s) => !s.ingetrokken_op);
  const viaApi = medewerkers.filter((x) => x.bron === 'api').length;
  const viaCsv = medewerkers.filter((x) => x.bron === 'csv').length;

  return (
    <div className="space-y-6">
      {m && (
        <p className={`rounded-md border px-4 py-2.5 text-[13px] font-semibold ${m.fout ? 'border-amber-300 bg-amber-50 text-ink-800' : 'border-green-200 bg-green-50 text-green-800'}`} role="status">
          {m.tekst}
        </p>
      )}

      <section className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="font-display text-lg font-bold text-ink-900">HR-koppeling (API)</h2>
            <p className="mt-1 text-[13px] text-warm">
              Met een sleutel geeft het HR-systeem van de klant zelf nieuwe en vertrokken medewerkers door. Bij elke in- of uitdienst komt er een taak voor Jessi.
              Handig vanaf zo&apos;n 75 medewerkers.
            </p>
          </div>
          <Link href="/dashboard/instellingen/api" className="knop-tekst">Uitleg en voorbeelden</Link>
        </div>

        {sleutels.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>Naam</th><th>Sleutel</th><th>Mag</th><th>Aangemaakt</th><th>Laatst gebruikt</th><th /></tr>
              </thead>
              <tbody>
                {sleutels.map((s) => (
                  <tr key={s.id} className={s.ingetrokken_op ? 'opacity-60' : ''}>
                    <td className="font-semibold text-ink-900">{s.naam}</td>
                    <td className="whitespace-nowrap font-mono text-[12px]">fb_live_…{s.laatste4}</td>
                    <td className="stil text-[12px]">{s.scopes.map((x) => SCOPE_LABEL[x]).join(', ')}</td>
                    <td className="stil whitespace-nowrap text-[12px]">{fmt(s.created_at)}{s.aangemaakt_door && <span className="block">{s.aangemaakt_door}</span>}</td>
                    <td className="stil whitespace-nowrap text-[12px]">{fmt(s.laatst_gebruikt)}</td>
                    <td className="text-right">
                      {s.ingetrokken_op ? (
                        <span className="badge bg-mist text-warm">Ingetrokken {fmt(s.ingetrokken_op)}</span>
                      ) : eigenaar ? (
                        <form action={trekApiSleutelInActie}>
                          <input type="hidden" name="organisatie_id" value={orgId} />
                          <input type="hidden" name="sleutel_id" value={s.id} />
                          <ConfirmSubmit className="knop-tekst text-[12px] text-red-700" message={`Sleutel "${s.naam}" intrekken? De koppeling van de klant werkt daarna niet meer tot je een nieuwe sleutel geeft.`}>
                            Intrekken
                          </ConfirmSubmit>
                        </form>
                      ) : (
                        <span className="badge-rust">Actief</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-warm">Nog geen sleutels voor deze klant.</p>
        )}

        <div className="mt-4 border-t border-line pt-4">
          <h3 className="veld-label">Nieuwe sleutel</h3>
          <NieuweSleutel orgId={orgId} magBeheren={eigenaar} />
        </div>

        {(log.length > 0 || actief.length > 0) && (
          <details className="mt-4 border-t border-line pt-4" open={log.length > 0}>
            <summary className="cursor-pointer text-[13px] font-semibold text-ink-800">
              Laatste verzoeken en importen
              {(viaApi > 0 || viaCsv > 0) && <span className="font-normal text-warm"> · {viaApi} medewerkers via de API, {viaCsv} via CSV</span>}
            </summary>
            {log.length ? (
              <div className="mt-2 overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Wanneer</th><th>Wat</th><th>Via</th><th className="num">Status</th></tr></thead>
                  <tbody>
                    {log.map((l) => {
                      const d = l.details ?? {};
                      const wie = typeof d.naam === 'string' ? d.naam : typeof d.personeelsnummer === 'string' ? d.personeelsnummer : null;
                      return (
                        <tr key={l.id}>
                          <td className="stil whitespace-nowrap text-[12px]">{fmt(l.created_at)}</td>
                          <td className="text-[13px]">
                            {ACTIE_LABEL[l.actie ?? ''] ?? l.actie ?? `${l.methode} ${l.pad}`}
                            {wie && <span className="text-warm">: {wie}</span>}
                            {l.actie === 'csv_import' && (
                              <span className="text-warm">: {String(d.aangemaakt ?? 0)} nieuw, {String(d.bijgewerkt ?? 0)} bijgewerkt, {String(d.uit_dienst ?? 0)} uit dienst</span>
                            )}
                          </td>
                          <td className="stil text-[12px]">{l.sleutel_id ? naamVan.get(l.sleutel_id) ?? 'sleutel' : typeof d.door === 'string' ? d.door : 'dashboard'}</td>
                          <td className={`num text-[12px] ${l.status != null && l.status >= 400 ? 'font-semibold text-red-700' : 'stil'}`}>{l.status ?? '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-warm">Nog geen verzoeken ontvangen.</p>
            )}
          </details>
        )}
      </section>

      <section className="panel p-4 sm:p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">Medewerkers importeren uit CSV</h2>
        <p className="mb-3 mt-1 max-w-2xl text-[13px] text-warm">
          Voor klanten zonder koppeling: een export uit hun HR- of salarissysteem. Je ziet eerst wat er gaat gebeuren; pas na &ldquo;importeren&rdquo; wordt er iets opgeslagen.
        </p>
        <CsvImport
          orgId={orgId}
          bestaand={medewerkers.map((x) => ({ personeelsnummer: x.personeelsnummer, email: x.email, status: x.status }))}
        />
      </section>
    </div>
  );
}
