'use client';

import { useState } from 'react';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import { volgendeStapActie } from '../actions';

const SUGGESTIES = ['Terugbellen', 'Offerte nabellen', 'Pasafspraak plannen', 'Proefpakket langsbrengen', 'Maten opvragen', 'Logo opvragen'];

function plusDagen(basis: string, n: number): string {
  const d = new Date(`${basis}T12:00:00`);
  d.setDate(d.getDate() + n);
  // Weekend overslaan: een belafspraak op zondag helpt niemand.
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Volgende stap met datum. Opslaan zet de opvolgdatum op de lead en maakt een
 * taak in de takenmodule (met link terug naar de lead).
 */
export default function VolgendeStap({
  id,
  vandaag,
  personen,
  standaardPersoon,
  heeftVorige,
  suggestie,
}: {
  id: string;
  vandaag: string;
  personen: { id: string; naam: string }[];
  standaardPersoon: string | null;
  heeftVorige: boolean;
  suggestie: string;
}) {
  const [datum, setDatum] = useState(plusDagen(vandaag, 1));
  const snel = [
    { label: 'Vandaag', waarde: vandaag },
    { label: 'Morgen', waarde: plusDagen(vandaag, 1) },
    { label: 'Over 3 dagen', waarde: plusDagen(vandaag, 3) },
    { label: 'Volgende week', waarde: plusDagen(vandaag, 7) },
  ];

  return (
    <form action={volgendeStapActie} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <label className="block">
        <span className="veld-label">Wat ga je doen?</span>
        <input name="stap" required maxLength={160} list="stap-suggesties" defaultValue={suggestie} className="veld" />
        <datalist id="stap-suggesties">
          {SUGGESTIES.map((s) => <option key={s} value={s} />)}
        </datalist>
      </label>
      <div>
        <span className="veld-label" id="stap-datum-label">Wanneer</span>
        <div className="flex flex-wrap gap-1" role="group" aria-labelledby="stap-datum-label">
          {snel.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setDatum(s.waarde)}
              aria-pressed={datum === s.waarde}
              className={`chip px-2 py-0.5 text-[12px] ${datum === s.waarde ? 'chip-aan' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-[1fr_6.5rem] gap-2">
          <input type="date" name="datum" required value={datum} min={vandaag} onChange={(e) => setDatum(e.target.value)} className="veld" aria-label="Datum" />
          <input type="time" name="tijd" className="veld" aria-label="Tijd (mag leeg)" />
        </div>
      </div>
      {personen.length > 0 && (
        <label className="block">
          <span className="veld-label">Wie</span>
          <select name="persoon_id" defaultValue={standaardPersoon ?? ''} className="veld">
            <option value="">Niemand in het bijzonder</option>
            {personen.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
          </select>
        </label>
      )}
      {heeftVorige && (
        <label className="flex items-center gap-2 text-[12px] text-ink-700">
          <input type="checkbox" name="vorige_afronden" defaultChecked className="h-4 w-4 rounded border-line accent-amber-600" />
          Vorige stap afvinken in Taken
        </label>
      )}
      <VerzendKnop className="knop-primair justify-center" bezigTekst="Plannen…">Plan en zet in Taken</VerzendKnop>
    </form>
  );
}
