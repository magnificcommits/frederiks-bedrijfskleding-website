import Link from 'next/link';
import Drawer from '@/components/dashboard/Drawer';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import type { Werknemer, PasdagGegevens } from '@/lib/kms/werknemers';
import type { Afdeling, Vestiging } from '@/lib/kms/structuur';
import type { Contactpersoon } from '@/lib/kms/crm';
import {
  nieuweWerknemerActie,
  werkWerknemerActie,
  zetWerknemerActiefActie,
  contactNaarWerknemerActie,
  bulkWerknemersActie,
} from './actions';
import PasdagMaten from './PasdagMaten';
import WerknemersInvoer from '../_delen/WerknemersInvoer';

/**
 * Tabblad Werknemers op de klantpagina: wie er bij de klant werkt, in welke
 * afdeling, en op de pasdag per werknemer de maten.
 *
 * Werknemers zijn iets anders dan contactpersonen: een contactpersoon is degene
 * met wie Jessi contact heeft (inkoop, administratie), een werknemer draagt de
 * kleding. Orders, maten en het portaal gaan over werknemers.
 */
export default function WerknemersTab({
  orgId,
  orgNaam,
  werknemers,
  afdelingen,
  vestigingen,
  contactpersonen,
  pasdag,
  openWerknemerId = null,
  melding = null,
}: {
  orgId: string;
  orgNaam: string;
  werknemers: Werknemer[];
  afdelingen: Afdeling[];
  vestigingen: Vestiging[];
  contactpersonen: Contactpersoon[];
  pasdag: PasdagGegevens;
  /** Net toegevoegde werknemer: zijn maten klappen meteen open. */
  openWerknemerId?: string | null;
  /** Terugmelding na meerdere tegelijk toevoegen. */
  melding?: string | null;
}) {
  const afdelingNaam = new Map(afdelingen.map((a) => [a.id, a.naam]));
  const vestigingNaam = new Map(vestigingen.map((v) => [v.id, v.naam]));
  const actief = werknemers.filter((w) => w.actief);
  const nonActief = werknemers.filter((w) => !w.actief);
  const netToegevoegd = openWerknemerId ? actief.find((w) => w.id === openWerknemerId) ?? null : null;

  // Contactpersonen die nog geen werknemer zijn (zelfde e-mail of naam).
  const bekend = new Set(
    werknemers.flatMap((w) => [w.naam.trim().toLowerCase(), (w.email ?? '').trim().toLowerCase()]).filter(Boolean),
  );
  const nogGeenWerknemer = contactpersonen.filter(
    (c) => !bekend.has((c.email ?? '').trim().toLowerCase()) && !bekend.has(c.naam.trim().toLowerCase()),
  );

  function matenTekst(w: Werknemer): string {
    const sleutels = pasdag.perWerknemer[w.id] ?? [];
    if (sleutels.length === 0) return 'geen artikelen';
    const maten = pasdag.maten[w.id] ?? {};
    const ingevuld = sleutels.filter((s) => {
      const a = pasdag.artikelen[s];
      return Boolean(a && maten[a.product_id]?.maat);
    }).length;
    return `${ingevuld} van ${sleutels.length}`;
  }

  function formulier(w: Werknemer | null) {
    return (
      <form action={w ? werkWerknemerActie : nieuweWerknemerActie} className="flex flex-col gap-4">
        <input type="hidden" name="orgId" value={orgId} />
        {w && <input type="hidden" name="werknemerId" value={w.id} />}
        <div>
          <label className="veld-label" htmlFor={`wn-naam-${w?.id ?? 'nieuw'}`}>Naam</label>
          <input
            id={`wn-naam-${w?.id ?? 'nieuw'}`}
            name="naam"
            required
            defaultValue={w?.naam ?? ''}
            placeholder="Voor- en achternaam"
            className="veld"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="veld-label" htmlFor={`wn-afd-${w?.id ?? 'nieuw'}`}>Afdeling</label>
            <select id={`wn-afd-${w?.id ?? 'nieuw'}`} name="afdeling_id" defaultValue={w?.afdeling_id ?? ''} className="veld">
              <option value="">Geen afdeling</option>
              {afdelingen.map((a) => (
                <option key={a.id} value={a.id}>{a.naam}</option>
              ))}
            </select>
            {afdelingen.length === 0 && (
              <p className="veld-hint">Nog geen afdelingen. Die maak je aan op het tabblad Afdelingen.</p>
            )}
          </div>
          {vestigingen.length > 0 && (
            <div>
              <label className="veld-label" htmlFor={`wn-vest-${w?.id ?? 'nieuw'}`}>Vestiging</label>
              <select id={`wn-vest-${w?.id ?? 'nieuw'}`} name="vestiging_id" defaultValue={w?.vestiging_id ?? ''} className="veld">
                <option value="">Geen vestiging</option>
                {vestigingen.map((v) => (
                  <option key={v.id} value={v.id}>{v.naam}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="veld-label" htmlFor={`wn-mail-${w?.id ?? 'nieuw'}`}>E-mail</label>
            <input id={`wn-mail-${w?.id ?? 'nieuw'}`} name="email" type="email" defaultValue={w?.email ?? ''} placeholder="naam@bedrijf.nl" className="veld" />
            <p className="veld-hint">Met dit adres kan de werknemer zelf bestellen in het portaal.</p>
          </div>
          <div>
            <label className="veld-label" htmlFor={`wn-tel-${w?.id ?? 'nieuw'}`}>Telefoon</label>
            <input id={`wn-tel-${w?.id ?? 'nieuw'}`} name="telefoon" defaultValue={w?.telefoon ?? ''} placeholder="06 12 34 56 78" className="veld" />
          </div>
        </div>
        <div>
          <label className="veld-label" htmlFor={`wn-pnr-${w?.id ?? 'nieuw'}`}>Personeelsnummer (optioneel)</label>
          <input id={`wn-pnr-${w?.id ?? 'nieuw'}`} name="personeelsnummer" defaultValue={w?.personeelsnummer ?? ''} className="veld" />
        </div>
        <div>
          <label className="veld-label" htmlFor={`wn-opm-${w?.id ?? 'nieuw'}`}>Opmerkingen over kleding</label>
          <textarea
            id={`wn-opm-${w?.id ?? 'nieuw'}`}
            name="opmerkingen"
            rows={3}
            defaultValue={w?.opmerkingen ?? ''}
            placeholder="Bijv. broek altijd 2 cm inkorten"
            className="veld"
          />
        </div>
        <button type="submit" className="knop-donker self-start px-4 py-2.5 text-[15px]">
          {w ? 'Wijzigingen opslaan' : 'Werknemer toevoegen'}
        </button>
      </form>
    );
  }

  function rij(w: Werknemer) {
    return (
      <tr key={w.id} className={w.actief ? '' : 'opacity-70'}>
        <td className="font-semibold text-ink-900">
          {w.naam}
          {w.personeelsnummer && <span className="ml-2 text-[12px] font-normal text-warm">nr. {w.personeelsnummer}</span>}
          {w.opmerkingen && <span className="mt-0.5 block text-[12px] font-normal text-warm">{w.opmerkingen}</span>}
        </td>
        <td className="stil">
          {w.afdeling_id ? afdelingNaam.get(w.afdeling_id) ?? 'onbekende afdeling' : '—'}
          {w.vestiging_id && vestigingNaam.get(w.vestiging_id) && (
            <span className="block text-[12px]">{vestigingNaam.get(w.vestiging_id)}</span>
          )}
        </td>
        <td className="stil">{[w.email, w.telefoon].filter(Boolean).join(' · ') || '—'}</td>
        <td className="stil whitespace-nowrap">{w.actief ? matenTekst(w) : '—'}</td>
        <td>
          <div className="flex flex-wrap justify-end gap-2">
            <Drawer knop="Bewerken" titel={`Werknemer bewerken: ${w.naam}`} knopKlasse="knop-stil">
              {formulier(w)}
            </Drawer>
            <form action={zetWerknemerActiefActie}>
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="werknemerId" value={w.id} />
              <input type="hidden" name="actief" value={w.actief ? 'false' : 'true'} />
              {w.actief ? (
                <ConfirmSubmit
                  message={`${w.naam} op non-actief zetten? De werknemer verdwijnt uit het portaal en uit de keuzelijsten, maar orders en maten blijven bewaard.`}
                  className="knop-stil"
                >
                  Non-actief
                </ConfirmSubmit>
              ) : (
                <button type="submit" className="knop-stil">Weer actief</button>
              )}
            </form>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <h2 className="font-display text-xl font-bold text-ink-900">Werknemers</h2>
            <p className="mt-1 text-[14px] text-warm">
              De mensen bij {orgNaam} die de kleding dragen. Een werknemer hoort bij een afdeling en krijgt het
              assortiment van de hele klant plus dat van zijn afdeling. Contactpersonen (bijv. inkoop) staan apart op
              het tabblad Contact.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Drawer
              knop="Meerdere tegelijk / plakken uit Excel"
              titel="Meerdere werknemers toevoegen"
              beschrijving={`Typ de namen onder elkaar (Enter = volgende) of plak een lijst uit Excel. Afdelingen die nog niet bestaan bij ${orgNaam} worden aangemaakt.`}
              breedte="sm:max-w-4xl"
              knopKlasse="knop-stil"
            >
              <WerknemersInvoer
                afdelingen={afdelingen.map((a) => ({ id: a.id, naam: a.naam }))}
                actie={bulkWerknemersActie}
                verborgen={{ orgId }}
                plakkenOpen
                knoppen={
                  <button type="submit" className="knop-donker self-start px-4 py-2.5 text-[15px]">
                    Werknemers opslaan
                  </button>
                }
              />
            </Drawer>
            <Drawer
              knop="Uitgebreid toevoegen"
              titel="Werknemer toevoegen"
              beschrijving={`Nieuwe werknemer bij ${orgNaam}, met alle velden. Alleen de naam is verplicht.`}
              knopKlasse="knop-stil"
            >
              {formulier(null)}
            </Drawer>
          </div>
        </div>

        {/* Snel toevoegen: één rij, Enter = opslaan. Daarna klapt bij de pasdag
            hieronder meteen 'Maten invullen' open voor deze werknemer. De key
            maakt het formulier na elke toevoeging weer leeg. */}
        <form
          key={openWerknemerId ?? 'leeg'}
          action={nieuweWerknemerActie}
          className="panel mt-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.2fr_1.5fr_auto] lg:items-end"
        >
          <input type="hidden" name="orgId" value={orgId} />
          <div>
            <label className="veld-label" htmlFor="snel-naam">Werknemer toevoegen</label>
            <input id="snel-naam" name="naam" required placeholder="Voor- en achternaam" autoComplete="off" className="veld" />
          </div>
          <div>
            <label className="veld-label" htmlFor="snel-afd">Afdeling</label>
            <select id="snel-afd" name="afdeling_id" defaultValue="" className="veld">
              <option value="">{afdelingen.length === 0 ? 'Nog geen afdelingen' : 'Geen afdeling'}</option>
              {afdelingen.map((a) => (
                <option key={a.id} value={a.id}>{a.naam}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="veld-label" htmlFor="snel-mail">E-mail (optioneel)</label>
            <input id="snel-mail" name="email" type="email" placeholder="naam@bedrijf.nl" autoComplete="off" className="veld" />
          </div>
          <div>
            <label className="veld-label" htmlFor="snel-opm">Opmerkingen (optioneel)</label>
            <input id="snel-opm" name="opmerkingen" placeholder="Bijv. broek 2 cm korter" autoComplete="off" className="veld" />
          </div>
          <button type="submit" className="knop-primair whitespace-nowrap">Toevoegen en maten invullen</button>
        </form>

        {netToegevoegd && (
          <p role="status" className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-[14px] text-green-800">
            {netToegevoegd.naam} staat erbij. Vul hieronder bij Pasdag meteen de maten in, of voeg de volgende toe.
          </p>
        )}
        {melding && !netToegevoegd && (
          <p role="status" className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-[14px] text-green-800">
            {melding.slice(0, 600)}
          </p>
        )}

        {nogGeenWerknemer.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-[14px] font-semibold text-amber-900">
              Contactpersonen die nog geen werknemer zijn
            </p>
            <p className="mt-0.5 text-[13px] text-amber-900">
              Draagt een contactpersoon ook kleding? Zet hem dan met één klik om; naam, e-mail en telefoon gaan mee.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {nogGeenWerknemer.map((c) => (
                <li key={c.id}>
                  <form action={contactNaarWerknemerActie} className="flex items-center gap-2 rounded-md border border-amber-200 bg-white px-3 py-1.5">
                    <input type="hidden" name="orgId" value={orgId} />
                    <input type="hidden" name="contactId" value={c.id} />
                    <span className="text-[14px] text-ink-900">{c.naam}</span>
                    <button type="submit" className="knop-tekst text-amber-800">Maak werknemer</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}

        {actief.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-[14px] text-warm">
            Nog geen werknemers. Typ hierboven een naam, plak een lijst uit Excel, of zet een contactpersoon om.
          </p>
        ) : (
          <div className="panel mt-4 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Naam</th>
                  <th>Afdeling</th>
                  <th>Contact</th>
                  <th>Maten</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>{actief.map(rij)}</tbody>
            </table>
          </div>
        )}

        {nonActief.length > 0 && (
          <details className="panel mt-4 p-4">
            <summary className="cursor-pointer text-[14px] font-semibold text-ink-900">
              Niet meer actief ({nonActief.length})
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="tbl">
                <tbody>{nonActief.map(rij)}</tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      <section id="pasdag" className="mt-12 scroll-mt-24">
        <div className="max-w-3xl">
          <h2 className="font-display text-xl font-bold text-ink-900">Pasdag: maten noteren</h2>
          <p className="mt-1 text-[14px] text-warm">
            Klap een werknemer open en kies per artikel de maat. Je ziet alleen de artikelen die voor die werknemer in
            het assortiment staan, in de kleur die voor deze klant vastligt. Met Opslaan en volgende werknemer ga je
            meteen door. Wil je liever een losse passessie met een order erachter, gebruik dan{' '}
            <Link href="/dashboard/passessie" className="font-semibold text-amber-700 hover:text-amber-800">
              Passessies
            </Link>
            .
          </p>
        </div>
        <div className="mt-4">
          <PasdagMaten
            key={netToegevoegd ? netToegevoegd.id : 'pasdag'}
            orgId={orgId}
            werknemers={actief.map((w) => ({
              id: w.id,
              naam: w.naam,
              afdeling: w.afdeling_id ? afdelingNaam.get(w.afdeling_id) ?? null : null,
              opmerkingen: w.opmerkingen,
            }))}
            gegevens={pasdag}
            startOpenId={netToegevoegd ? netToegevoegd.id : null}
          />
        </div>
      </section>
    </>
  );
}
