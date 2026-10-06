import Link from 'next/link';
import Drawer from '@/components/dashboard/Drawer';
import InloglinkKnop from './InloglinkKnop';
import { koppelGebruiker, wijzigPortaalRol, herstuurUitnodiging } from './actions';
import type { Gebruiker } from '@/lib/portaalAdmin';

const ROLLEN = [
  { id: 'beheerder', label: 'Werkgever', uitleg: 'ziet alles, keurt goed, beheert budgetten' },
  { id: 'leidinggevende', label: 'Leidinggevende', uitleg: 'keurt goed voor zijn team' },
  { id: 'medewerker', label: 'Werknemer', uitleg: 'bestelt zelf binnen zijn budget' },
] as const;

export type KlaarzetStap = { label: string; klaar: boolean; tab: string; uitleg: string };

/**
 * Alles over de klantomgeving op één plek: is hij klaar, wie kan inloggen, met welke
 * rol, wanneer voor het laatst, en iemand toevoegen of opnieuw uitnodigen.
 */
export function PortaalTab({ orgId, orgNaam, gebruikers, logins, stappen, melding }: {
  orgId: string;
  orgNaam: string;
  gebruikers: Gebruiker[];
  logins: Record<string, string | null>;
  stappen: KlaarzetStap[];
  melding: string | null;
}) {
  const klaar = stappen.filter((s) => s.klaar).length;
  const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : null);

  return (
    <>
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-ink-900">Klantomgeving klaarzetten</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${klaar === stappen.length ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {klaar} van {stappen.length} klaar
            </span>
          </div>
          <ol className="mt-4 space-y-2">
            {stappen.map((s, i) => (
              <li key={s.label} className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.klaar ? 'bg-emerald-600 text-white' : 'bg-mist text-ink-700'}`} aria-hidden="true">
                  {s.klaar ? '✓' : i + 1}
                </span>
                <div className="min-w-0 grow">
                  <Link href={`?tab=${s.tab}`} className="font-semibold text-ink-900 hover:underline">{s.label}</Link>
                  <p className="text-[13px] text-warm">{s.uitleg}</p>
                </div>
                <span className="sr-only">{s.klaar ? 'klaar' : 'nog niet klaar'}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="panel bg-mist p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">Zo werkt het portaal</h2>
          <ul className="mt-3 space-y-2 text-[13px] text-ink-800">
            {ROLLEN.map((r) => (
              <li key={r.id}><span className="font-semibold">{r.label}:</span> {r.uitleg}.</li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-warm">
            Inloggen gaat met een code per mail op <span className="font-mono">/portaal/login</span>. Wil je laten zien hoe het eruitziet,
            gebruik dan de knop <span className="font-semibold">Demo portaal openen</span> onderaan het menu.
          </p>
        </div>
      </section>

      <section id="gebruikers" className="mt-10 scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink-900">Wie kan inloggen bij {orgNaam}</h2>
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
                <select id="pt-rol" name="rol" defaultValue="medewerker" className="veld py-2 text-[15px]">
                  {ROLLEN.map((r) => <option key={r.id} value={r.id}>{r.label}: {r.uitleg}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-ink-800">
                <input type="checkbox" name="uitnodigen" defaultChecked />
                Stuur een uitnodiging per mail
              </label>
              <button type="submit" className="self-start knop-donker">Toegang geven</button>
            </form>
          </Drawer>
        </div>
        {melding && <p className="mt-3 rounded-lg border border-line bg-mist px-4 py-2.5 text-[13px] font-semibold text-ink-800">{melding}</p>}

        {gebruikers.length === 0 ? (
          <p className="mt-3 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">
            Nog niemand kan inloggen. Geef minimaal één werkgever toegang, dan kan die zelf zijn team uitnodigen.
          </p>
        ) : (
          <div className="panel mt-3 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>Naam</th><th>E-mail</th><th>Rol</th><th>Laatst ingelogd</th><th>Acties</th></tr>
              </thead>
              <tbody>
                {gebruikers.map((g) => {
                  const login = fmt(logins[(g.email ?? '').toLowerCase()]);
                  return (
                    <tr key={g.id} className="border-b border-line">
                      <td className="font-medium text-ink-900">{g.naam || '-'}</td>
                      <td className="text-warm">{g.email}</td>
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
                      <td className={login ? 'text-ink-800' : 'text-amber-800'}>{login ?? 'Nog nooit'}</td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <form action={herstuurUitnodiging}>
                            <input type="hidden" name="orgId" value={orgId} />
                            <input type="hidden" name="email" value={g.email} />
                            <input type="hidden" name="naam" value={g.naam ?? ''} />
                            <button type="submit" className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">Opnieuw uitnodigen</button>
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
      </section>
    </>
  );
}
