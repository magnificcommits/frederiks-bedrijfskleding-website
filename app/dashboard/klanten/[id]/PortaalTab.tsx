import Drawer from '@/components/dashboard/Drawer';
import InloglinkKnop from './InloglinkKnop';
import { koppelGebruiker, wijzigPortaalRol, herstuurUitnodiging } from './actions';
import type { Gebruiker } from '@/lib/portaalAdmin';
import type { PortaalActiviteit } from '@/lib/kms/crm';

const ROLLEN = [
  { id: 'beheerder', label: 'Werkgever', uitleg: 'ziet alles, keurt goed, beheert team en budgetten' },
  { id: 'leidinggevende', label: 'Leidinggevende', uitleg: 'keurt bestellingen goed, ziet de hele organisatie' },
  { id: 'medewerker', label: 'Werknemer', uitleg: 'bestelt zelf binnen zijn budget, ziet alleen zijn eigen bestellingen' },
] as const;

/** Leesbare tekst per logboekactie. */
const ACTIE: Record<string, string> = {
  portaalgebruiker_gekoppeld: 'gaf portaaltoegang',
  portaalgebruiker_rol: 'wijzigde een rol',
  portaal_uitnodiging_verstuurd: 'uitnodiging gemaild',
  portaal_uitnodiging_mislukt: 'uitnodiging kon niet worden gemaild',
  portaal_order_goedgekeurd: 'keurde een bestelling goed',
  portaal_order_afgewezen: 'wees een bestelling af',
  portaal_bestelling_geplaatst: 'plaatste een bestelling',
  portaal_pakket_besteld: 'bestelde een pakket',
  portaal_drukproef_beoordeeld: 'beoordeelde een drukproef',
  portaal_retour_aangevraagd: 'vroeg een retour aan',
  portaal_reparatie_aangevraagd: 'meldde een reparatie',
  portaal_klacht_gemeld: 'meldde een klacht of vraag',
  portaal_teamlid_toegevoegd: 'voegde een teamlid toe',
  portaal_toegang_gegeven: 'gaf iemand toegang',
  portaal_rol_gewijzigd: 'wijzigde een rol',
  portaal_toegang_ingetrokken: 'trok iemands toegang in',
  portaal_budget_gewijzigd: 'paste een budget aan',
};

const fmtDatum = (d: string | null | undefined, metTijd = false) =>
  d ? new Date(d).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', ...(metTijd ? { hour: '2-digit', minute: '2-digit' } : {}) }) : null;

/**
 * Alles over het portaal van deze klant op één plek: wie kan inloggen, met welke rol,
 * of de uitnodiging is aangekomen, wanneer iemand voor het laatst inlogde, en wat er
 * in het portaal is gebeurd.
 */
export function PortaalTab({ orgId, orgNaam, gebruikers, logins, activiteit, mailAan, inlogUrl, melding }: {
  orgId: string;
  orgNaam: string;
  gebruikers: Gebruiker[];
  logins: Record<string, string | null>;
  activiteit: PortaalActiviteit[];
  mailAan: boolean;
  inlogUrl: string;
  melding: string | null;
}) {
  // Laatste uitnodiging per adres (activiteit is nieuwste eerst).
  const uitnodiging = new Map<string, { op: string; ok: boolean }>();
  for (const a of activiteit) {
    if (a.actie !== 'portaal_uitnodiging_verstuurd' && a.actie !== 'portaal_uitnodiging_mislukt') continue;
    const e = String(a.details?.email ?? '').toLowerCase();
    if (e && !uitnodiging.has(e)) uitnodiging.set(e, { op: a.created_at, ok: a.actie === 'portaal_uitnodiging_verstuurd' });
  }

  return (
    <>
      {!mailAan && (
        <div className="mb-6 rounded-xl border-2 border-amber-400 bg-amber-50 px-5 py-4 text-[14px] text-ink-900" role="status">
          <p className="font-bold">Uitnodigingen worden nu niet gemaild</p>
          <p className="mt-1 text-ink-800">
            De e-mailkoppeling (Resend) is nog niet ingesteld. Toegang geven werkt wel, maar laat de klant zelf weten dat hij kan
            inloggen op <span className="font-mono">{inlogUrl}</span> met zijn e-mailadres.
          </p>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-ink-900">Wie kan inloggen bij {orgNaam}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <a href={`/dashboard/klanten/${orgId}/uitnodiging`} target="_blank" rel="noopener" className="rounded-md border border-line px-3 py-1.5 text-[13px] font-semibold text-ink-800 hover:bg-mist">
                Voorbeeld uitnodiging
              </a>
              <Drawer knop="Persoon toegang geven" titel="Toegang tot het portaal">
                <form action={koppelGebruiker} className="mt-4 flex flex-col gap-3">
                  <input type="hidden" name="orgId" value={orgId} />
                  <div>
                    <label className="veld-label" htmlFor="pt-email">E-mail</label>
                    <input id="pt-email" name="email" type="email" required placeholder="naam@bedrijf.nl" className="veld py-2 text-[15px]" />
                  </div>
                  <div>
                    <label className="veld-label" htmlFor="pt-naam">Naam</label>
                    <input id="pt-naam" name="naam" placeholder="Naam" className="veld py-2 text-[15px]" />
                  </div>
                  <div>
                    <label className="veld-label" htmlFor="pt-rol">Rol</label>
                    <select id="pt-rol" name="rol" defaultValue="beheerder" className="veld py-2 text-[15px]">
                      {ROLLEN.map((r) => <option key={r.id} value={r.id}>{r.label}: {r.uitleg}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-[13px] text-ink-800">
                    <input type="checkbox" name="uitnodigen" defaultChecked />
                    Stuur een uitnodiging per mail
                  </label>
                  <p className="text-[12px] text-warm">Begin met één werkgever. Die kan in het portaal zelf zijn team toevoegen en uitnodigen.</p>
                  <button type="submit" className="self-start knop-donker">Toegang geven</button>
                </form>
              </Drawer>
            </div>
          </div>
          {melding && <p className="mt-3 rounded-lg border border-line bg-mist px-4 py-2.5 text-[13px] font-semibold text-ink-800">{melding}</p>}

          {gebruikers.length === 0 ? (
            <p className="mt-3 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">
              Nog niemand kan inloggen. Geef eerst één werkgever toegang.
            </p>
          ) : (
            <div className="panel mt-3 overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr><th>Naam en e-mail</th><th>Rol</th><th>Uitnodiging</th><th>Laatst ingelogd</th><th>Acties</th></tr>
                </thead>
                <tbody>
                  {gebruikers.map((g) => {
                    const adres = (g.email ?? '').toLowerCase();
                    const login = fmtDatum(logins[adres], true);
                    const uit = uitnodiging.get(adres);
                    return (
                      <tr key={g.id} className="border-b border-line align-top">
                        <td>
                          <p className="font-medium text-ink-900">{g.naam || '-'}</p>
                          <p className="text-[13px] text-warm">{g.email}</p>
                        </td>
                        <td>
                          <form action={wijzigPortaalRol} className="flex items-center gap-1.5">
                            <input type="hidden" name="orgId" value={orgId} />
                            <input type="hidden" name="gebruikerId" value={g.id} />
                            <label className="sr-only" htmlFor={`rol-${g.id}`}>Rol van {g.email}</label>
                            <select id={`rol-${g.id}`} name="rol" defaultValue={g.rol} className="rounded-md border border-line bg-white px-2 py-1 text-[13px]">
                              {ROLLEN.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                            </select>
                            <button type="submit" className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">Opslaan</button>
                          </form>
                        </td>
                        <td className="text-[13px]">
                          {uit ? (
                            <span className={uit.ok ? 'text-emerald-800' : 'font-semibold text-amber-800'}>
                              {uit.ok ? 'Gemaild' : 'Niet aangekomen'} {fmtDatum(uit.op)}
                            </span>
                          ) : (
                            <span className="text-warm">Niet verstuurd</span>
                          )}
                        </td>
                        <td className={`text-[13px] ${login ? 'text-ink-800' : 'font-semibold text-amber-800'}`}>{login ?? 'Nog nooit'}</td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <form action={herstuurUitnodiging}>
                              <input type="hidden" name="orgId" value={orgId} />
                              <input type="hidden" name="email" value={g.email} />
                              <input type="hidden" name="naam" value={g.naam ?? ''} />
                              <button type="submit" className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">
                                {uit ? 'Opnieuw uitnodigen' : 'Uitnodigen'}
                              </button>
                            </form>
                            <InloglinkKnop gebruikerId={g.id} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="panel bg-mist p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">Zo werkt het</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] text-ink-800">
            <li>Geef één persoon toegang als <span className="font-semibold">werkgever</span>. Hij krijgt een uitnodiging per mail.</li>
            <li>Hij gaat naar het portaal, vult zijn e-mailadres in en krijgt een inloglink met code. Geen wachtwoord.</li>
            <li>In het portaal voegt hij zelf zijn team toe. Iedereen die hij toegang geeft, krijgt ook een uitnodiging.</li>
            <li>Hier zie je of de uitnodiging is gemaild, wanneer iemand voor het laatst inlogde en wat er gebeurde.</li>
          </ol>
          <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-[13px] text-ink-800">
            {ROLLEN.map((r) => <li key={r.id}><span className="font-semibold">{r.label}:</span> {r.uitleg}.</li>)}
          </ul>
          <p className="mt-3 text-[12px] text-warm">Alleen adressen die hier of door de werkgever zijn toegevoegd kunnen inloggen. Een onbekend adres krijgt geen code.</p>
        </aside>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Activiteit in het portaal</h2>
        {activiteit.length === 0 ? (
          <p className="mt-3 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog niets gebeurd. Uitnodigingen, bestellingen en goedkeuringen verschijnen hier.</p>
        ) : (
          <div className="panel mt-3 overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Wanneer</th><th>Wie</th><th>Wat</th></tr></thead>
              <tbody>
                {activiteit.map((a) => {
                  const wie = a.actor === 'dashboard-wachtwoord' ? 'Frederiks (KMS)' : a.actor ?? '-';
                  const email = typeof a.details?.email === 'string' ? ` (${a.details.email})` : '';
                  return (
                    <tr key={a.id} className="border-b border-line">
                      <td className="whitespace-nowrap text-[13px] text-warm">{fmtDatum(a.created_at, true)}</td>
                      <td className="text-[13px] text-ink-800">{wie}</td>
                      <td className="text-[13px] text-ink-900">{(ACTIE[a.actie] ?? a.actie.replace(/_/g, ' ')) + email}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
