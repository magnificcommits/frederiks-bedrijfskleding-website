'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Taak, TaakVelden, KlantKeuze } from '@/lib/kms/taken';
import type { TaakStatus } from '@/lib/kms/taakStatussen';
import type { TaakPersoon } from '@/lib/kms/taakPersonen';
import KlantZoeker, { type KlantWaarde } from './KlantZoeker';
import { BronBadge, IcoonAfspraak, IcoonTaak, BevestigKnop, statusOpties } from './onderdelen';
import { kleurKlassen } from './statusKleur';
import {
  plusDagen,
  volgendeMaandag,
  datumLang,
  datumKort,
  plusMinuten,
  minutenVan,
  nlDelen,
  berekenHerinnering,
  naarLokaalInvoer,
  vanLokaalInvoer,
  herinneringTekst,
  tijdKort,
  STANDAARD_TIJD,
} from './tijd';

/**
 * Pop-up om een taak of afspraak te maken of te wijzigen.
 *
 * - Taak: grote omschrijving, klant (zoekbalk), datum met snelkeuzes, optioneel
 *   een tijd, persoon, status, prioriteit, herinnering en herhalen.
 * - Afspraak: onderwerp, klant, datum, begin- en eindtijd (verplicht, eind
 *   standaard een uur later), locatie (standaard het adres van de klant),
 *   persoon en herinnering (standaard een uur van tevoren).
 *
 * Enter slaat nooit per ongeluk op; Ctrl+Enter (of Cmd+Enter) wel. Escape sluit
 * (met een vraag als er iets gewijzigd is).
 */

export type ModalOpen =
  | { modus: 'nieuw'; soort: 'taak' | 'afspraak'; datum?: string; tijd?: string }
  | { modus: 'bewerk'; taak: Taak };

type HerinneringKeuze = 'geen' | '0' | '15' | '60' | '1440' | 'zelf';

type Concept = {
  soort: 'taak' | 'afspraak';
  klant: KlantWaarde;
  klantAangeraakt: boolean;
  omschrijving: string;
  datum: string;
  tijd: string;
  eind: string;
  locatie: string;
  locatieAuto: boolean;
  persoonId: string;
  werkstatus: string;
  prioriteit: string;
  herinnering: HerinneringKeuze;
  herinneringOp: string;
  herhaling: string;
};

const HERINNERING_OPTIES: { waarde: HerinneringKeuze; label: string }[] = [
  { waarde: 'geen', label: 'Geen herinnering' },
  { waarde: '0', label: 'Op het tijdstip zelf' },
  { waarde: '15', label: '15 minuten van tevoren' },
  { waarde: '60', label: '1 uur van tevoren' },
  { waarde: '1440', label: '1 dag van tevoren' },
  { waarde: 'zelf', label: 'Zelf een moment kiezen' },
];

function volgendHeleUur(): string {
  const d = nlDelen();
  const uur = Math.min(d.uur + 1, 22);
  return `${String(Math.max(uur, 8)).padStart(2, '0')}:00`;
}

function herinneringVan(t: Taak): HerinneringKeuze {
  if (t.herinnering_minuten !== null && ['0', '15', '60', '1440'].includes(String(t.herinnering_minuten)))
    return String(t.herinnering_minuten) as HerinneringKeuze;
  if (t.herinnering_op) return 'zelf';
  return 'geen';
}

function beginConcept(open: ModalOpen, vandaag: string, beginStatus: string, standaardPersoonId: string | null): Concept {
  if (open.modus === 'bewerk') {
    const t = open.taak;
    return {
      soort: t.soort,
      klant: t.organisatie_id ? { klantId: t.organisatie_id, tekst: t.organisatie_naam ?? t.titel } : { klantId: null, tekst: t.titel },
      klantAangeraakt: false,
      omschrijving: t.omschrijving ?? '',
      datum: t.vervaldatum ?? '',
      tijd: tijdKort(t.tijd),
      eind: tijdKort(t.eind_tijd) || (t.tijd ? plusMinuten(tijdKort(t.tijd), 60) : ''),
      locatie: t.locatie ?? '',
      locatieAuto: false,
      persoonId: t.persoon_id ?? '',
      werkstatus: t.werkstatus ?? beginStatus,
      prioriteit: t.prioriteit || 'normaal',
      herinnering: herinneringVan(t),
      herinneringOp: naarLokaalInvoer(t.herinnering_op),
      herhaling: t.herhaling || 'geen',
    };
  }
  const afspraak = open.soort === 'afspraak';
  const tijd = open.tijd ?? (afspraak ? volgendHeleUur() : '');
  return {
    soort: open.soort,
    klant: { klantId: null, tekst: '' },
    klantAangeraakt: false,
    omschrijving: '',
    datum: open.datum ?? vandaag,
    tijd,
    eind: tijd ? plusMinuten(tijd, 60) : '',
    locatie: '',
    locatieAuto: true,
    persoonId: standaardPersoonId ?? '',
    werkstatus: beginStatus,
    prioriteit: 'normaal',
    herinnering: afspraak ? '60' : 'geen',
    herinneringOp: '',
    herhaling: 'geen',
  };
}

export default function TaakModal({
  open,
  onSluit,
  onOpslaan,
  onVerwijder,
  onArchiveer,
  klanten,
  statussen,
  personen,
  vandaag,
  beginStatus,
  standaardPersoonId,
  v2,
}: {
  open: ModalOpen;
  onSluit: () => void;
  /** Geeft een foutmelding terug, of null als het gelukt is. */
  onOpslaan: (id: string | null, velden: TaakVelden) => Promise<string | null>;
  onVerwijder: (taak: Taak) => void;
  onArchiveer: (taak: Taak) => void;
  klanten: KlantKeuze[];
  statussen: TaakStatus[];
  personen: TaakPersoon[];
  vandaag: string;
  beginStatus: string;
  standaardPersoonId: string | null;
  v2: boolean;
}) {
  const begin = useMemo(() => beginConcept(open, vandaag, beginStatus, standaardPersoonId), [open, vandaag, beginStatus, standaardPersoonId]);
  const [c, setC] = useState<Concept>(begin);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [vraagSluiten, setVraagSluiten] = useState(false);
  const [gemount, setGemount] = useState(false);
  const paneelRef = useRef<HTMLDivElement>(null);
  const vorigeFocus = useRef<HTMLElement | null>(null);

  const taak = open.modus === 'bewerk' ? open.taak : null;
  const afspraak = c.soort === 'afspraak';
  const gewijzigd = JSON.stringify(c) !== JSON.stringify(begin);
  const zet = (patch: Partial<Concept>) => {
    setC((v) => ({ ...v, ...patch }));
    setFout(null);
  };

  useEffect(() => {
    setGemount(true);
    vorigeFocus.current = document.activeElement as HTMLElement | null;
    const oud = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = oud;
      vorigeFocus.current?.focus?.();
    };
  }, []);

  const probeerSluiten = useCallback(() => {
    if (gewijzigd && !bezig) setVraagSluiten(true);
    else onSluit();
  }, [gewijzigd, bezig, onSluit]);

  /* ---------- Afgeleide waarden ---------- */

  const persoon = personen.find((p) => p.id === c.persoonId) ?? null;
  const herinneringMoment = useMemo(() => {
    if (c.herinnering === 'geen') return null;
    if (c.herinnering === 'zelf') return vanLokaalInvoer(c.herinneringOp);
    return berekenHerinnering(c.datum || null, c.tijd || null, Number(c.herinnering))?.toISOString() ?? null;
  }, [c.herinnering, c.herinneringOp, c.datum, c.tijd]);

  const herinneringUitleg = (() => {
    if (c.herinnering === 'geen') return '';
    if (!c.datum && c.herinnering !== 'zelf') return 'Kies eerst een datum.';
    if (!herinneringMoment) return c.herinnering === 'zelf' ? 'Kies een datum en tijd.' : '';
    const wanneer = herinneringTekst(herinneringMoment, vandaag);
    const geenTijd = !c.tijd && c.herinnering !== 'zelf' ? ` (zonder tijd rekenen we vanaf ${STANDAARD_TIJD})` : '';
    const naar = persoon?.email
      ? `per mail naar ${persoon.naam}`
      : persoon
        ? `alleen in het dashboard: ${persoon.naam} heeft nog geen e-mailadres`
        : 'alleen in het dashboard (geen persoon gekozen)';
    const verleden = new Date(herinneringMoment).getTime() < Date.now() ? ' Let op: dat moment is al voorbij.' : '';
    return `Herinnering ${wanneer}${geenTijd}, ${naar}.${verleden}`;
  })();

  /* ---------- Opslaan ---------- */

  const opslaan = async () => {
    if (bezig) return;
    const klant = c.klant.klantId ? klanten.find((k) => k.id === c.klant.klantId) ?? null : null;
    const eersteRegel = c.omschrijving.split('\n').map((r) => r.trim()).find(Boolean) ?? '';
    let titel = klant?.naam ?? c.klant.tekst.trim();
    if (!titel) titel = eersteRegel.slice(0, 80);
    if (!titel) {
      setFout(afspraak ? 'Kies een klant of typ waar de afspraak over gaat.' : 'Kies een klant of typ wat er moet gebeuren.');
      return;
    }
    if (afspraak) {
      if (!c.datum) return setFout('Een afspraak heeft een datum nodig.');
      if (!c.tijd || !c.eind) return setFout('Vul een begin- en eindtijd in.');
      if (minutenVan(c.eind) <= minutenVan(c.tijd)) return setFout('De eindtijd moet na de begintijd liggen.');
    }
    if (c.herinnering === 'zelf' && !vanLokaalInvoer(c.herinneringOp)) return setFout('Kies een moment voor de herinnering, of zet hem op Geen.');
    if (c.herinnering !== 'geen' && c.herinnering !== 'zelf' && !c.datum) return setFout('Een herinnering heeft een datum nodig.');

    const velden: TaakVelden = {
      soort: c.soort,
      omschrijving: c.omschrijving,
      vervaldatum: c.datum || null,
      tijd: c.tijd || null,
      werkstatus: c.werkstatus,
      prioriteit: c.prioriteit,
    };
    // Bestaande taak: titel en klant alleen meesturen als je de klant hebt aangeraakt,
    // zodat een eigen titel (bijv. "Bellen: …") blijft staan.
    if (!taak || c.klantAangeraakt || (!taak.organisatie_id && titel !== taak.titel)) {
      velden.titel = titel;
      velden.organisatie_id = klant?.id ?? null;
    }
    if (v2) {
      velden.persoon_id = c.persoonId || null;
      velden.herhaling = c.datum ? c.herhaling : 'geen';
      if (afspraak) {
        velden.eind_tijd = c.eind || null;
        velden.locatie = c.locatie;
      }
      if (c.herinnering === 'zelf') {
        velden.herinnering_minuten = null;
        velden.herinnering_op = vanLokaalInvoer(c.herinneringOp);
      } else {
        velden.herinnering_minuten = c.herinnering === 'geen' ? null : Number(c.herinnering);
      }
    }

    setBezig(true);
    const res = await onOpslaan(taak?.id ?? null, velden);
    setBezig(false);
    if (res) setFout(res);
  };

  const toetsen = (e: KeyboardEvent<HTMLDivElement>) => {
    const doel = e.target as HTMLElement;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void opslaan();
      return;
    }
    if (e.key === 'Enter' && doel.tagName === 'INPUT') {
      // Enter in een los veld mag het venster niet opslaan.
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (vraagSluiten) setVraagSluiten(false);
      else probeerSluiten();
      return;
    }
    // Focus binnen het venster houden.
    if (e.key === 'Tab' && paneelRef.current) {
      const focusbaar = paneelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusbaar.length === 0) return;
      const eerste = focusbaar[0];
      const laatste = focusbaar[focusbaar.length - 1];
      if (e.shiftKey && document.activeElement === eerste) {
        e.preventDefault();
        laatste.focus();
      } else if (!e.shiftKey && document.activeElement === laatste) {
        e.preventDefault();
        eerste.focus();
      }
    }
  };

  /* ---------- Onderdelen ---------- */

  const datumKnop = (label: string, waarde: string) => (
    <button
      type="button"
      onClick={() => zet({ datum: waarde, herhaling: waarde ? c.herhaling : 'geen' })}
      className={`chip ${c.datum === waarde ? 'chip-aan' : ''}`}
      aria-pressed={c.datum === waarde}
    >
      {label}
    </button>
  );

  const statusKleur = kleurKlassen(statussen.find((s) => s.naam === c.werkstatus)?.kleur ?? 'grijs');
  const opties = statusOpties(statussen, c.werkstatus);

  if (!gemount) return null;

  const inhoud = (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-ink-900/40" onMouseDown={probeerSluiten} aria-hidden="true" />
      <div
        ref={paneelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="taakmodal-titel"
        onKeyDown={toetsen}
        className={`relative flex max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-card sm:max-h-[92vh] sm:max-w-2xl sm:rounded-xl ${
          afspraak ? 'border-t-4 border-sky-500' : 'border-t-4 border-amber-500'
        }`}
      >
        {/* Kop */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="taakmodal-titel" className="flex items-center gap-2 font-display text-lg font-bold text-ink-900">
              <span className={afspraak ? 'text-sky-700' : 'text-amber-700'}>
                {afspraak ? <IcoonAfspraak className="h-5 w-5" /> : <IcoonTaak className="h-5 w-5" />}
              </span>
              {taak ? (afspraak ? 'Afspraak wijzigen' : 'Taak wijzigen') : afspraak ? 'Nieuwe afspraak' : 'Nieuwe taak'}
            </h2>
            {taak && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-warm">
                <BronBadge taak={taak} />
                <span>Aangemaakt {datumKort(taak.created_at.slice(0, 10))}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Taak of afspraak */}
            <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Soort">
              {(['taak', 'afspraak'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    zet(
                      s === 'afspraak'
                        ? {
                            soort: s,
                            tijd: c.tijd || volgendHeleUur(),
                            eind: c.eind || plusMinuten(c.tijd || volgendHeleUur(), 60),
                            datum: c.datum || vandaag,
                            herinnering: c.herinnering === 'geen' && !taak ? '60' : c.herinnering,
                          }
                        : { soort: s },
                    )
                  }
                  aria-pressed={c.soort === s}
                  className={`rounded-md px-2.5 py-1 text-[13px] font-semibold ${
                    c.soort === s ? (s === 'afspraak' ? 'bg-sky-600 text-white' : 'bg-ink-900 text-white') : 'text-ink-600 hover:bg-mist'
                  }`}
                >
                  {s === 'taak' ? 'Taak' : 'Afspraak'}
                </button>
              ))}
            </div>
            <button type="button" onClick={probeerSluiten} aria-label="Sluiten" className="rounded-md p-1.5 text-ink-400 hover:bg-mist hover:text-ink-900">
              ✕
            </button>
          </div>
        </div>

        {/* Velden */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <KlantZoeker
            klanten={klanten}
            waarde={c.klant}
            autoFocus={!taak}
            label={afspraak ? 'Klant' : 'Klant (of onderwerp)'}
            onChange={(w, k) => {
              const patch: Partial<Concept> = { klant: w, klantAangeraakt: true };
              // Locatie van een afspraak: standaard het adres van de klant.
              if (k?.adres && (c.locatieAuto || !c.locatie.trim())) {
                patch.locatie = k.adres;
                patch.locatieAuto = true;
              } else if (!k && c.locatieAuto) patch.locatie = '';
              zet(patch);
            }}
          />

          <div>
            <label htmlFor="taakmodal-omschrijving" className="veld-label">
              {afspraak ? 'Waar gaat de afspraak over?' : 'Wat moet er gebeuren?'}
            </label>
            <textarea
              id="taakmodal-omschrijving"
              value={c.omschrijving}
              onChange={(e) => zet({ omschrijving: e.target.value })}
              rows={afspraak ? 3 : 6}
              placeholder={afspraak ? 'Bijv. pasafspraak voor 8 medewerkers, polo’s en softshells meenemen' : 'Bijv. 12 polo’s bestellen in maat M en L, logo laten borduren'}
              className="veld min-h-[90px] resize-y py-2.5 text-[15px] leading-relaxed"
            />
            <p className="veld-hint">Enter = nieuwe regel. Ctrl+Enter = opslaan.</p>
          </div>

          {/* Wanneer */}
          <fieldset className={`rounded-lg border p-4 ${afspraak ? 'border-sky-200 bg-sky-50/50' : 'border-line bg-mist/60'}`}>
            <legend className="px-1 text-[12px] font-bold uppercase tracking-wide text-warm">Wanneer</legend>
            <div className="flex flex-wrap items-center gap-2">
              {datumKnop('Vandaag', vandaag)}
              {datumKnop('Morgen', plusDagen(vandaag, 1))}
              {datumKnop('Volgende week', volgendeMaandag(vandaag))}
              {!afspraak && datumKnop('Geen datum', '')}
              <input
                type="date"
                value={c.datum}
                aria-label="Datum"
                onChange={(e) => zet({ datum: e.target.value, herhaling: e.target.value ? c.herhaling : 'geen' })}
                className="veld w-auto py-1.5 text-[14px]"
              />
            </div>
            {c.datum && <p className="mt-2 text-[13px] font-semibold text-ink-800">{datumLang(c.datum)}</p>}

            <div className="mt-3 flex flex-wrap items-end gap-3">
              {afspraak ? (
                <>
                  <label className="flex flex-col">
                    <span className="veld-label">Van</span>
                    <input
                      type="time"
                      required
                      value={c.tijd}
                      onChange={(e) => {
                        const nieuw = e.target.value;
                        // Duur aanhouden als de begintijd verschuift.
                        const duur = c.tijd && c.eind ? minutenVan(c.eind) - minutenVan(c.tijd) : 60;
                        zet({ tijd: nieuw, eind: nieuw ? plusMinuten(nieuw, duur > 0 ? duur : 60) : c.eind });
                      }}
                      className="veld w-auto py-1.5 text-[15px] tabular-nums"
                    />
                  </label>
                  <label className="flex flex-col">
                    <span className="veld-label">Tot</span>
                    <input
                      type="time"
                      required
                      value={c.eind}
                      onChange={(e) => zet({ eind: e.target.value })}
                      className="veld w-auto py-1.5 text-[15px] tabular-nums"
                    />
                  </label>
                  <div className="flex gap-1.5 pb-1">
                    {[30, 60, 90, 120].map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={!c.tijd}
                        onClick={() => zet({ eind: plusMinuten(c.tijd, m) })}
                        className={`chip text-[12px] ${c.tijd && c.eind === plusMinuten(c.tijd, m) ? 'chip-aan' : ''}`}
                      >
                        {m < 60 ? `${m} min` : `${m / 60} uur`.replace('.5', ',5')}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <label className="flex flex-col">
                  <span className="veld-label">Tijd (optioneel)</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="time"
                      value={c.tijd}
                      onChange={(e) => zet({ tijd: e.target.value })}
                      className="veld w-auto py-1.5 text-[15px] tabular-nums"
                    />
                    {c.tijd && (
                      <button type="button" onClick={() => zet({ tijd: '' })} className="knop-tekst text-[13px]">
                        Geen tijd
                      </button>
                    )}
                  </span>
                </label>
              )}
            </div>

            {afspraak && (
              <label className="mt-3 flex flex-col">
                <span className="veld-label">Locatie</span>
                <input
                  type="text"
                  value={c.locatie}
                  onChange={(e) => zet({ locatie: e.target.value, locatieAuto: false })}
                  placeholder="Adres, of bijv. 'In de winkel'"
                  className="veld py-2 text-[14px]"
                />
                {c.locatieAuto && c.locatie && <span className="veld-hint">Adres van de klant ingevuld. Pas het gerust aan.</span>}
              </label>
            )}
          </fieldset>

          {/* Wie en status */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col">
              <span className="veld-label">Persoon</span>
              <select value={c.persoonId} onChange={(e) => zet({ persoonId: e.target.value })} className="veld py-2 text-[14px]" disabled={!v2}>
                <option value="">Niemand</option>
                {personen
                  .filter((p) => p.actief || p.id === c.persoonId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.naam}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex flex-col">
              <span className="veld-label">Status</span>
              <span className={`relative flex items-center rounded-md ${statusKleur.pill}`}>
                <span className={`ml-2.5 h-2 w-2 shrink-0 rounded-full ${statusKleur.dot}`} aria-hidden="true" />
                <select
                  value={c.werkstatus}
                  onChange={(e) => zet({ werkstatus: e.target.value })}
                  className="w-full cursor-pointer appearance-none bg-transparent px-2 py-2 text-[14px] font-semibold focus:outline-none focus:ring-2 focus:ring-amber-200"
                >
                  {opties.map((o) => (
                    <option key={o.naam} value={o.naam}>
                      {o.naam}
                      {o.uit ? ' (uitgezet)' : ''}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </div>

          {!afspraak && (
            <div>
              <span className="veld-label">Prioriteit</span>
              <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Prioriteit">
                {(['laag', 'normaal', 'hoog'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => zet({ prioriteit: p })}
                    aria-pressed={c.prioriteit === p}
                    className={`rounded-md px-3 py-1 text-[13px] font-semibold capitalize ${
                      c.prioriteit === p ? (p === 'hoog' ? 'bg-red-600 text-white' : 'bg-ink-900 text-white') : 'text-ink-600 hover:bg-mist'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Herinnering en herhalen */}
          {v2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col">
                <span className="veld-label">Herinnering</span>
                <select
                  value={c.herinnering}
                  onChange={(e) => {
                    const h = e.target.value as HerinneringKeuze;
                    const patch: Partial<Concept> = { herinnering: h };
                    if (h === 'zelf' && !c.herinneringOp) {
                      patch.herinneringOp = `${c.datum || vandaag}T${c.tijd ? plusMinuten(c.tijd, -60) : STANDAARD_TIJD}`;
                    }
                    zet(patch);
                  }}
                  className="veld py-2 text-[14px]"
                >
                  {HERINNERING_OPTIES.map((o) => (
                    <option key={o.waarde} value={o.waarde}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {c.herinnering === 'zelf' && (
                  <input
                    type="datetime-local"
                    value={c.herinneringOp}
                    onChange={(e) => zet({ herinneringOp: e.target.value })}
                    aria-label="Moment van de herinnering"
                    className="veld mt-2 py-1.5 text-[14px]"
                  />
                )}
              </label>
              <label className="flex flex-col">
                <span className="veld-label">Herhalen</span>
                <select
                  value={c.datum ? c.herhaling : 'geen'}
                  disabled={!c.datum}
                  onChange={(e) => zet({ herhaling: e.target.value })}
                  className="veld py-2 text-[14px]"
                >
                  <option value="geen">Niet herhalen</option>
                  <option value="dagelijks">Elke dag</option>
                  <option value="wekelijks">Elke week</option>
                  <option value="maandelijks">Elke maand</option>
                </select>
                <span className="veld-hint">
                  {!c.datum ? 'Kies eerst een datum.' : c.herhaling !== 'geen' ? 'Na afvinken staat de volgende vanzelf klaar.' : ''}
                </span>
              </label>
              {herinneringUitleg && <p className="-mt-2 text-[12px] leading-snug text-warm sm:col-span-2">{herinneringUitleg}</p>}
            </div>
          )}
          {!v2 && <p className="text-[12px] text-warm">Personen, herinneringen en herhalen werken zodra de database is bijgewerkt.</p>}
        </div>

        {/* Voet */}
        <div className="border-t border-line bg-mist px-5 py-3">
          {fout && (
            <p role="alert" className="mb-2 rounded-md bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-800">
              {fout}
            </p>
          )}
          {vraagSluiten ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] font-semibold text-ink-900">Je wijzigingen zijn nog niet opgeslagen.</p>
              <div className="flex gap-2">
                <button type="button" onClick={onSluit} className="knop-stil text-red-700">
                  Niet opslaan
                </button>
                <button type="button" onClick={() => setVraagSluiten(false)} className="knop-donker">
                  Verder bewerken
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1">
                {taak && v2 && (
                  <>
                    <BevestigKnop onBevestig={() => onVerwijder(taak)} bevestig="Naar prullenbak?">
                      Verwijderen
                    </BevestigKnop>
                    <button type="button" onClick={() => onArchiveer(taak)} className="knop-tekst">
                      Archiveren
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-[12px] text-warm sm:inline">Ctrl+Enter</span>
                <button type="button" onClick={probeerSluiten} className="knop-stil">
                  Annuleren
                </button>
                <button type="button" onClick={() => void opslaan()} disabled={bezig} className={afspraak ? 'knop bg-sky-600 text-white hover:bg-sky-700' : 'knop-primair'}>
                  {bezig ? 'Bezig…' : taak ? 'Opslaan' : afspraak ? 'Afspraak toevoegen' : 'Taak toevoegen'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(inhoud, document.body);
}
