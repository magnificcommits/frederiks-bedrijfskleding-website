'use client';

import { useState } from 'react';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import { zetStatusActie } from '../actions';
import { LEAD_STATUSSEN, VERLOREN, VERLOREN_REDENEN, statusLabel } from '@/lib/kms/leadsModel';

/** Status wijzigen; kies je Verloren, dan verschijnt de vraag waarom. */
export default function StatusKiezer({ id, status, reden }: { id: string; status: string; reden: string | null }) {
  const [keuze, setKeuze] = useState(status);
  const [hoofd, toelichting] = (reden ?? '').split(/:\s*(.*)/s);
  const bekend = (VERLOREN_REDENEN as readonly string[]).includes(hoofd);

  return (
    <form action={zetStatusActie} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="block">
        <span className="veld-label">Fase</span>
        <select name="status" value={keuze} onChange={(e) => setKeuze(e.target.value)} className="veld">
          {LEAD_STATUSSEN.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
      </label>
      {keuze === VERLOREN && (
        <>
          <label className="block">
            <span className="veld-label">Waarom verloren?</span>
            <select name="verloren_reden" required defaultValue={bekend ? hoofd : ''} className="veld">
              <option value="" disabled>Kies een reden</option>
              {VERLOREN_REDENEN.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="veld-label">Toelichting</span>
            <input name="reden_toelichting" defaultValue={bekend ? toelichting ?? '' : reden ?? ''} maxLength={300} className="veld" placeholder="Mag leeg" />
          </label>
        </>
      )}
      {(keuze !== status || keuze === VERLOREN) && (
        <VerzendKnop className="knop-donker justify-center" bezigTekst="Opslaan…">
          {keuze === status ? 'Reden opslaan' : `Zet op ${statusLabel(keuze).toLowerCase()}`}
        </VerzendKnop>
      )}
    </form>
  );
}
