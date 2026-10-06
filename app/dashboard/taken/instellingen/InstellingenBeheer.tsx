'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import type { TaakPersoon } from '@/lib/kms/taakPersonen';
import type { TaakStatus } from '@/lib/kms/taakStatussen';
import { KLEUREN, KLEUR_NAAM, KLEUR_KLASSEN, GROEP_NAAM, STATUS_GROEPEN, type Kleur } from '../statusKleur';
import { Avatar, BevestigKnop, MeldingBalk, type Melding } from '../onderdelen';
import {
  maakPersoonActie,
  werkPersoonBijActie,
  verwijderPersoonActie,
  vernieuwAgendaLinkActie,
  maakStatusActie,
  hernoemStatusActie,
  zetStatusKleurActie,
  zetStatusGroepActie,
  verschuifStatusActie,
  zetStatusActiefActie,
  verwijderStatusActie,
  type Resultaat,
} from './actions';

type PersoonRij = TaakPersoon & { agendaUrl: string | null };

/* ------------------------------------------------------------------ */
/* Kleine onderdelen                                                   */
/* ------------------------------------------------------------------ */

function KleurKiezer({
  waarde,
  onKies,
  label,
  disabled,
  klein,
}: {
  waarde: Kleur;
  onKies: (k: Kleur) => void;
  label: string;
  disabled?: boolean;
  klein?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex flex-wrap ${klein ? 'gap-1.5' : 'gap-1'}`}>
      {KLEUREN.map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={waarde === k}
          aria-label={KLEUR_NAAM[k]}
          title={KLEUR_NAAM[k]}
          disabled={disabled}
          onClick={() => onKies(k)}
          className={`${klein ? 'h-[18px] w-[18px]' : 'h-6 w-6'} rounded-full ${KLEUR_KLASSEN[k].dot} ${
            waarde === k ? 'ring-2 ring-ink-900 ring-offset-2' : 'opacity-80 hover:opacity-100'
          } disabled:cursor-not-allowed`}
        />
      ))}
    </div>
  );
}

function Schakelaar({
  aan,
  onWissel,
  label,
  disabled,
  schermlezer,
}: {
  aan: boolean;
  onWissel: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  /** Label alleen voor schermlezers (als er geen zichtbaar label is). */
  schermlezer?: string;
}) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-[13px] ${disabled ? 'opacity-50' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={aan}
        aria-label={schermlezer}
        disabled={disabled}
        onClick={() => onWissel(!aan)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${aan ? 'bg-green-600' : 'bg-ink-200'}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${aan ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
      {label && <span className="text-ink-800">{label}</span>}
    </label>
  );
}

/** Tekstveld dat opslaat bij wegklikken of Enter. */
function BewaarVeld({
  waarde,
  onBewaar,
  label,
  type = 'text',
  placeholder,
  disabled,
  className = '',
}: {
  waarde: string;
  onBewaar: (v: string) => void;
  label: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [v, setV] = useState(waarde);
  useEffect(() => setV(waarde), [waarde]);
  return (
    <input
      type={type}
      value={v}
      aria-label={label}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v.trim() !== waarde.trim()) onBewaar(v);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setV(waarde);
          setTimeout(() => (e.target as HTMLInputElement).blur(), 0);
        }
      }}
      className={`veld py-1.5 text-[14px] ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Hoofdcomponent                                                      */
/* ------------------------------------------------------------------ */

export default function InstellingenBeheer({
  personen,
  statussen,
  aantallen,
  bewerkbaar,
}: {
  personen: PersoonRij[];
  statussen: TaakStatus[];
  aantallen: Record<string, number>;
  bewerkbaar: boolean;
}) {
  const router = useRouter();
  const [bezig, startOverdracht] = useTransition();
  const [melding, setMelding] = useState<Melding | null>(null);
  const sluit = useCallback(() => setMelding(null), []);

  const voer = (actie: () => Promise<Resultaat>, okTekst?: string) => {
    startOverdracht(async () => {
      let res: Resultaat;
      try {
        res = await actie();
      } catch {
        res = { ok: false, fout: 'Geen verbinding. Probeer het nog eens.' };
      }
      if (res.ok) {
        const tekst = res.melding ?? okTekst;
        if (tekst) setMelding({ tekst, soort: 'ok' });
        router.refresh();
      } else setMelding({ tekst: res.fout, soort: 'fout' });
    });
  };

  /* ---------- Nieuwe persoon / status ---------- */
  const [nieuwP, setNieuwP] = useState<{ naam: string; email: string; kleur: Kleur }>({ naam: '', email: '', kleur: 'blauw' });
  const [nieuwS, setNieuwS] = useState<{ naam: string; kleur: Kleur; groep: string }>({ naam: '', kleur: 'blauw', groep: 'bezig' });
  const [gekopieerd, setGekopieerd] = useState<string | null>(null);

  const kopieer = async (id: string, tekst: string) => {
    try {
      await navigator.clipboard.writeText(tekst);
      setGekopieerd(id);
      setTimeout(() => setGekopieerd(null), 2000);
    } catch {
      setMelding({ tekst: 'Kopiëren lukte niet. Selecteer de link en kopieer hem zelf.', soort: 'fout' });
    }
  };

  return (
    <div className="mt-6 space-y-8 pb-16">
      {/* ================= Personen ================= */}
      <section aria-labelledby="kop-personen">
        <h2 id="kop-personen" className="font-display text-[18px] font-bold text-ink-900">
          Personen
        </h2>
        <p className="mt-1 max-w-2xl text-[14px] text-warm">
          Wie taken kan krijgen. Je kiest een persoon bij een taak uit dit lijstje, zodat filteren altijd klopt. Met een e-mailadres krijgt
          iemand herinneringen en (als je dat aanzet) elke ochtend een dagoverzicht en op maandag een weekoverzicht.
        </p>

        <div className="mt-4 space-y-3">
          {personen.length === 0 && <p className="text-[14px] text-warm">Nog niemand. Voeg hieronder iemand toe.</p>}
          {personen.map((p) => {
            const googleUrl = p.agendaUrl ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(p.agendaUrl.replace(/^https?:/, 'webcal:'))}` : null;
            const webcal = p.agendaUrl ? p.agendaUrl.replace(/^https?:/, 'webcal:') : null;
            return (
              <div key={p.id} className={`rounded-lg border border-line bg-white p-4 ${p.actief ? '' : 'opacity-70'}`}>
                <div className="flex flex-wrap items-start gap-4">
                  <Avatar persoon={p} />
                  <div className="grid grid-cols-1 min-w-[16rem] flex-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col">
                      <span className="veld-label">Naam</span>
                      <BewaarVeld waarde={p.naam} label="Naam" disabled={!bewerkbaar || bezig} onBewaar={(v) => voer(() => werkPersoonBijActie(p.id, { naam: v }), 'Naam opgeslagen.')} />
                    </label>
                    <label className="flex flex-col">
                      <span className="veld-label">E-mail voor meldingen</span>
                      <BewaarVeld
                        waarde={p.email ?? ''}
                        type="email"
                        label="E-mail"
                        placeholder="naam@voorbeeld.nl"
                        disabled={!bewerkbaar || bezig}
                        onBewaar={(v) => voer(() => werkPersoonBijActie(p.id, { email: v }), 'E-mailadres opgeslagen.')}
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <span className="veld-label">Kleur</span>
                      <KleurKiezer
                        waarde={p.kleur}
                        label={`Kleur van ${p.naam}`}
                        disabled={!bewerkbaar || bezig}
                        onKies={(k) => voer(() => werkPersoonBijActie(p.id, { kleur: k }))}
                      />
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-2">
                      <Schakelaar aan={p.actief} label="Actief" disabled={!bewerkbaar || bezig} onWissel={(v) => voer(() => werkPersoonBijActie(p.id, { actief: v }))} />
                      <Schakelaar
                        aan={p.dagoverzicht}
                        label="Dagoverzicht (7:00)"
                        disabled={!bewerkbaar || bezig}
                        onWissel={(v) => voer(() => werkPersoonBijActie(p.id, { dagoverzicht: v }))}
                      />
                      <Schakelaar
                        aan={p.weekoverzicht}
                        label="Weekoverzicht (maandag)"
                        disabled={!bewerkbaar || bezig}
                        onWissel={(v) => voer(() => werkPersoonBijActie(p.id, { weekoverzicht: v }))}
                      />
                      <Schakelaar
                        aan={p.ook_zonder_persoon}
                        label="Ook taken zonder persoon"
                        disabled={!bewerkbaar || bezig}
                        onWissel={(v) => voer(() => werkPersoonBijActie(p.id, { ook_zonder_persoon: v }))}
                      />
                    </div>
                    {!p.email && (p.dagoverzicht || p.weekoverzicht) && (
                      <p className="text-[12px] text-amber-800 sm:col-span-2">Vul een e-mailadres in, anders komen de overzichten nergens aan.</p>
                    )}
                  </div>
                </div>

                {p.agendaUrl && (
                  <details className="mt-4 rounded-md border border-line bg-mist p-3">
                    <summary className="cursor-pointer text-[14px] font-semibold text-ink-900">Toevoegen aan je agenda</summary>
                    <p className="mt-2 text-[13px] text-warm">
                      Met deze link verschijnen de afspraken en taken van {p.naam} in Google Agenda, Outlook of de agenda op je telefoon. De agenda
                      ververst zichzelf (Google doet dat een paar keer per dag). Deel de link niet: wie hem heeft, ziet de agenda.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input readOnly value={p.agendaUrl} aria-label="Agendalink" onFocus={(e) => e.target.select()} className="veld min-w-[16rem] flex-1 py-1.5 font-mono text-[12px]" />
                      <button type="button" onClick={() => kopieer(p.id, p.agendaUrl ?? '')} className="knop-stil">
                        {gekopieerd === p.id ? 'Gekopieerd' : 'Kopieer link'}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {googleUrl && (
                        <a href={googleUrl} target="_blank" rel="noreferrer" className="knop-stil">
                          Google Agenda
                        </a>
                      )}
                      {webcal && (
                        <a href={webcal} className="knop-stil">
                          Outlook / Apple Agenda
                        </a>
                      )}
                      <BevestigKnop
                        onBevestig={() => voer(() => vernieuwAgendaLinkActie(p.id))}
                        bevestig="Oude link stopt. Zeker?"
                        className="knop-tekst"
                        disabled={!bewerkbaar || bezig}
                      >
                        Nieuwe link maken
                      </BevestigKnop>
                    </div>
                    <p className="mt-2 text-[12px] text-warm">
                      Werkt de knop niet? In Google Agenda: Andere agenda&apos;s → + → Via URL, en plak de link. In Outlook: Agenda toevoegen → Abonneren
                      vanaf internet.
                    </p>
                  </details>
                )}

                <div className="mt-3 flex justify-end">
                  <BevestigKnop onBevestig={() => voer(() => verwijderPersoonActie(p.id))} disabled={!bewerkbaar || bezig}>
                    Verwijderen
                  </BevestigKnop>
                </div>
              </div>
            );
          })}
        </div>

        {/* Nieuwe persoon */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nieuwP.naam.trim()) return setMelding({ tekst: 'Vul een naam in.', soort: 'fout' });
            const invoer = nieuwP;
            voer(async () => {
              const r = await maakPersoonActie(invoer);
              if (r.ok) setNieuwP({ naam: '', email: '', kleur: 'blauw' });
              return r;
            });
          }}
          className="mt-4 rounded-lg border border-dashed border-ink-300 bg-mist p-4"
        >
          <p className="font-semibold text-ink-900">Persoon toevoegen</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="flex flex-col">
              <span className="veld-label">Naam</span>
              <input value={nieuwP.naam} onChange={(e) => setNieuwP({ ...nieuwP, naam: e.target.value })} className="veld py-1.5 text-[14px]" disabled={!bewerkbaar} />
            </label>
            <label className="flex flex-col">
              <span className="veld-label">E-mail (optioneel)</span>
              <input type="email" value={nieuwP.email} onChange={(e) => setNieuwP({ ...nieuwP, email: e.target.value })} className="veld py-1.5 text-[14px]" disabled={!bewerkbaar} />
            </label>
            <button type="submit" className="knop-donker" disabled={!bewerkbaar || bezig}>
              Toevoegen
            </button>
            <div className="sm:col-span-3">
              <span className="veld-label">Kleur</span>
              <KleurKiezer waarde={nieuwP.kleur} label="Kleur van de nieuwe persoon" onKies={(k) => setNieuwP({ ...nieuwP, kleur: k })} disabled={!bewerkbaar} />
            </div>
          </div>
        </form>
      </section>

      {/* ================= Statussen ================= */}
      <section aria-labelledby="kop-statussen">
        <h2 id="kop-statussen" className="font-display text-[18px] font-bold text-ink-900">
          Statussen
        </h2>
        <p className="mt-1 max-w-2xl text-[14px] text-warm">
          De stappen waar een taak doorheen gaat. Wijzig de naam, kleur of volgorde zoals het voor jou werkt. Een nieuwe naam geldt meteen voor
          alle taken met die status. Zet een status uit als je hem niet meer gebruikt; taken die hem nog hebben houden hem. Statussen in de groep
          &ldquo;Klaar&rdquo; ronden de taak af.
        </p>

        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="tbl min-w-[760px] text-[14px]">
            <thead>
              <tr>
                <th className="w-[5rem] !pl-4">Volgorde</th>
                <th>Naam</th>
                <th className="w-[15rem]">Kleur</th>
                <th className="w-[13rem]">Groep</th>
                <th className="w-[5rem] text-right">Taken</th>
                <th className="w-[6rem]">Aan</th>
                <th className="w-[7rem]" aria-label="Verwijderen" />
              </tr>
            </thead>
            <tbody>
              {statussen.map((s, i) => {
                const n = aantallen[s.naam] ?? 0;
                const k = KLEUR_KLASSEN[s.kleur];
                const vast = s.sleutel === 'niet_gestart' || s.sleutel === 'afgerond';
                return (
                  <tr key={s.id} className={s.actief ? '' : 'opacity-60'}>
                    <td className="!py-2 !pl-4">
                      <div className="flex gap-0.5">
                        <button
                          type="button"
                          aria-label={`${s.naam} omhoog`}
                          disabled={!bewerkbaar || bezig || i === 0}
                          onClick={() => voer(() => verschuifStatusActie(s.id, -1))}
                          className="rounded p-1 text-ink-500 hover:bg-mist hover:text-ink-900 disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          aria-label={`${s.naam} omlaag`}
                          disabled={!bewerkbaar || bezig || i === statussen.length - 1}
                          onClick={() => voer(() => verschuifStatusActie(s.id, 1))}
                          className="rounded p-1 text-ink-500 hover:bg-mist hover:text-ink-900 disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                    <td className="!py-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${k.dot}`} aria-hidden="true" />
                        <BewaarVeld
                          waarde={s.naam}
                          label={`Naam van status ${s.naam}`}
                          disabled={!bewerkbaar || bezig}
                          onBewaar={(v) => voer(() => hernoemStatusActie(s.id, v))}
                        />
                      </div>
                    </td>
                    <td className="!py-2">
                      <KleurKiezer klein waarde={s.kleur} label={`Kleur van ${s.naam}`} disabled={!bewerkbaar || bezig} onKies={(kl) => voer(() => zetStatusKleurActie(s.id, kl))} />
                    </td>
                    <td className="!py-2">
                      <select
                        value={s.groep}
                        aria-label={`Groep van ${s.naam}`}
                        disabled={!bewerkbaar || bezig || s.sleutel === 'afgerond'}
                        onChange={(e) => voer(() => zetStatusGroepActie(s.id, e.target.value))}
                        className="veld py-1.5 text-[13px]"
                      >
                        {STATUS_GROEPEN.map((g) => (
                          <option key={g} value={g} disabled={s.sleutel === 'niet_gestart' && g === 'klaar'}>
                            {GROEP_NAAM[g]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="!py-2 text-right tabular-nums text-warm">{n}</td>
                    <td className="!py-2">
                      <Schakelaar
                        aan={s.actief}
                        label=""
                        schermlezer={`${s.naam} aan of uit`}
                        disabled={!bewerkbaar || bezig || vast}
                        onWissel={(v) => voer(() => zetStatusActiefActie(s.id, v))}
                      />
                    </td>
                    <td className="!py-2 text-right">
                      {s.sleutel || n > 0 ? (
                        <span className="text-[12px] text-ink-300" title={s.sleutel ? 'Standaardstap: zet hem uit in plaats van verwijderen' : 'In gebruik: zet hem uit'}>
                          {s.sleutel ? 'standaard' : 'in gebruik'}
                        </span>
                      ) : (
                        <BevestigKnop onBevestig={() => voer(() => verwijderStatusActie(s.id))} disabled={!bewerkbaar || bezig}>
                          Verwijderen
                        </BevestigKnop>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Nieuwe status */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nieuwS.naam.trim()) return setMelding({ tekst: 'Geef de status een naam.', soort: 'fout' });
            const invoer = nieuwS;
            voer(async () => {
              const r = await maakStatusActie(invoer);
              if (r.ok) setNieuwS({ naam: '', kleur: 'blauw', groep: 'bezig' });
              return r;
            });
          }}
          className="mt-4 rounded-lg border border-dashed border-ink-300 bg-mist p-4"
        >
          <p className="font-semibold text-ink-900">Status toevoegen</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
            <label className="flex flex-col">
              <span className="veld-label">Naam</span>
              <input value={nieuwS.naam} onChange={(e) => setNieuwS({ ...nieuwS, naam: e.target.value })} placeholder="Bijv. Wacht op klant" className="veld py-1.5 text-[14px]" disabled={!bewerkbaar} />
            </label>
            <label className="flex flex-col">
              <span className="veld-label">Groep</span>
              <select value={nieuwS.groep} onChange={(e) => setNieuwS({ ...nieuwS, groep: e.target.value })} className="veld py-1.5 text-[14px]" disabled={!bewerkbaar}>
                {STATUS_GROEPEN.map((g) => (
                  <option key={g} value={g}>
                    {GROEP_NAAM[g]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="knop-donker" disabled={!bewerkbaar || bezig}>
              Toevoegen
            </button>
            <div className="sm:col-span-3">
              <span className="veld-label">Kleur</span>
              <div className="flex flex-wrap items-center gap-3">
                <KleurKiezer waarde={nieuwS.kleur} label="Kleur van de nieuwe status" onKies={(k) => setNieuwS({ ...nieuwS, kleur: k })} disabled={!bewerkbaar} />
                {nieuwS.naam.trim() && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold ${KLEUR_KLASSEN[nieuwS.kleur].pill}`}>
                    <span className={`h-2 w-2 rounded-full ${KLEUR_KLASSEN[nieuwS.kleur].dot}`} aria-hidden="true" />
                    {nieuwS.naam.trim()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </form>
      </section>

      <MeldingBalk melding={melding} onSluit={sluit} />
    </div>
  );
}
