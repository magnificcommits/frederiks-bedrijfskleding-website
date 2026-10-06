'use client';

import { Fragment, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import {
  filterPersonen,
  koppelOpNaam,
  lijktOpEmail,
  normaleNaam,
  SOORT_LABEL,
  type PersoonOptie,
  type PersoonSoort,
} from '@/lib/personen';
import {
  haalInternePersonenActie,
  haalKlantPersonenOptiesActie,
  maakPersoonActie,
} from '@/lib/kms/persoonActies';

/** Meer namen tegelijk leest niemand; typ verder om te verfijnen. */
const MAX_TREFFERS = 60;

const GROEP_KOP: Record<PersoonSoort, string> = {
  contact: 'Contactpersonen',
  medewerker: 'Werknemers',
  intern: "Collega's",
};

type NieuwSoort = 'contact' | 'medewerker';

type Item =
  | { soort: 'persoon'; persoon: PersoonOptie }
  | { soort: 'nieuw'; nieuw: NieuwSoort };

export type PersoonBegin = { id?: string | null; soort?: PersoonSoort | null; naam?: string | null };

/**
 * Keuzeveld voor een persoon: altijd iemand die al in het systeem staat, zodat
 * je later op die persoon kunt filteren en zoeken. Typ een paar letters, kies
 * met muis of pijltjes + Enter. Staat de persoon er nog niet in, dan maak je hem
 * onderaan meteen aan bij deze klant.
 *
 * Schrijft drie verborgen velden, zodat een gewone <form action={...}> blijft
 * werken: `<naam>` (de naam als tekst), `<naam>_id` en `<naam>_soort`
 * (contact, medewerker of intern). Lees ze op de server met leesPersoonKeuze().
 *
 * Oude invoer die alleen uit tekst bestaat, wordt bij het tonen op naam (of
 * e-mailadres) aan een bestaande persoon gekoppeld als dat eenduidig kan. Lukt
 * dat niet, dan blijft de tekst staan tot iemand een persoon kiest.
 */
export default function PersoonKiezer({
  naam,
  label,
  bron,
  orgId = null,
  soorten = ['contact', 'medewerker'],
  nieuw,
  begin,
  opties,
  placeholder,
  hint,
  disabled = false,
  onKies,
}: {
  naam: string;
  label: string;
  bron: 'klant' | 'intern';
  orgId?: string | null;
  soorten?: NieuwSoort[];
  /** Welke soort(en) je vanuit het veld kunt aanmaken. Standaard de eerste uit `soorten`; [] = niet. */
  nieuw?: NieuwSoort[];
  begin?: PersoonBegin;
  /** Vooraf geladen keuzes; zonder dit haalt de kiezer ze zelf op. */
  opties?: PersoonOptie[];
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  onKies?: (persoon: PersoonOptie | null) => void;
}) {
  const id = useId();
  const invoerId = `${id}-invoer`;
  const lijstId = `${id}-lijst`;
  const invoerRef = useRef<HTMLInputElement>(null);
  const lijstRef = useRef<HTMLUListElement>(null);

  const soortenSleutel = soorten.join(',');
  const aanmaakbaar: NieuwSoort[] = bron === 'intern' ? [] : nieuw ?? (soorten.length ? [soorten[0]] : []);
  const zonderKlant = bron === 'klant' && !orgId;

  const [lijst, setLijst] = useState<PersoonOptie[] | null>(opties ?? null);
  const [laadFout, setLaadFout] = useState(false);
  const [gekozen, setGekozen] = useState<PersoonOptie | null>(null);
  const [opNaamGekoppeld, setOpNaamGekoppeld] = useState(false);
  const [losseNaam, setLosseNaam] = useState<string | null>(null);
  const [zoek, setZoek] = useState(begin?.naam ?? '');
  const [open, setOpen] = useState(false);
  const [actief, setActief] = useState(0);
  const [nieuwForm, setNieuwForm] = useState<{ soort: NieuwSoort; naam: string; email: string; functie: string } | null>(null);
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);
  const [bezig, start] = useTransition();

  // Is de beginwaarde al tegen de lijst gelegd? Daarna niet meer: anders zou
  // een nieuwe lijst de keuze van de gebruiker overschrijven.
  const beginVerwerkt = useRef(false);
  const vorigeOrg = useRef<string | null>(orgId);

  // Vooraf geladen keuzes volgen als de ouder ze vervangt.
  useEffect(() => {
    if (opties) setLijst(opties);
  }, [opties]);

  // Zelf ophalen: bij de klant zodra die bekend is, of de collega's.
  useEffect(() => {
    if (opties) return;
    if (bron === 'klant' && !orgId) {
      setLijst([]);
      return;
    }
    let levend = true;
    setLijst(null);
    setLaadFout(false);
    const verzoek =
      bron === 'intern'
        ? haalInternePersonenActie()
        : haalKlantPersonenOptiesActie(orgId as string, soortenSleutel.split(',') as NieuwSoort[]);
    verzoek
      .then((l) => {
        if (levend) setLijst(l);
      })
      .catch(() => {
        if (levend) {
          setLijst([]);
          setLaadFout(true);
        }
      });
    return () => {
      levend = false;
    };
  }, [bron, orgId, soortenSleutel, opties]);

  // Andere klant gekozen: de vorige persoon hoort daar niet bij.
  useEffect(() => {
    if (vorigeOrg.current === orgId) return;
    vorigeOrg.current = orgId;
    beginVerwerkt.current = true;
    setGekozen(null);
    setLosseNaam(null);
    setOpNaamGekoppeld(false);
    setZoek('');
    setNieuwForm(null);
    setMelding(null);
  }, [orgId]);

  // Beginwaarde koppelen zodra de lijst er is: eerst op id, anders op naam.
  useEffect(() => {
    if (beginVerwerkt.current || lijst === null) return;
    beginVerwerkt.current = true;
    if (!begin || (!begin.id && !begin.naam?.trim())) return;
    const opId = begin.id
      ? lijst.find((p) => p.id === begin.id && (!begin.soort || p.soort === begin.soort)) ?? null
      : null;
    if (opId) {
      setGekozen(opId);
      setZoek(opId.naam);
      return;
    }
    const opNaam = koppelOpNaam(begin.naam, lijst);
    if (opNaam) {
      setGekozen(opNaam);
      setOpNaamGekoppeld(true);
      setZoek(opNaam.naam);
      return;
    }
    const tekst = begin.naam?.trim() || null;
    setLosseNaam(tekst);
    setZoek(tekst ?? '');
  }, [lijst, begin]);

  const getoond = gekozen?.naam ?? losseNaam ?? '';
  const zoekTerm = zoek === getoond ? '' : zoek;

  const items: Item[] = useMemo(() => {
    const gevonden = filterPersonen(lijst ?? [], zoekTerm).slice(0, MAX_TREFFERS);
    // Op soort groeperen, binnen de groep de volgorde van de zoekscore houden.
    const volgorde: PersoonSoort[] = ['contact', 'medewerker', 'intern'];
    const personen = volgorde.flatMap((s) => gevonden.filter((p) => p.soort === s));
    return [
      ...personen.map((p) => ({ soort: 'persoon' as const, persoon: p })),
      ...aanmaakbaar.map((n) => ({ soort: 'nieuw' as const, nieuw: n })),
    ];
    // aanmaakbaar is een afgeleide van props; de sleutel volstaat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lijst, zoekTerm, aanmaakbaar.join(',')]);

  useEffect(() => {
    lijstRef.current?.querySelector<HTMLElement>(`[data-index="${actief}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [actief]);

  function kies(p: PersoonOptie | null) {
    setGekozen(p);
    setLosseNaam(null);
    setOpNaamGekoppeld(false);
    setZoek(p?.naam ?? '');
    setOpen(false);
    setMelding(null);
    onKies?.(p);
  }

  function openNieuw(soort: NieuwSoort, tekst = zoekTerm) {
    const t = tekst.trim();
    setNieuwForm({
      soort,
      naam: lijktOpEmail(t) ? '' : t,
      email: lijktOpEmail(t) ? t : '',
      functie: '',
    });
    setOpen(false);
    setMelding(null);
  }

  function kiesItem(item: Item | undefined) {
    if (!item) return;
    if (item.soort === 'persoon') kies(item.persoon);
    else openNieuw(item.nieuw);
  }

  function maakAan() {
    if (!nieuwForm || !orgId) return;
    const invoer = { ...nieuwForm };
    if (!invoer.naam.trim()) {
      setMelding({ ok: false, tekst: 'Vul een naam in.' });
      return;
    }
    start(async () => {
      const uit = await maakPersoonActie({
        orgId,
        soort: invoer.soort,
        naam: invoer.naam,
        email: invoer.email || null,
        functie: invoer.functie || null,
      });
      if (!uit.ok) {
        setMelding({ ok: false, tekst: uit.melding });
        return;
      }
      setLijst((l) => {
        const huidig = l ?? [];
        return huidig.some((p) => p.id === uit.persoon.id) ? huidig : [...huidig, uit.persoon];
      });
      kies(uit.persoon);
      setNieuwForm(null);
      setMelding({
        ok: true,
        tekst: uit.bestond
          ? `${uit.persoon.naam} stond al bij deze klant en is gekozen.`
          : `${uit.persoon.naam} is als ${SOORT_LABEL[invoer.soort].toLowerCase()} aangemaakt en gekozen.`,
      });
      setTimeout(() => invoerRef.current?.focus(), 30);
    });
  }

  function onToets(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActief(0);
        return;
      }
      setActief((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActief((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      // Enter kiest in de lijst, maar verstuurt nooit het formulier eromheen.
      if (open || zoekTerm) {
        e.preventDefault();
        if (open) kiesItem(items[actief]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
      }
      setOpen(false);
      setZoek(getoond);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  function onBlur() {
    setTimeout(() => setOpen(false), 150);
    if (zoek === getoond) return;
    if (!zoek.trim()) {
      // Veld leeggemaakt: dan is er ook niemand gekozen.
      if (gekozen || losseNaam) kies(null);
      return;
    }
    // Precies één volledige naam getypt: die dan toch kiezen.
    const exact = (lijst ?? []).filter((p) => normaleNaam(p.naam) === normaleNaam(zoek));
    if (exact.length === 1) {
      kies(exact[0]);
      return;
    }
    // Losse tekst slaan we niet op. Wat er gekozen was, blijft staan.
    setTimeout(() => setZoek((z) => (z === zoek ? getoond : z)), 160);
  }

  // Wat er met het formulier meegaat. Zolang de lijst nog laadt, de beginwaarde,
  // zodat opslaan vóór het laden niets wist.
  const nogLaden = lijst === null && !beginVerwerkt.current;
  const verborgen = gekozen
    ? { naam: gekozen.naam, id: gekozen.id, soort: gekozen.soort }
    : losseNaam
      ? { naam: losseNaam, id: '', soort: '' }
      : nogLaden && begin
        ? { naam: begin.naam ?? '', id: begin.id ?? '', soort: begin.id ? begin.soort ?? '' : '' }
        : { naam: '', id: '', soort: '' };

  const uit = disabled || zonderKlant;
  const lijstOpen = open && !uit;
  const personenInLijst = items.filter((i) => i.soort === 'persoon').length;

  return (
    <div className="relative">
      <input type="hidden" name={naam} value={verborgen.naam} />
      <input type="hidden" name={`${naam}_id`} value={verborgen.id} />
      <input type="hidden" name={`${naam}_soort`} value={verborgen.soort} />

      <label className="veld-label" htmlFor={invoerId}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          ref={invoerRef}
          id={invoerId}
          type="text"
          role="combobox"
          aria-expanded={lijstOpen}
          aria-controls={lijstId}
          aria-autocomplete="list"
          aria-activedescendant={lijstOpen && items[actief] ? `${id}-optie-${actief}` : undefined}
          aria-describedby={`${id}-hint`}
          autoComplete="off"
          disabled={uit}
          value={zoek}
          placeholder={
            zonderKlant
              ? 'Kies eerst een klant'
              : placeholder ?? (bron === 'intern' ? 'Zoek een collega' : 'Typ een naam, functie of e-mail')
          }
          onChange={(e) => {
            setZoek(e.target.value);
            setOpen(true);
            setActief(0);
          }}
          // Staat er al iemand, dan niet vanzelf openklappen bij focus (bijv. na aanmaken).
          onFocus={() => {
            if (!gekozen) setOpen(true);
          }}
          onClick={() => setOpen(true)}
          onBlur={onBlur}
          onKeyDown={onToets}
          className="veld disabled:bg-mist disabled:text-warm"
        />
        {(gekozen || losseNaam) && !uit && (
          <button
            type="button"
            onClick={() => {
              kies(null);
              setTimeout(() => invoerRef.current?.focus(), 30);
            }}
            className="knop-tekst shrink-0 text-[13px]"
            aria-label={`${label} leegmaken`}
          >
            Wissen
          </button>
        )}
      </div>

      {lijstOpen && (
        <ul
          id={lijstId}
          ref={lijstRef}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-md border border-line bg-white py-1 shadow-card"
        >
          {lijst === null && <li role="presentation" className="px-3 py-2 text-[13px] text-warm">Namen laden...</li>}
          {lijst !== null && personenInLijst === 0 && (
            <li role="presentation" className="px-3 py-2 text-[13px] text-warm">
              {(lijst.length === 0
                ? bron === 'intern'
                  ? "Er staan nog geen collega's in het systeem."
                  : 'Bij deze klant staat nog niemand.'
                : 'Niemand gevonden met deze naam.') + (aanmaakbaar.length ? ' Maak hieronder iemand aan.' : '')}
            </li>
          )}
          {items.map((item, i) => {
            const vorige = items[i - 1];
            const kop =
              item.soort === 'persoon' &&
              (!vorige || vorige.soort !== 'persoon' || vorige.persoon.soort !== item.persoon.soort) &&
              (soorten.length > 1 || bron === 'intern') ? (
                <li
                  role="presentation"
                  className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-warm"
                >
                  {GROEP_KOP[item.persoon.soort]}
                </li>
              ) : null;
            const isActief = i === actief;
            if (item.soort === 'nieuw') {
              return (
                <li
                  key={`nieuw-${item.nieuw}`}
                  id={`${id}-optie-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isActief}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    kiesItem(item);
                  }}
                  onMouseEnter={() => setActief(i)}
                  className={`cursor-pointer border-t border-line px-3 py-2 text-[13px] font-semibold text-amber-700 ${
                    isActief ? 'bg-amber-50' : ''
                  }`}
                >
                  + Nieuwe {item.nieuw === 'contact' ? 'contactpersoon' : 'werknemer'}
                  {zoekTerm.trim() && <span className="font-normal text-warm"> &ldquo;{zoekTerm.trim()}&rdquo;</span>}
                </li>
              );
            }
            const p = item.persoon;
            const extra = [p.functie, p.email].filter(Boolean).join(' · ');
            return (
              <Fragment key={`${p.soort}-${p.id}`}>
              {kop}
              <li
                id={`${id}-optie-${i}`}
                data-index={i}
                role="option"
                aria-selected={isActief}
                onMouseDown={(e) => {
                  e.preventDefault();
                  kies(p);
                }}
                onMouseEnter={() => setActief(i)}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-[14px] ${
                  isActief ? 'bg-amber-50' : ''
                }`}
              >
                <span className="min-w-0 truncate font-semibold text-ink-900">
                  {p.naam}
                  {p.hoofdcontact && (
                    <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      hoofdcontact
                    </span>
                  )}
                  {gekozen?.id === p.id && <span className="ml-2 text-[12px] text-amber-700">gekozen</span>}
                </span>
                {extra && <span className="shrink-0 truncate text-[12px] text-warm">{extra}</span>}
              </li>
              </Fragment>
            );
          })}
        </ul>
      )}

      <div id={`${id}-hint`}>
        {zonderKlant ? null : gekozen ? (
          <p className="veld-hint">
            {SOORT_LABEL[gekozen.soort]}
            {gekozen.functie ? ` · ${gekozen.functie}` : ''}
            {gekozen.email ? ` · ${gekozen.email}` : ''}
            {opNaamGekoppeld && ' · op naam herkend, sla op om de koppeling vast te leggen'}
          </p>
        ) : losseNaam ? (
          <p className="veld-hint text-amber-800">
            Nu ingevuld als tekst: &ldquo;{losseNaam}&rdquo;. Die staat nog niet als persoon in het systeem.
            {aanmaakbaar.length > 0 && !uit && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => openNieuw(aanmaakbaar[0], losseNaam)}
                  className="font-semibold text-amber-700 underline hover:text-amber-800"
                >
                  Aanmaken als {aanmaakbaar[0] === 'contact' ? 'contactpersoon' : 'werknemer'}
                </button>
              </>
            )}
          </p>
        ) : laadFout ? (
          <p className="veld-hint text-red-700">De namen konden niet worden geladen. Herlaad de pagina.</p>
        ) : hint ? (
          <p className="veld-hint">{hint}</p>
        ) : null}
      </div>

      {nieuwForm && orgId && (
        <div
          className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3"
          role="group"
          aria-label={`Nieuwe ${nieuwForm.soort === 'contact' ? 'contactpersoon' : 'werknemer'}`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setNieuwForm(null);
              setTimeout(() => invoerRef.current?.focus(), 30);
            }
          }}
        >
          <p className="text-[13px] font-semibold text-ink-900">
            Nieuwe {nieuwForm.soort === 'contact' ? 'contactpersoon' : 'werknemer'} bij deze klant
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {/* Geen name-attributen: deze velden horen niet bij het formulier eromheen. */}
            <div>
              <label className="veld-label" htmlFor={`${id}-nieuw-naam`}>Naam</label>
              <input
                id={`${id}-nieuw-naam`}
                autoFocus
                value={nieuwForm.naam}
                onChange={(e) => setNieuwForm({ ...nieuwForm, naam: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    maakAan();
                  }
                }}
                placeholder="Voor- en achternaam"
                autoComplete="off"
                className="veld"
              />
            </div>
            <div>
              <label className="veld-label" htmlFor={`${id}-nieuw-mail`}>E-mail (optioneel)</label>
              <input
                id={`${id}-nieuw-mail`}
                type="email"
                value={nieuwForm.email}
                onChange={(e) => setNieuwForm({ ...nieuwForm, email: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    maakAan();
                  }
                }}
                placeholder="naam@bedrijf.nl"
                autoComplete="off"
                className="veld"
              />
            </div>
            {nieuwForm.soort === 'contact' && (
              <div className="sm:col-span-2">
                <label className="veld-label" htmlFor={`${id}-nieuw-functie`}>Functie (optioneel)</label>
                <input
                  id={`${id}-nieuw-functie`}
                  value={nieuwForm.functie}
                  onChange={(e) => setNieuwForm({ ...nieuwForm, functie: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      maakAan();
                    }
                  }}
                  placeholder="Bijv. inkoper, office manager"
                  autoComplete="off"
                  className="veld"
                />
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={maakAan} disabled={bezig} className="knop-donker">
              {bezig ? 'Aanmaken...' : 'Aanmaken en kiezen'}
            </button>
            <button
              type="button"
              onClick={() => {
                setNieuwForm(null);
                setMelding(null);
              }}
              className="knop-stil"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      <p role="status" aria-live="polite" className={melding ? `veld-hint font-semibold ${melding.ok ? 'text-green-700' : 'text-red-700'}` : 'sr-only'}>
        {melding?.tekst ?? ''}
      </p>
    </div>
  );
}
