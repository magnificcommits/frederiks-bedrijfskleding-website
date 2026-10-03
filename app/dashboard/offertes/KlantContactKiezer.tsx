'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { OfferteContact, OfferteKlant } from '@/lib/kms/offertes';
import { haalContactenActie, maakContactVoorOfferteActie } from './actions';

/** Meer dan dit tegelijk in de keuzelijst leest niemand. */
const MAX_TREFFERS = 12;

const groot = 'veld py-2.5 text-[15px]';

/** Wat de kiezer doorgeeft aan wie meeluistert (bijvoorbeeld het live voorbeeld). */
export type KlantContactWijziging = {
  klant: OfferteKlant | null;
  /** De gekozen contactpersoon uit de lijst, of null. */
  contact: OfferteContact | null;
  /** Naam zoals hij op de offerte komt (ook een oude, niet gekoppelde naam). */
  contactNaam: string;
};

/** Keuze: met id = gekoppeld aan een contactpersoon; zonder id = oude losse naam. */
type Keuze = { id: string | null; naam: string };

const leeg = { naam: '', email: '', functie: '', telefoon: '' };

/**
 * Klant zoeken en kiezen terwijl je typt, en daarna de contactpersoon kiezen uit
 * de contactpersonen van die klant. Een naam typen kan niet meer: staat de persoon
 * er niet bij, dan maak je hem hier aan en staat hij daarna ook op de klantkaart.
 *
 * Levert drie formuliervelden op: `organisatie_id`, `contactpersoon_id` en
 * `contactpersoon` (de naam, voor weergave en oudere offertes). De server haalt de
 * naam bij een gekozen id zelf opnieuw op.
 */
export default function KlantContactKiezer({
  klanten,
  beginKlantId = '',
  beginContact = '',
  beginContactId = '',
  autoFocus = false,
  stelVoor = true,
  onWijzig,
}: {
  klanten: OfferteKlant[];
  beginKlantId?: string;
  /** Naam zoals die nu op de offerte staat. */
  beginContact?: string;
  /** Gekoppelde contactpersoon (of op naam gevonden), als die er is. */
  beginContactId?: string;
  autoFocus?: boolean;
  /**
   * De enige contactpersoon of het hoofdcontact vanzelf kiezen als er nog niemand
   * gekozen is. Op een bestaande offerte uit (anders komt een bewust weggehaalde
   * contactpersoon na opslaan terug); na het kiezen van een andere klant altijd aan.
   */
  stelVoor?: boolean;
  onWijzig?: (w: KlantContactWijziging) => void;
}) {
  const beginKlant = klanten.find((k) => k.id === beginKlantId) ?? null;
  const [klant, setKlant] = useState<OfferteKlant | null>(beginKlant);
  const [zoek, setZoek] = useState(beginKlant?.naam ?? '');
  const [open, setOpen] = useState(false);
  const [actief, setActief] = useState(0);
  const [contacten, setContacten] = useState<OfferteContact[]>([]);
  const [contactStand, setContactStand] = useState<'geen' | 'laden' | 'klaar'>('geen');
  const [keuze, setKeuze] = useState<Keuze>({ id: beginContactId || null, naam: beginContact.trim() });
  const [nieuwOpen, setNieuwOpen] = useState(false);
  const [nieuw, setNieuw] = useState(leeg);
  const [nieuwBezig, setNieuwBezig] = useState(false);
  const [nieuwFout, setNieuwFout] = useState('');
  const [melding, setMelding] = useState('');
  const laatsteAanvraag = useRef('');
  const lijstRef = useRef<HTMLUListElement>(null);
  const nieuwNaamRef = useRef<HTMLInputElement>(null);
  const magVoorstellen = useRef(stelVoor);
  const onWijzigRef = useRef(onWijzig);
  onWijzigRef.current = onWijzig;

  const treffers = useMemo(() => {
    const delen = zoek.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (delen.length === 0) return klanten.slice(0, MAX_TREFFERS);
    return klanten
      .filter((k) => {
        const tekst = `${k.naam} ${k.plaats ?? ''} ${k.klantnummer ?? ''}`.toLowerCase();
        return delen.every((d) => tekst.includes(d));
      })
      .slice(0, MAX_TREFFERS);
  }, [zoek, klanten]);

  const gekozen = keuze.id ? contacten.find((c) => c.id === keuze.id) ?? null : null;
  // Een naam zonder koppeling: van een oudere offerte, of de koppeling bestaat niet meer.
  const nietGekoppeld = !keuze.id && keuze.naam !== '' && (contactStand === 'klaar' || !klant);

  // Contactpersonen ophalen zodra er een klant gekozen is.
  useEffect(() => {
    const id = klant?.id ?? '';
    laatsteAanvraag.current = id;
    if (!id) {
      setContacten([]);
      setContactStand('geen');
      return;
    }
    setContactStand('laden');
    haalContactenActie(id)
      .then((lijst) => {
        if (laatsteAanvraag.current !== id) return;
        setContacten(lijst);
        setContactStand('klaar');
      })
      .catch(() => {
        if (laatsteAanvraag.current !== id) return;
        setContacten([]);
        setContactStand('klaar');
      });
  }, [klant?.id]);

  // Na het laden de keuze rechtzetten:
  // - gekoppelde persoon bestaat niet meer bij deze klant: terug naar alleen de naam;
  // - losse naam die precies één keer bij de klant staat: alsnog koppelen;
  // - nog niets gekozen: de enige contactpersoon of het hoofdcontact voorstellen.
  useEffect(() => {
    if (contactStand !== 'klaar') return;
    setKeuze((k) => {
      if (k.id) return contacten.some((c) => c.id === k.id) ? k : { id: null, naam: k.naam };
      if (k.naam) {
        const zelfde = contacten.filter((c) => c.naam.trim().toLowerCase() === k.naam.toLowerCase());
        return zelfde.length === 1 ? { id: zelfde[0].id, naam: zelfde[0].naam } : k;
      }
      if (!magVoorstellen.current) return k;
      const voorkeur = contacten.length === 1 ? contacten[0] : contacten.find((c) => c.hoofdcontact);
      return voorkeur ? { id: voorkeur.id, naam: voorkeur.naam } : k;
    });
  }, [contactStand, contacten]);

  // Meeluisteraars (live voorbeeld, mailadres) op de hoogte houden.
  useEffect(() => {
    onWijzigRef.current?.({ klant, contact: gekozen, contactNaam: gekozen?.naam ?? keuze.naam });
  }, [klant, gekozen, keuze.naam]);

  useEffect(() => {
    if (nieuwOpen) nieuwNaamRef.current?.focus();
  }, [nieuwOpen]);

  function kies(k: OfferteKlant | null) {
    const andereKlant = (k?.id ?? '') !== (klant?.id ?? '');
    setKlant(k);
    setZoek(k?.naam ?? '');
    setOpen(false);
    // Bij een andere klant hoort de oude contactpersoon er niet meer bij.
    if (andereKlant) {
      magVoorstellen.current = true;
      setKeuze({ id: null, naam: '' });
      setNieuwOpen(false);
      setMelding('');
    }
  }

  function kiesContact(c: OfferteContact | null) {
    setKeuze(c ? { id: c.id, naam: c.naam } : { id: null, naam: '' });
    setMelding('');
  }

  function openNieuw(naam = '') {
    setNieuw({ ...leeg, naam });
    setNieuwFout('');
    setNieuwOpen(true);
  }

  async function bewaarNieuw() {
    if (!klant || nieuwBezig) return;
    if (!nieuw.naam.trim()) {
      setNieuwFout('Vul een naam in.');
      nieuwNaamRef.current?.focus();
      return;
    }
    setNieuwBezig(true);
    setNieuwFout('');
    try {
      const uit = await maakContactVoorOfferteActie(klant.id, nieuw);
      if (!uit.ok) {
        setNieuwFout(uit.fout);
        return;
      }
      setContacten((lijst) => [...lijst, uit.contact]);
      setKeuze({ id: uit.contact.id, naam: uit.contact.naam });
      setNieuwOpen(false);
      setNieuw(leeg);
      setMelding(`${uit.contact.naam} is toegevoegd aan de contactpersonen van ${klant.naam} en gekozen.`);
    } catch {
      setNieuwFout('Opslaan is niet gelukt. Controleer de verbinding en probeer het nog een keer.');
    } finally {
      setNieuwBezig(false);
    }
  }

  function onToets(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActief((i) => Math.min(i + 1, Math.max(treffers.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActief((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && treffers[actief]) {
        e.preventDefault();
        kies(treffers[actief]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setZoek(klant?.naam ?? '');
    }
  }

  /** In het mini-formulier: Enter bewaart de contactpersoon in plaats van de hele offerte. */
  function onNieuwToets(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void bewaarNieuw();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setNieuwOpen(false);
    }
  }

  useEffect(() => {
    lijstRef.current?.querySelector<HTMLElement>(`[data-index="${actief}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [actief]);

  return (
    <div className="space-y-5">
      <input type="hidden" name="organisatie_id" value={klant?.id ?? ''} />
      <input type="hidden" name="contactpersoon_id" value={keuze.id ?? ''} />
      <input type="hidden" name="contactpersoon" value={keuze.naam} />

      <div className="relative">
        <label className="veld-label" htmlFor="klant-zoek">Klant</label>
        <div className="flex gap-2">
          <input
            id="klant-zoek"
            role="combobox"
            aria-expanded={open}
            aria-controls="klant-lijst"
            aria-autocomplete="list"
            autoComplete="off"
            autoFocus={autoFocus}
            value={zoek}
            onChange={(e) => {
              setZoek(e.target.value);
              setOpen(true);
              setActief(0);
              if (klant && e.target.value !== klant.naam) setKlant(null);
            }}
            // Is er al een klant gekozen (bv. via 'Nieuwe offerte' op de klantkaart), dan
            // de lijst niet vanzelf openklappen: die viel anders over de contactpersonen.
            onFocus={() => {
              if (!klant) setOpen(true);
            }}
            onClick={() => setOpen(true)}
            onBlur={() => {
              setTimeout(() => setOpen(false), 150);
              // Volledige naam getypt zonder te klikken: die klant dan toch kiezen,
              // anders zou opslaan de klant van de offerte loskoppelen.
              if (!klant && zoek.trim()) {
                const exact = klanten.filter((k) => k.naam.trim().toLowerCase() === zoek.trim().toLowerCase());
                if (exact.length === 1) kies(exact[0]);
              }
            }}
            onKeyDown={onToets}
            placeholder="Typ de naam, plaats of het klantnummer"
            className={groot}
          />
          {klant && (
            <button type="button" onClick={() => kies(null)} className="knop-stil shrink-0">
              Wissen
            </button>
          )}
        </div>
        {klant ? (
          <p className="veld-hint">
            Gekozen: <span className="font-semibold text-ink-900">{klant.naam}</span>
            {klant.plaats ? `, ${klant.plaats}` : ''}
            {klant.klantnummer ? ` (klantnummer ${klant.klantnummer})` : ''}
          </p>
        ) : (
          <p className="veld-hint">Nog geen klant gekozen. Een offerte zonder klant mag ook, bijvoorbeeld voor een nieuwe relatie.</p>
        )}

        {open && (
          <ul
            id="klant-lijst"
            ref={lijstRef}
            role="listbox"
            className="absolute left-0 right-0 z-20 mt-1 max-h-80 overflow-y-auto rounded-md border border-line bg-white py-1 shadow-card"
          >
            {treffers.length === 0 ? (
              <li className="px-3 py-2.5 text-[14px] text-warm">Geen klant gevonden met deze naam.</li>
            ) : (
              treffers.map((k, i) => (
                <li
                  key={k.id}
                  data-index={i}
                  role="option"
                  aria-selected={klant?.id === k.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    kies(k);
                  }}
                  onMouseEnter={() => setActief(i)}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2.5 text-[15px] ${
                    i === actief ? 'bg-amber-50' : ''
                  }`}
                >
                  <span className="font-semibold text-ink-900">{k.naam}</span>
                  <span className="shrink-0 text-[13px] text-warm">
                    {[k.plaats, k.klantnummer ? `nr. ${k.klantnummer}` : ''].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="veld-label" id="contact-label">Contactpersoon</p>
          {keuze.id && (
            <button type="button" onClick={() => kiesContact(null)} className="text-[12px] font-semibold text-warm hover:text-ink-900">
              Geen contactpersoon
            </button>
          )}
        </div>

        {!klant && (
          <p className="veld-hint">Kies eerst een klant. Daarna kies je de contactpersoon uit de contactpersonen van die klant.</p>
        )}

        {nietGekoppeld && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
            <p>
              <span className="font-semibold">Niet gekoppeld: kies een contactpersoon.</span> Op deze offerte staat
              {' '}&lsquo;{keuze.naam}&rsquo;{klant ? `, maar die staat niet (eenduidig) bij de contactpersonen van ${klant.naam}.` : ' als losse naam.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {klant && !nieuwOpen && (
                <button type="button" onClick={() => openNieuw(keuze.naam)} className="font-semibold underline underline-offset-2 hover:text-ink-900">
                  &lsquo;{keuze.naam}&rsquo; toevoegen als contactpersoon
                </button>
              )}
              <button type="button" onClick={() => kiesContact(null)} className="font-semibold underline underline-offset-2 hover:text-ink-900">
                Naam weghalen
              </button>
            </div>
          </div>
        )}

        {klant && contactStand === 'laden' && <p className="veld-hint">Contactpersonen laden...</p>}

        {klant && contactStand === 'klaar' && (
          <div role="radiogroup" aria-labelledby="contact-label" className="grid gap-2 sm:grid-cols-2">
            {contacten.map((c) => {
              const isGekozen = keuze.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={isGekozen}
                  onClick={() => kiesContact(c)}
                  className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                    isGekozen ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' : 'border-line bg-white hover:border-amber-400 hover:bg-mist'
                  }`}
                >
                  <span className="block text-[15px] font-semibold text-ink-900">
                    {c.naam}
                    {c.hoofdcontact && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">hoofdcontact</span>}
                    {isGekozen && <span className="ml-2 text-[12px] font-semibold text-amber-700">✓ gekozen</span>}
                  </span>
                  <span className="block truncate text-[13px] text-warm">
                    {[c.functie, c.email].filter(Boolean).join(' · ') || 'Geen functie of e-mail bekend'}
                  </span>
                </button>
              );
            })}
            {!nieuwOpen && (
              <button
                type="button"
                onClick={() => openNieuw()}
                className="rounded-md border border-dashed border-line px-3 py-2.5 text-left text-[14px] font-semibold text-ink-700 hover:border-amber-400 hover:bg-mist"
              >
                + Nieuwe contactpersoon
                <span className="block text-[12px] font-normal text-warm">
                  {contacten.length === 0 ? `Bij ${klant.naam} staat nog niemand.` : 'Staat de persoon er niet bij? Voeg hem hier toe.'}
                </span>
              </button>
            )}
          </div>
        )}

        {klant && nieuwOpen && (
          // Bewust geen <form>: dit staat binnen het offerteformulier. De velden hebben
          // geen name, zodat ze niet met de offerte mee worden verstuurd.
          <div className="mt-3 rounded-md border border-line bg-mist p-3" role="group" aria-label="Nieuwe contactpersoon">
            <p className="text-[13px] font-semibold text-ink-900">Nieuwe contactpersoon bij {klant.naam}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="veld-label" htmlFor="nieuw-contact-naam">Naam</label>
                <input
                  id="nieuw-contact-naam"
                  ref={nieuwNaamRef}
                  value={nieuw.naam}
                  onChange={(e) => setNieuw((n) => ({ ...n, naam: e.target.value }))}
                  onKeyDown={onNieuwToets}
                  autoComplete="off"
                  required
                  className="veld"
                />
              </div>
              <div>
                <label className="veld-label" htmlFor="nieuw-contact-email">E-mail</label>
                <input
                  id="nieuw-contact-email"
                  type="email"
                  value={nieuw.email}
                  onChange={(e) => setNieuw((n) => ({ ...n, email: e.target.value }))}
                  onKeyDown={onNieuwToets}
                  autoComplete="off"
                  placeholder="naam@bedrijf.nl"
                  className="veld"
                />
              </div>
              <div>
                <label className="veld-label" htmlFor="nieuw-contact-functie">Functie</label>
                <input
                  id="nieuw-contact-functie"
                  value={nieuw.functie}
                  onChange={(e) => setNieuw((n) => ({ ...n, functie: e.target.value }))}
                  onKeyDown={onNieuwToets}
                  autoComplete="off"
                  placeholder="Bijvoorbeeld inkoper"
                  className="veld"
                />
              </div>
              <div>
                <label className="veld-label" htmlFor="nieuw-contact-telefoon">Telefoon</label>
                <input
                  id="nieuw-contact-telefoon"
                  type="tel"
                  value={nieuw.telefoon}
                  onChange={(e) => setNieuw((n) => ({ ...n, telefoon: e.target.value }))}
                  onKeyDown={onNieuwToets}
                  autoComplete="off"
                  className="veld"
                />
              </div>
            </div>
            {nieuwFout && <p role="alert" className="mt-2 text-[13px] font-medium text-red-700">{nieuwFout}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void bewaarNieuw()} disabled={nieuwBezig} aria-busy={nieuwBezig || undefined} className="knop-donker">
                {nieuwBezig ? 'Bezig met opslaan…' : 'Toevoegen en kiezen'}
              </button>
              <button type="button" onClick={() => setNieuwOpen(false)} disabled={nieuwBezig} className="knop-tekst">
                Annuleren
              </button>
            </div>
            <p className="veld-hint">Komt direct bij de contactpersonen van de klant te staan, ook als je de offerte niet opslaat.</p>
          </div>
        )}

        {melding && <p role="status" className="veld-hint text-green-800">{melding}</p>}
      </div>
    </div>
  );
}
