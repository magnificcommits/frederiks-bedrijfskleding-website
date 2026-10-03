'use client';

import { useRef, useState, type ReactNode } from 'react';
import { slaContactenOpActie } from './actions';

export type BestaandContact = {
  id: string;
  naam: string;
  functie: string | null;
  email: string | null;
  telefoon: string | null;
  hoofdcontact: boolean;
  facturatie: boolean;
  heeftPortaal: boolean;
  isWerknemer: boolean;
};

type Rij = {
  sleutel: number;
  id: string;
  naam: string;
  functie: string;
  email: string;
  telefoon: string;
  hoofdcontact: boolean;
  facturatie: boolean;
  portaal: boolean;
  werknemer: boolean;
  /** Al geregeld bij een bestaand contact: vinkje staat vast. */
  heeftPortaal: boolean;
  isWerknemer: boolean;
};

/**
 * Stap 2 van de wizard: contactpersonen als rijen. Per rij kies je wie het
 * hoofdcontact is en wie de facturen krijgt (allebei hoogstens één), of hij mag
 * inloggen op het portaal en of hij zelf ook kleding draagt.
 */
export default function StapContacten({
  klantId,
  bestaande,
  knoppen,
}: {
  klantId: string;
  bestaande: BestaandContact[];
  knoppen: ReactNode;
}) {
  const teller = useRef(1);
  const nieuweRij = (eerste: boolean): Rij => ({
    sleutel: teller.current++,
    id: '',
    naam: '',
    functie: '',
    email: '',
    telefoon: '',
    hoofdcontact: eerste,
    facturatie: false,
    portaal: false,
    werknemer: false,
    heeftPortaal: false,
    isWerknemer: false,
  });
  const [rijen, setRijen] = useState<Rij[]>(() =>
    bestaande.length > 0
      ? bestaande.map((c) => ({
          sleutel: teller.current++,
          id: c.id,
          naam: c.naam,
          functie: c.functie ?? '',
          email: c.email ?? '',
          telefoon: c.telefoon ?? '',
          hoofdcontact: c.hoofdcontact,
          facturatie: c.facturatie,
          portaal: c.heeftPortaal,
          werknemer: c.isWerknemer,
          heeftPortaal: c.heeftPortaal,
          isWerknemer: c.isWerknemer,
        }))
      : [nieuweRij(true)],
  );
  const [fout, setFout] = useState<string | null>(null);

  function zet<K extends keyof Rij>(sleutel: number, veld: K, waarde: Rij[K]) {
    setFout(null);
    setRijen((huidig) => huidig.map((r) => (r.sleutel === sleutel ? { ...r, [veld]: waarde } : r)));
  }

  // Hoofdcontact en facturatie: er kan er maar één zijn. Nog eens klikken zet hem uit.
  function kiesEen(sleutel: number, veld: 'hoofdcontact' | 'facturatie') {
    setRijen((huidig) =>
      huidig.map((r) => ({ ...r, [veld]: r.sleutel === sleutel ? !r[veld] : false })),
    );
  }

  const zonderNaam = rijen.some((r) => !r.naam.trim() && (r.email.trim() || r.telefoon.trim() || r.functie.trim()));

  return (
    <form
      action={slaContactenOpActie}
      onSubmit={(e) => {
        if (zonderNaam) {
          e.preventDefault();
          setFout('Er is een rij met gegevens maar zonder naam. Vul de naam in of haal de rij weg.');
        }
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="klantId" value={klantId} />
      <input
        type="hidden"
        name="rijen"
        value={JSON.stringify(
          rijen.map((r) => ({
            id: r.id,
            naam: r.naam,
            functie: r.functie,
            email: r.email,
            telefoon: r.telefoon,
            hoofdcontact: r.hoofdcontact,
            facturatie: r.facturatie,
            portaal: r.portaal && !r.heeftPortaal,
            werknemer: r.werknemer && !r.isWerknemer,
          })),
        )}
      />

      <ul className="flex flex-col gap-3">
        {rijen.map((r, i) => (
          <li key={r.sleutel} className="panel p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-warm">
                {r.id ? 'Contactpersoon' : `Nieuwe contactpersoon ${rijen.filter((x) => !x.id).indexOf(r) + 1}`}
              </p>
              {!r.id && (
                <button
                  type="button"
                  onClick={() => setRijen((h) => (h.length > 1 ? h.filter((x) => x.sleutel !== r.sleutel) : [nieuweRij(true)]))}
                  className="knop-tekst"
                >
                  Weghalen
                </button>
              )}
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="veld-label" htmlFor={`cp-naam-${r.sleutel}`}>Naam</label>
                <input
                  id={`cp-naam-${r.sleutel}`}
                  value={r.naam}
                  onChange={(e) => zet(r.sleutel, 'naam', e.target.value)}
                  placeholder="Voor- en achternaam"
                  autoFocus={i === 0 && !r.id}
                  className="veld"
                />
              </div>
              <div>
                <label className="veld-label" htmlFor={`cp-functie-${r.sleutel}`}>Functie</label>
                <input
                  id={`cp-functie-${r.sleutel}`}
                  value={r.functie}
                  onChange={(e) => zet(r.sleutel, 'functie', e.target.value)}
                  placeholder="Bijv. inkoop"
                  className="veld"
                />
              </div>
              <div>
                <label className="veld-label" htmlFor={`cp-mail-${r.sleutel}`}>E-mail</label>
                <input
                  id={`cp-mail-${r.sleutel}`}
                  type="email"
                  value={r.email}
                  onChange={(e) => zet(r.sleutel, 'email', e.target.value)}
                  placeholder="naam@bedrijf.nl"
                  className="veld"
                />
              </div>
              <div>
                <label className="veld-label" htmlFor={`cp-tel-${r.sleutel}`}>Telefoon</label>
                <input
                  id={`cp-tel-${r.sleutel}`}
                  value={r.telefoon}
                  onChange={(e) => zet(r.sleutel, 'telefoon', e.target.value)}
                  placeholder="06 12 34 56 78"
                  className="veld"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-ink-900">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={r.hoofdcontact}
                  onChange={() => kiesEen(r.sleutel, 'hoofdcontact')}
                  className="h-4 w-4"
                />
                Hoofdcontact
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={r.facturatie}
                  onChange={() => kiesEen(r.sleutel, 'facturatie')}
                  className="h-4 w-4"
                />
                Krijgt de facturen
              </label>
              <label className={`flex items-center gap-2 ${!r.email.trim() && !r.heeftPortaal ? 'text-warm' : ''}`}>
                <input
                  type="checkbox"
                  checked={r.portaal}
                  disabled={r.heeftPortaal || !r.email.trim()}
                  onChange={(e) => zet(r.sleutel, 'portaal', e.target.checked)}
                  className="h-4 w-4"
                />
                {r.heeftPortaal ? 'Kan al inloggen op het portaal' : 'Mag inloggen op het portaal'}
                {!r.email.trim() && !r.heeftPortaal && <span className="text-[12px]">(vul eerst een e-mail in)</span>}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={r.werknemer}
                  disabled={r.isWerknemer}
                  onChange={(e) => zet(r.sleutel, 'werknemer', e.target.checked)}
                  className="h-4 w-4"
                />
                {r.isWerknemer ? 'Staat al bij de werknemers' : 'Draagt zelf ook kleding'}
              </label>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setRijen((h) => [...h, nieuweRij(!h.some((r) => r.hoofdcontact))])}
        className="knop-stil self-start"
      >
        Nog een contactpersoon
      </button>

      <p className="text-[13px] text-warm">
        Facturen gaan naar het e-mailadres van wie de facturen krijgt. Kies je niemand, dan gaan ze naar het
        factuur-e-mailadres uit stap 1. Bestaande contactpersonen verwijderen doe je op de klantkaart, tabblad Contact.
      </p>

      {fout && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[14px] text-red-800">
          {fout}
        </p>
      )}

      {knoppen}
    </form>
  );
}
