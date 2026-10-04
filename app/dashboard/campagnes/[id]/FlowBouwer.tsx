'use client';
import { bevestig } from '@/components/dashboard/ui/Bevestig';

import { Fragment, useEffect, useMemo, useState, useTransition } from 'react';
import {
  CONDITIE_LABEL,
  CONDITIE_SOORTEN,
  KNOOP_TYPEN,
  WEEKDAGEN,
  controleerFlow,
  kloonKnoop,
  knoopTitel,
  mailKnopen,
  nieuweKnoop,
  vindKnoop,
  verschuifKnoop,
  verwijderKnoop,
  voegIn,
  werkKnoopBij,
  alleKnopen,
  type ConditieSoort,
  type Flow,
  type Knoop,
  type KnoopType,
  type Plek,
} from '@/lib/campagnes/flow';
import MailEditor, { type NieuwsbriefKeuze } from './MailEditor';
import { bewaarFlowActie } from './actions';

type MailStat = { verzonden: number; geopend: number; geklikt: number; mislukt: number };

export type FlowBouwerProps = {
  campagneId: string;
  beginFlow: Flow;
  kanOpslaan: boolean;
  status: string;
  triggerTekst: string;
  doelTekst: string;
  opStap: Record<string, number>;
  perMail: Record<string, MailStat>;
  splitsingen: Record<string, { ja: number; nee: number }>;
  nieuwsbrieven: NieuwsbriefKeuze[];
  personen: { id: string; naam: string }[];
  prospectStatussen: string[];
  leadStatussen: string[];
  mailIngesteld: boolean;
};

/* ------------------------------------------------------------------ */
/* Iconen (eenvoudige lijnen, 16px)                                    */
/* ------------------------------------------------------------------ */

function Icoon({ type }: { type: KnoopType | 'trigger' | 'doel' }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden>
      {type === 'mail' && (
        <>
          <rect x="1.8" y="3.3" width="12.4" height="9.4" rx="1.4" {...p} />
          <path d="M2.4 4.2 8 8.6l5.6-4.4" {...p} />
        </>
      )}
      {type === 'wacht' && (
        <>
          <circle cx="8" cy="8" r="6" {...p} />
          <path d="M8 4.6V8l2.4 1.6" {...p} />
        </>
      )}
      {type === 'voorwaarde' && <path d="M8 1.8v4.4M8 6.2 3.6 10.4v3.8M8 6.2l4.4 4.2v3.8" {...p} />}
      {type === 'taak' && (
        <>
          <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2" {...p} />
          <path d="m5 8.2 2 2 4-4.4" {...p} />
        </>
      )}
      {type === 'status' && <path d="M2.5 5h8.5l-2.4-2.4M13.5 11H5l2.4 2.4" {...p} />}
      {type === 'tag' && (
        <>
          <path d="M2 2.2h5.6l6.2 6.2-5.4 5.4L2.2 7.6z" {...p} />
          <circle cx="5.2" cy="5.2" r="1" {...p} />
        </>
      )}
      {type === 'einde' && <rect x="3.5" y="3.5" width="9" height="9" rx="1.2" {...p} />}
      {type === 'trigger' && <path d="M9 1.6 3.4 9.2h4.2L6.8 14.4l5.8-7.8H8.4z" {...p} />}
      {type === 'doel' && (
        <>
          <circle cx="8" cy="8" r="6" {...p} />
          <circle cx="8" cy="8" r="2.6" {...p} />
        </>
      )}
    </svg>
  );
}

const TYPE_KLEUR: Record<KnoopType, string> = {
  mail: 'bg-amber-100 text-amber-800',
  wacht: 'bg-ink-100 text-ink-700',
  voorwaarde: 'bg-ink-900 text-white',
  taak: 'bg-green-100 text-green-800',
  status: 'bg-ink-100 text-ink-700',
  tag: 'bg-ink-100 text-ink-700',
  einde: 'bg-ink-200 text-ink-700',
};

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');

/* ------------------------------------------------------------------ */

export default function FlowBouwer(props: FlowBouwerProps) {
  const { campagneId, beginFlow, kanOpslaan, opStap, perMail, splitsingen } = props;
  const [flow, setFlow] = useState<Flow>(beginFlow);
  const [gekozen, setGekozen] = useState<string | null>(null);
  const [openPlek, setOpenPlek] = useState<string | null>(null);
  const [gewijzigd, setGewijzigd] = useState(false);
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);
  const [bezig, start] = useTransition();

  const problemen = useMemo(() => controleerFlow(flow), [flow]);
  const probleemIds = useMemo(() => new Set(problemen.map((p) => p.id).filter(Boolean) as string[]), [problemen]);
  const geselecteerd = gekozen ? vindKnoop(flow, gekozen) : null;

  useEffect(() => {
    if (!gewijzigd) return;
    const waarschuw = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', waarschuw);
    return () => window.removeEventListener('beforeunload', waarschuw);
  }, [gewijzigd]);

  function wijzig(f: (stappen: Knoop[]) => Knoop[]) {
    setFlow((oud) => ({ ...oud, stappen: f(oud.stappen) }));
    setGewijzigd(true);
    setMelding(null);
  }

  function voegToe(plek: Plek, type: KnoopType) {
    const k = nieuweKnoop(type);
    wijzig((s) => voegIn(s, plek, k));
    setGekozen(k.id);
    setOpenPlek(null);
  }

  async function verwijder(id: string) {
    const k = vindKnoop(flow, id);
    if (!k) return;
    const wachtend = opStapIn(k);
    const vragen: string[] = [];
    if (k.type === 'voorwaarde' && (k.ja.length || k.nee.length)) vragen.push('De stappen in beide takken gaan ook weg.');
    if (wachtend) vragen.push(`Er ${wachtend === 1 ? 'staat 1 persoon' : `staan ${wachtend} mensen`} op deze stap. ${wachtend === 1 ? 'Die stopt' : 'Die stoppen'} na het opslaan.`);
    if (vragen.length && !(await bevestig({ titel: 'Deze stap verwijderen?', tekst: vragen.join('\n'), bevestigLabel: 'Verwijderen', gevaar: true }))) return;
    wijzig((s) => verwijderKnoop(s, id));
    setGekozen(null);
  }

  function opStapIn(k: Knoop): number {
    return alleKnopen([k]).reduce((n, x) => n + (opStap[x.id] ?? 0), 0);
  }

  function dupliceer(id: string) {
    const k = vindKnoop(flow, id);
    if (!k) return;
    const kopie = kloonKnoop(k);
    // Direct na het origineel invoegen, in dezelfde lijst.
    const zoek = (lijst: Knoop[], ouderId: string | null, tak: 'ja' | 'nee' | null): Plek | null => {
      for (let i = 0; i < lijst.length; i++) {
        const x = lijst[i];
        if (x.id === id) return { ouderId, tak, index: i + 1 };
        if (x.type === 'voorwaarde') {
          const r = zoek(x.ja, x.id, 'ja') ?? zoek(x.nee, x.id, 'nee');
          if (r) return r;
        }
      }
      return null;
    };
    const plek = zoek(flow.stappen, null, null);
    if (!plek) return;
    wijzig((s) => voegIn(s, plek, kopie));
    setGekozen(kopie.id);
  }

  function opslaan() {
    setMelding(null);
    start(async () => {
      const r = await bewaarFlowActie(campagneId, flow);
      if (r.ok) {
        setGewijzigd(false);
        setMelding({ ok: true, tekst: 'Opgeslagen.' });
      } else setMelding({ ok: false, tekst: r.fout ?? 'Opslaan is niet gelukt.' });
    });
  }

  /* ---------------- Weergave van de flow ---------------- */

  function invoeger(plek: Plek, klein = false) {
    const sleutel = `${plek.ouderId ?? 'root'}:${plek.tak ?? ''}:${plek.index}`;
    const open = openPlek === sleutel;
    return (
      <div className={`relative flex flex-col items-center ${klein ? 'py-1' : 'py-1.5'}`}>
        <div className="h-3 w-px bg-ink-200" />
        <button
          type="button"
          onClick={() => setOpenPlek(open ? null : sleutel)}
          aria-label="Stap invoegen"
          aria-expanded={open}
          className={`flex h-6 w-6 items-center justify-center rounded-full border text-[15px] leading-none transition-colors ${open ? 'border-amber-500 bg-amber-500 text-ink-900' : 'border-ink-200 bg-white text-ink-400 hover:border-amber-500 hover:text-amber-700'}`}
        >
          +
        </button>
        <div className="h-3 w-px bg-ink-200" />
        {open && (
          <>
            <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpenPlek(null)} />
            <div className="absolute left-1/2 top-9 z-40 w-64 -translate-x-1/2 rounded-lg border border-line bg-white p-1 shadow-card">
              {KNOOP_TYPEN.map((t) => (
                <button key={t.type} type="button" onClick={() => voegToe(plek, t.type)} className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-mist">
                  <span className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded ${TYPE_KLEUR[t.type]}`}>
                    <Icoon type={t.type} />
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold text-ink-900">{t.label}</span>
                    <span className="block text-[11px] leading-snug text-warm">{t.uitleg}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  function kaart(k: Knoop) {
    const actief = gekozen === k.id;
    const wachtend = opStap[k.id] ?? 0;
    const stat = k.type === 'mail' ? perMail[k.id] : null;
    const split = k.type === 'voorwaarde' ? splitsingen[k.id] : null;
    const fout = probleemIds.has(k.id);
    let sub: string | null = null;
    if (k.type === 'mail') sub = k.stijl === 'nieuwsbrief' ? 'Nieuwsbriefontwerp' : k.stijl === 'huisstijl' ? 'Mail in huisstijl' : 'Persoonlijke mail';
    if (k.type === 'wacht' && k.modus === 'uren') sub = 'Gaat in bij de eerstvolgende dagelijkse run na afloop';
    if (k.type === 'taak') sub = `Voor ${props.personen.find((p) => p.id === k.persoonId)?.naam ?? 'Jessi'}, binnen ${k.binnenDagen} ${k.binnenDagen === 1 ? 'werkdag' : 'werkdagen'}`;
    return (
      <button
        type="button"
        onClick={() => setGekozen(actief ? null : k.id)}
        className={`group relative w-full max-w-[22rem] rounded-lg border bg-white px-3 py-2.5 text-left transition-colors ${actief ? 'border-amber-500 ring-2 ring-amber-200' : fout ? 'border-amber-300' : 'border-line hover:border-ink-300'}`}
      >
        <span className="flex items-start gap-2.5">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${TYPE_KLEUR[k.type]}`}>
            <Icoon type={k.type} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-warm">{KNOOP_TYPEN.find((t) => t.type === k.type)?.label}</span>
            <span className="block truncate text-[13px] font-semibold text-ink-900">{knoopTitel(k, flow)}</span>
            {sub && <span className="block truncate text-[11px] text-warm">{sub}</span>}
            {stat && stat.verzonden + stat.mislukt > 0 && (
              <span className="mt-1 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-ink-600">
                <span>{stat.verzonden} verzonden</span>
                <span>{pct(stat.geopend, stat.verzonden)} geopend</span>
                <span>{pct(stat.geklikt, stat.verzonden)} geklikt</span>
                {stat.mislukt > 0 && <span className="text-red-700">{stat.mislukt} mislukt</span>}
              </span>
            )}
            {split && split.ja + split.nee > 0 && (
              <span className="mt-1 block text-[11px] tabular-nums text-ink-600">
                {split.ja} ja · {split.nee} nee
              </span>
            )}
          </span>
        </span>
        {wachtend > 0 && (
          <span className="absolute -right-2 -top-2 rounded-full bg-ink-900 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white" title="Mensen die op deze stap wachten">
            {wachtend}
          </span>
        )}
      </button>
    );
  }

  function lijst(stappen: Knoop[], ouderId: string | null, tak: 'ja' | 'nee' | null) {
    return (
      <div className="flex w-full flex-col items-center">
        {invoeger({ ouderId, tak, index: 0 }, !!tak)}
        {stappen.map((k, i) => (
          <Fragment key={k.id}>
            {kaart(k)}
            {k.type === 'voorwaarde' && (
              <div className="mt-0 flex w-full flex-col items-center">
                <div className="h-3 w-px bg-ink-200" />
                <div className="grid w-full grid-cols-2 gap-3 border-t border-ink-200 pt-0">
                  <div className="flex flex-col items-center rounded-b-lg bg-green-50/40 px-1 pb-2">
                    <span className="-mt-px rounded-b bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-800">Ja</span>
                    {lijst(k.ja, k.id, 'ja')}
                  </div>
                  <div className="flex flex-col items-center rounded-b-lg bg-ink-50 px-1 pb-2">
                    <span className="-mt-px rounded-b bg-ink-200 px-2 py-0.5 text-[11px] font-bold text-ink-700">Nee</span>
                    {lijst(k.nee, k.id, 'nee')}
                  </div>
                </div>
                <div className="w-full border-b border-ink-200" />
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Takken komen weer samen</p>
              </div>
            )}
            {k.type !== 'einde' && invoeger({ ouderId, tak, index: i + 1 }, !!tak)}
            {k.type === 'einde' && <div className="h-3" />}
          </Fragment>
        ))}
        {tak && stappen.length === 0 && <p className="text-[11px] text-ink-400">Gaat direct door</p>}
      </div>
    );
  }

  /* ---------------- Paneel om een stap te bewerken ---------------- */

  function paneel(k: Knoop) {
    const zet = (patch: Partial<Knoop>) => wijzig((s) => werkKnoopBij(s, k.id, patch));
    const mails = mailKnopen(flow);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[13px] font-bold text-ink-900">
            <span className={`flex h-6 w-6 items-center justify-center rounded ${TYPE_KLEUR[k.type]}`}>
              <Icoon type={k.type} />
            </span>
            {KNOOP_TYPEN.find((t) => t.type === k.type)?.label}
          </p>
          <div className="flex items-center gap-0.5">
            <button type="button" className="knop-tekst px-1.5" title="Omhoog" onClick={() => wijzig((s) => verschuifKnoop(s, k.id, -1))}>
              ↑
            </button>
            <button type="button" className="knop-tekst px-1.5" title="Omlaag" onClick={() => wijzig((s) => verschuifKnoop(s, k.id, 1))}>
              ↓
            </button>
            <button type="button" className="knop-tekst" onClick={() => dupliceer(k.id)}>
              Kopie
            </button>
            <button type="button" className="knop-tekst text-red-700 hover:text-red-800" onClick={() => verwijder(k.id)}>
              Verwijderen
            </button>
          </div>
        </div>
        {(opStap[k.id] ?? 0) > 0 && (
          <p className="rounded-md bg-mist px-3 py-1.5 text-[12px] text-ink-700">
            {opStap[k.id]} {opStap[k.id] === 1 ? 'persoon wacht' : 'mensen wachten'} op deze stap.
          </p>
        )}

        {k.type === 'mail' && <MailEditor key={k.id} campagneId={campagneId} knoop={k} onChange={zet} nieuwsbrieven={props.nieuwsbrieven} mailIngesteld={props.mailIngesteld} />}

        {k.type === 'wacht' && (
          <>
            <fieldset>
              <legend className="veld-label">Hoe lang?</legend>
              <div className="grid grid-cols-3 gap-1 rounded-md border border-line bg-mist p-1">
                {(['dagen', 'uren', 'weekdag'] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={k.modus === m} onClick={() => zet({ modus: m })} className={`rounded px-2 py-1 text-[12px] font-semibold ${k.modus === m ? 'bg-white text-ink-900 shadow-sm' : 'text-warm'}`}>
                    {m === 'dagen' ? 'Dagen' : m === 'uren' ? 'Uren' : 'Tot weekdag'}
                  </button>
                ))}
              </div>
            </fieldset>
            {k.modus === 'weekdag' ? (
              <div>
                <label className="veld-label">Wacht tot</label>
                <select value={k.weekdag} onChange={(e) => zet({ weekdag: Number(e.target.value) })} className="veld">
                  {WEEKDAGEN.slice(0, 5).map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
                <p className="veld-hint">Is het vandaag al die dag, dan gaat het meteen door. Zaterdag en zondag kunnen niet: de verzending draait alleen op werkdagen.</p>
              </div>
            ) : (
              <div>
                <label className="veld-label">Aantal {k.modus}</label>
                <input type="number" min={0} max={365} value={k.aantal} onChange={(e) => zet({ aantal: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })} className="veld w-32" />
                <p className="veld-hint">
                  {k.modus === 'uren'
                    ? 'Let op: de verzending draait één keer per werkdag, rond 11:00. Een wachttijd in uren gaat dus in bij de eerstvolgende run nadat die uren voorbij zijn, in de praktijk de volgende werkdag.'
                    : 'Valt de dag in het weekend, dan gaat het maandag verder.'}
                </p>
              </div>
            )}
          </>
        )}

        {k.type === 'voorwaarde' && (
          <>
            <div>
              <label className="veld-label">Splits op</label>
              <select value={k.soort} onChange={(e) => zet({ soort: e.target.value as ConditieSoort, waarde: '' })} className="veld">
                {CONDITIE_SOORTEN.map((s) => (
                  <option key={s} value={s}>
                    {CONDITIE_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            {(k.soort === 'geopend' || k.soort === 'geklikt') && (
              <div>
                <label className="veld-label">Welke mail</label>
                <select value={k.mailId ?? ''} onChange={(e) => zet({ mailId: e.target.value || null })} className="veld">
                  <option value="">Een mail uit deze campagne</option>
                  {mails.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.onderwerp || 'Mail zonder onderwerp'}
                    </option>
                  ))}
                </select>
                <p className="veld-hint">Zet een wachtstap voor deze splitsing, anders heeft niemand de mail nog kunnen openen. Openen is een indicatie (Apple Mail opent plaatjes zelf); klikken zegt meer.</p>
              </div>
            )}
            {k.soort === 'gescand' && <p className="veld-hint">Ja als de prospect de QR-code op de brief heeft gescand nadat hij in deze campagne kwam. Voor leads en klanten altijd nee.</p>}
            {k.soort === 'gereageerd' && <p className="veld-hint">Ja als je de ontvanger bij Ontvangers op &ldquo;heeft gereageerd&rdquo; hebt gezet, of als de prospect op reageerde, geinteresseerd of gekwalificeerd staat (lead: contact, afspraak, offerte of akkoord).</p>}
            {(k.soort === 'branche' || k.soort === 'plaats' || k.soort === 'tag' || k.soort === 'status') && (
              <div>
                <label className="veld-label">{k.soort === 'tag' ? 'Tag' : k.soort === 'status' ? 'Status' : `${CONDITIE_LABEL[k.soort]} (meerdere met komma's)`}</label>
                {k.soort === 'status' ? (
                  <select value={k.waarde} onChange={(e) => zet({ waarde: e.target.value })} className="veld">
                    <option value="">Kies…</option>
                    <optgroup label="Prospect">
                      {props.prospectStatussen.map((s) => (
                        <option key={`p-${s}`} value={s}>
                          {s}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Lead">
                      {props.leadStatussen.filter((s) => !props.prospectStatussen.includes(s)).map((s) => (
                        <option key={`l-${s}`} value={s}>
                          {s}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Klant">
                      <option value="actief">actief</option>
                      <option value="inactief">inactief</option>
                    </optgroup>
                  </select>
                ) : (
                  <input value={k.waarde} onChange={(e) => zet({ waarde: e.target.value })} className="veld" placeholder={k.soort === 'branche' ? 'bouw, installatie, horeca' : k.soort === 'plaats' ? 'Doetinchem, Hengelo, Zelhem' : 'bijv. winter-2026'} />
                )}
              </div>
            )}
          </>
        )}

        {k.type === 'taak' && (
          <>
            <div>
              <label className="veld-label">Titel</label>
              <input value={k.titel} onChange={(e) => zet({ titel: e.target.value })} className="veld" placeholder="Bel {{bedrijfsnaam}}" />
            </div>
            <div>
              <label className="veld-label">Toelichting</label>
              <textarea value={k.omschrijving} onChange={(e) => zet({ omschrijving: e.target.value })} rows={3} className="veld" placeholder="Waarom bellen, wat weet je al" />
              <p className="veld-hint">De campagnenaam en de contactgegevens komen er automatisch onder.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="veld-label">Voor wie</label>
                <select value={k.persoonId ?? ''} onChange={(e) => zet({ persoonId: e.target.value || null })} className="veld">
                  <option value="">Niemand specifiek</option>
                  {props.personen.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.naam}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="veld-label">Deadline</label>
                <select value={k.binnenDagen} onChange={(e) => zet({ binnenDagen: Number(e.target.value) })} className="veld">
                  <option value={0}>Dezelfde dag</option>
                  {[1, 2, 3, 5, 10].map((d) => (
                    <option key={d} value={d}>
                      Binnen {d} {d === 1 ? 'werkdag' : 'werkdagen'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="veld-label">Prioriteit</label>
              <select value={k.prioriteit} onChange={(e) => zet({ prioriteit: e.target.value as 'laag' | 'normaal' | 'hoog' })} className="veld w-40">
                <option value="laag">Laag</option>
                <option value="normaal">Normaal</option>
                <option value="hoog">Hoog</option>
              </select>
            </div>
          </>
        )}

        {k.type === 'status' && (
          <>
            <div>
              <label className="veld-label">Als het een prospect is</label>
              <select value={k.prospectStatus} onChange={(e) => zet({ prospectStatus: e.target.value })} className="veld">
                <option value="">Niet wijzigen</option>
                {props.prospectStatussen.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="veld-label">Als het een lead is</label>
              <select value={k.leadStatus} onChange={(e) => zet({ leadStatus: e.target.value })} className="veld">
                <option value="">Niet wijzigen</option>
                {props.leadStatussen.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <p className="veld-hint">Klanten hebben geen status; voor hen doet deze stap niets.</p>
          </>
        )}

        {k.type === 'tag' && (
          <>
            <div>
              <label className="veld-label">Tag</label>
              <input value={k.tag} onChange={(e) => zet({ tag: e.target.value })} className="veld" placeholder="bijv. interesse-winter" />
              <p className="veld-hint">Tags horen bij het e-mailadres. Je gebruikt ze in een splitsing, ook in andere campagnes.</p>
            </div>
            <div>
              <label className="veld-label">Actie</label>
              <select value={k.actie} onChange={(e) => zet({ actie: e.target.value as 'toevoegen' | 'verwijderen' })} className="veld w-48">
                <option value="toevoegen">Toevoegen</option>
                <option value="verwijderen">Weghalen</option>
              </select>
            </div>
          </>
        )}

        {k.type === 'einde' && <p className="text-[13px] text-warm">Hier stopt de campagne voor deze persoon. Handig in een tak: na een beltaak hoeven ze de rest niet meer te krijgen.</p>}
      </div>
    );
  }

  /* ---------------- Opbouw van de pagina ---------------- */

  return (
    <div className="mt-4">
      <div className="sticky top-[3.5rem] z-20 -mx-5 flex flex-wrap items-center gap-3 border-b border-line bg-white/95 px-5 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <button type="button" onClick={opslaan} disabled={!kanOpslaan || bezig || !gewijzigd} className="knop-primair">
          {bezig ? 'Opslaan…' : gewijzigd ? 'Opslaan' : 'Opgeslagen'}
        </button>
        {gewijzigd && <span className="text-[12px] font-semibold text-amber-800">Niet opgeslagen wijzigingen</span>}
        {melding && <span className={`text-[12px] font-semibold ${melding.ok ? 'text-green-700' : 'text-red-700'}`}>{melding.tekst}</span>}
        {!kanOpslaan && <span className="text-[12px] text-warm">Opslaan kan na de migratie 20261004_campagnes_flow.sql.</span>}
        {problemen.length > 0 && (
          <span className="ml-auto text-[12px] text-amber-800">
            {problemen.length === 1 ? '1 punt' : `${problemen.length} punten`} voor je kunt starten:{' '}
            <button type="button" className="font-semibold underline" onClick={() => problemen[0].id && setGekozen(problemen[0].id)}>
              {problemen[0].tekst}
            </button>
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_30rem]">
        <div className="panel overflow-x-auto bg-mist/60 px-3 py-5 sm:px-6">
          <div className="mx-auto flex min-w-[20rem] max-w-3xl flex-col items-center">
            <div className="w-full max-w-[22rem] rounded-lg border border-dashed border-ink-300 bg-white px-3 py-2.5">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-warm">
                <Icoon type="trigger" /> Start
              </p>
              <p className="mt-0.5 text-[13px] font-semibold text-ink-900">{props.triggerTekst}</p>
              <a href="?tab=instellingen" className="text-[11px] font-semibold text-amber-700 hover:underline">
                Trigger en doel wijzigen
              </a>
            </div>
            {lijst(flow.stappen, null, null)}
            <div className="w-full max-w-[22rem] rounded-lg border border-dashed border-ink-300 bg-white px-3 py-2.5">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-warm">
                <Icoon type="doel" /> Doel
              </p>
              <p className="mt-0.5 text-[13px] text-ink-900">{props.doelTekst}</p>
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-[7rem] lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
          <div className="panel p-4">
            {geselecteerd ? (
              paneel(geselecteerd)
            ) : (
              <div className="text-[13px] text-warm">
                <p className="font-semibold text-ink-900">Klik op een stap om hem te bewerken.</p>
                <p className="mt-2">Met de plusjes voeg je een stap in, ook tussen bestaande stappen en in de takken van een splitsing.</p>
                <ul className="mt-3 space-y-1.5 text-[12px]">
                  <li>De verzending draait elke werkdag rond 11:00.</li>
                  <li>Iemand krijgt nooit meer dan één campagnemail per dag, ook niet uit verschillende campagnes.</li>
                  <li>Wie zich afmeldt of het doel haalt, stopt meteen.</li>
                  <li>Het zwarte rondje op een stap is het aantal mensen dat daar nu wacht.</li>
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
