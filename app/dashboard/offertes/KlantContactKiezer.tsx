'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { OfferteContact, OfferteKlant } from '@/lib/kms/offertes';
import { haalContactenActie } from './actions';

/** Meer dan dit tegelijk in de keuzelijst leest niemand. */
const MAX_TREFFERS = 12;

const groot = 'veld py-2.5 text-[15px]';

/**
 * Klant zoeken en kiezen terwijl je typt, en daarna de contactpersoon kiezen uit
 * de contactpersonen van die klant. Levert twee formuliervelden op:
 * `organisatie_id` (verborgen) en `contactpersoon` (tekst, mag ook een andere naam zijn).
 */
export default function KlantContactKiezer({
  klanten,
  beginKlantId = '',
  beginContact = '',
  autoFocus = false,
}: {
  klanten: OfferteKlant[];
  beginKlantId?: string;
  beginContact?: string;
  autoFocus?: boolean;
}) {
  const beginKlant = klanten.find((k) => k.id === beginKlantId) ?? null;
  const [klant, setKlant] = useState<OfferteKlant | null>(beginKlant);
  const [zoek, setZoek] = useState(beginKlant?.naam ?? '');
  const [open, setOpen] = useState(false);
  const [actief, setActief] = useState(0);
  const [contacten, setContacten] = useState<OfferteContact[]>([]);
  const [contactStand, setContactStand] = useState<'geen' | 'laden' | 'klaar'>('geen');
  const [contact, setContact] = useState(beginContact);
  const laatsteAanvraag = useRef('');
  const lijstRef = useRef<HTMLUListElement>(null);

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

  function kies(k: OfferteKlant | null) {
    const andereKlant = (k?.id ?? '') !== (klant?.id ?? '');
    setKlant(k);
    setZoek(k?.naam ?? '');
    setOpen(false);
    // Bij een andere klant hoort de oude contactpersoon er niet meer bij.
    if (andereKlant) setContact('');
  }

  // Bij de enige contactpersoon of een hoofdcontact meteen invullen, als er nog niets staat.
  useEffect(() => {
    if (contactStand !== 'klaar' || contact.trim()) return;
    const voorkeur = contacten.length === 1 ? contacten[0] : contacten.find((c) => c.hoofdcontact);
    if (voorkeur) setContact(voorkeur.naam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactStand, contacten]);

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

  useEffect(() => {
    lijstRef.current?.querySelector<HTMLElement>(`[data-index="${actief}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [actief]);

  return (
    <div className="space-y-5">
      <input type="hidden" name="organisatie_id" value={klant?.id ?? ''} />

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
            onFocus={() => setOpen(true)}
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
        <label className="veld-label" htmlFor="contact-naam">Contactpersoon</label>
        {klant && contactStand === 'laden' && <p className="veld-hint mb-2">Contactpersonen laden...</p>}
        {klant && contactStand === 'klaar' && contacten.length > 0 && (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {contacten.map((c) => {
              const gekozen = contact.trim().toLowerCase() === c.naam.toLowerCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setContact(c.naam)}
                  aria-pressed={gekozen}
                  className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                    gekozen ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' : 'border-line bg-white hover:border-amber-400 hover:bg-mist'
                  }`}
                >
                  <span className="block text-[15px] font-semibold text-ink-900">
                    {c.naam}
                    {c.hoofdcontact && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">hoofdcontact</span>}
                  </span>
                  <span className="block truncate text-[13px] text-warm">
                    {[c.functie, c.email].filter(Boolean).join(' · ') || 'Geen functie of e-mail bekend'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {klant && contactStand === 'klaar' && contacten.length === 0 && (
          <p className="veld-hint mb-2">Bij deze klant staan nog geen contactpersonen. Typ hieronder een naam.</p>
        )}
        <input
          id="contact-naam"
          name="contactpersoon"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={klant && contacten.length > 0 ? 'Klik hierboven een naam aan, of typ een andere naam' : 'Naam van de contactpersoon'}
          className={groot}
        />
      </div>
    </div>
  );
}
