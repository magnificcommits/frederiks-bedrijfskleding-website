'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import OfferteDocument, { type OfferteDocumentData } from '@/components/dashboard/OfferteDocument';

/**
 * Live voorbeeld van de offerte zoals de klant hem krijgt.
 *
 * - De opgeslagen offerte komt elke keer vers van de server binnen (`opgeslagen`).
 *   Na elke server action (regel toevoegen, wijzigen, verwijderen, kopgegevens
 *   opslaan) rendert de pagina opnieuw, en daarmee ook het voorbeeld.
 * - Nog niet opgeslagen kopgegevens (klant, contactpersoon, geldig tot, btw, notitie)
 *   zet het kopgegevensformulier via deze context in `concept`. Het voorbeeld legt
 *   die over de opgeslagen offerte heen, zodat je ziet wat je typt.
 * - Het document zelf is hetzelfde component als de afdruk-/PDF-weergave.
 */

/** Kopgegevens zoals ze in het formulier staan, nog niet (per se) opgeslagen. */
export type KopConcept = {
  organisatie_naam: string | null;
  contactpersoon: string | null;
  geldig_tot: string | null;
  btw_pct: number | null;
  notitie: string | null;
  /** Alleen voor het mailadres: e-mail en id van de gekozen contactpersoon. */
  contactEmail: string | null;
  contactId: string | null;
};

type VoorbeeldContext = {
  open: boolean;
  zetOpen: (open: boolean) => void;
  /** Breed scherm: voorbeeld naast het werkblad. Anders als volledige overlay. */
  breed: boolean;
  opgeslagen: OfferteDocumentData;
  afdrukHref: string;
  concept: Partial<KopConcept>;
  zetConcept: (deel: Partial<KopConcept>) => void;
};

const Ctx = createContext<VoorbeeldContext | null>(null);

export function useOfferteVoorbeeld(): VoorbeeldContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOfferteVoorbeeld werkt alleen binnen OfferteVoorbeeldProvider');
  return ctx;
}

const OPSLAG_SLEUTEL = 'fb.offerte.voorbeeld';
/** Vanaf deze breedte past het voorbeeld naast het werkblad (1440-1920 is het doel). */
const BREED_MEDIA = '(min-width: 1400px)';

function leesOpslag(): boolean {
  try {
    return window.localStorage.getItem(OPSLAG_SLEUTEL) === 'open';
  } catch {
    return false;
  }
}

function schrijfOpslag(open: boolean) {
  try {
    window.localStorage.setItem(OPSLAG_SLEUTEL, open ? 'open' : 'dicht');
  } catch {
    // Privévenster of geblokkeerde opslag: dan onthouden we het gewoon niet.
  }
}

export function OfferteVoorbeeldProvider({
  opgeslagen,
  afdrukHref,
  children,
}: {
  opgeslagen: OfferteDocumentData;
  afdrukHref: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [breed, setBreed] = useState(false);
  const [concept, setConcept] = useState<Partial<KopConcept>>({});

  useEffect(() => {
    const mq = window.matchMedia(BREED_MEDIA);
    setBreed(mq.matches);
    // Alleen op een breed scherm vanzelf weer openen: op een telefoon zou je
    // anders bij elke offerte eerst een scherm vullende overlay moeten sluiten.
    if (mq.matches && leesOpslag()) setOpen(true);
    const opWijziging = (e: MediaQueryListEvent) => setBreed(e.matches);
    mq.addEventListener('change', opWijziging);
    return () => mq.removeEventListener('change', opWijziging);
  }, []);

  const zetOpen = useCallback((nieuw: boolean) => {
    setOpen(nieuw);
    schrijfOpslag(nieuw);
  }, []);

  const zetConcept = useCallback((deel: Partial<KopConcept>) => {
    setConcept((c) => {
      const keys = Object.keys(deel) as (keyof KopConcept)[];
      if (keys.every((k) => c[k] === deel[k])) return c;
      return { ...c, ...deel };
    });
  }, []);

  const waarde = useMemo(
    () => ({ open, zetOpen, breed, opgeslagen, afdrukHref, concept, zetConcept }),
    [open, zetOpen, breed, opgeslagen, afdrukHref, concept, zetConcept],
  );
  return <Ctx.Provider value={waarde}>{children}</Ctx.Provider>;
}

/** Knop in de paginakop. */
export function VoorbeeldKnop() {
  const { open, zetOpen } = useOfferteVoorbeeld();
  return (
    <button
      type="button"
      onClick={() => zetOpen(!open)}
      aria-pressed={open}
      aria-controls="offerte-voorbeeld"
      className={open ? 'knop-donker' : 'knop-stil'}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M1.5 10s3.2-5.5 8.5-5.5S18.5 10 18.5 10s-3.2 5.5-8.5 5.5S1.5 10 1.5 10Z" />
        <circle cx="10" cy="10" r="2.5" />
      </svg>
      Voorbeeld
    </button>
  );
}

const tekstGelijk = (a: string | null | undefined, b: string | null | undefined) => (a ?? '').trim() === (b ?? '').trim();

/** Opgeslagen offerte met de niet-opgeslagen kopgegevens eroverheen. */
function samengevoegd(opgeslagen: OfferteDocumentData, concept: Partial<KopConcept>): { data: OfferteDocumentData; afwijkend: boolean } {
  const data: OfferteDocumentData = { ...opgeslagen };
  let afwijkend = false;
  if ('organisatie_naam' in concept) {
    data.organisatie_naam = concept.organisatie_naam ?? null;
    if (!tekstGelijk(concept.organisatie_naam, opgeslagen.organisatie_naam)) {
      afwijkend = true;
      // Het adres hoort bij de opgeslagen klant; bij een andere klant laten we het weg.
      data.klant_adres = null;
    }
  }
  if ('contactpersoon' in concept) {
    data.contactpersoon = concept.contactpersoon?.trim() || null;
    if (!tekstGelijk(concept.contactpersoon, opgeslagen.contactpersoon)) afwijkend = true;
  }
  if ('geldig_tot' in concept) {
    data.geldig_tot = concept.geldig_tot || null;
    if ((concept.geldig_tot ?? '').slice(0, 10) !== (opgeslagen.geldig_tot ?? '').slice(0, 10)) afwijkend = true;
  }
  if ('btw_pct' in concept) {
    data.btw_pct = concept.btw_pct ?? 21;
    if (Number(data.btw_pct) !== Number(opgeslagen.btw_pct ?? 21)) afwijkend = true;
  }
  if ('notitie' in concept) {
    data.notitie = concept.notitie?.trim() || null;
    if (!tekstGelijk(concept.notitie, opgeslagen.notitie)) afwijkend = true;
  }
  return { data, afwijkend };
}

/**
 * Indeling van de offertepagina. Met het voorbeeld open op een breed scherm staat het
 * voorbeeld rechts naast het werkblad en schuift het spoor (totalen, status,
 * versturen) onder het werkblad. De boom blijft gelijk, zodat getypte waarden in
 * de formulieren niet verdwijnen als je het voorbeeld opent of sluit.
 */
export function VoorbeeldIndeling({ werkblad, spoor }: { werkblad: React.ReactNode; spoor: React.ReactNode }) {
  const { open, breed } = useOfferteVoorbeeld();
  const [gemount, setGemount] = useState(false);
  useEffect(() => setGemount(true), []);
  const naast = open && breed;

  return (
    <div className={naast ? 'mt-4 grid items-start gap-6 grid-cols-[minmax(0,1fr)_clamp(32rem,38vw,50rem)]' : 'mt-4'}>
      <div className={naast ? 'grid min-w-0 items-start gap-6' : 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]'}>
        <div className="min-w-0 space-y-6">{werkblad}</div>
        <aside className={naast ? 'grid items-start gap-4 min-[1800px]:grid-cols-2' : 'space-y-4 lg:sticky lg:top-16'}>{spoor}</aside>
      </div>
      {open && gemount && (breed ? <VoorbeeldPaneel soort="naast" /> : createPortal(<VoorbeeldPaneel soort="overlay" />, document.body))}
    </div>
  );
}

function VoorbeeldPaneel({ soort }: { soort: 'naast' | 'overlay' }) {
  const { opgeslagen, afdrukHref, concept, zetOpen } = useOfferteVoorbeeld();
  const [passend, setPassend] = useState(true);
  const sluitKnop = useRef<HTMLButtonElement>(null);
  const { data, afwijkend } = useMemo(() => samengevoegd(opgeslagen, concept), [opgeslagen, concept]);
  const isOverlay = soort === 'overlay';

  // Overlay (telefoon, tablet): pagina erachter vastzetten, Escape sluit.
  useEffect(() => {
    if (!isOverlay) return;
    const vorigeFocus = document.activeElement as HTMLElement | null;
    const scrollSlot = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sluitKnop.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') zetOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = scrollSlot;
      vorigeFocus?.focus();
    };
  }, [isOverlay, zetOpen]);

  return (
    <section
      id="offerte-voorbeeld"
      aria-label="Voorbeeld van de offerte voor de klant"
      role={isOverlay ? 'dialog' : undefined}
      aria-modal={isOverlay || undefined}
      className={
        isOverlay
          ? 'fixed inset-0 z-[70] flex flex-col bg-white'
          : 'sticky top-16 flex h-[calc(100vh-5rem)] min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-white'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-ink-900">Voorbeeld voor de klant</h2>
          <p className="text-[12px] text-warm" aria-live="polite">
            {afwijkend ? (
              <span className="font-semibold text-amber-800">Met kopgegevens die nog niet zijn opgeslagen</span>
            ) : (
              'Zo staat hij nu in de PDF en de mail'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Zoom" className="flex overflow-hidden rounded-md border border-line text-[12px] font-semibold">
            <button
              type="button"
              aria-pressed={passend}
              onClick={() => setPassend(true)}
              className={`px-2.5 py-1.5 ${passend ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 hover:bg-mist'}`}
            >
              Passend
            </button>
            <button
              type="button"
              aria-pressed={!passend}
              onClick={() => setPassend(false)}
              className={`border-l border-line px-2.5 py-1.5 ${!passend ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 hover:bg-mist'}`}
            >
              100%
            </button>
          </div>
          <button ref={sluitKnop} type="button" onClick={() => zetOpen(false)} className="knop-stil px-3 py-1.5 text-[13px]">
            Sluiten
          </button>
        </div>
      </div>

      {afwijkend && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12px] text-amber-900">
          Sla de kopgegevens op, dan komen deze wijzigingen ook in de PDF en de mail.
        </p>
      )}

      <div className="flex-1 overflow-auto bg-ink-100 p-4">
        <Papier passend={passend}>
          <OfferteDocument offerte={data} />
        </Papier>
      </div>

      {isOverlay && (
        <div className="border-t border-line px-4 py-3">
          <Link href={afdrukHref} className="knop-stil w-full">
            Afdrukken / PDF
          </Link>
        </div>
      )}
    </section>
  );
}

/** A4 op 96 dpi. De afdruk gebruikt 14 mm marge (= 53 px). */
const A4_BREED = 794;
const A4_HOOG = 1123;
const A4_MARGE = 53;

/**
 * Een vel papier op ware breedte, passend geschaald in het paneel. Zo valt de tekst
 * net zo om als in de PDF, in plaats van in een smalle kolom te worden geperst.
 */
function Papier({ passend, children }: { passend: boolean; children: React.ReactNode }) {
  const buiten = useRef<HTMLDivElement>(null);
  const binnen = useRef<HTMLDivElement>(null);
  const [ruimte, setRuimte] = useState(0);
  const [hoogte, setHoogte] = useState(A4_HOOG);

  useEffect(() => {
    const b = buiten.current;
    const i = binnen.current;
    if (!b || !i) return;
    const meet = () => {
      setRuimte(b.clientWidth);
      setHoogte(i.offsetHeight);
    };
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(b);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);

  const schaal = passend && ruimte > 0 ? Math.min(1, ruimte / A4_BREED) : 1;

  return (
    <div ref={buiten} className="w-full">
      <div className="mx-auto" style={{ width: A4_BREED * schaal, height: hoogte * schaal }}>
        <div
          ref={binnen}
          className="bg-white shadow-card"
          style={{ width: A4_BREED, minHeight: A4_HOOG, padding: A4_MARGE, transform: `scale(${schaal})`, transformOrigin: 'top left' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * "Mail offerte naar": volgt het e-mailadres van de gekozen contactpersoon, ook als
 * die nog niet is opgeslagen. Zelf iets getypt? Dan blijft dat staan.
 */
export function MailNaarVeld({ standaard, klantEmail }: { standaard: string; klantEmail: string }) {
  const { concept } = useOfferteVoorbeeld();
  const [waarde, setWaarde] = useState(standaard);
  const zelfGetypt = useRef(false);

  useEffect(() => {
    if (zelfGetypt.current) return;
    setWaarde(standaard);
  }, [standaard]);

  const heeftKeuze = 'contactId' in concept;
  const { contactId, contactEmail } = concept;
  useEffect(() => {
    if (zelfGetypt.current || !heeftKeuze) return;
    setWaarde(contactEmail?.trim() || klantEmail || standaard);
  }, [heeftKeuze, contactId, contactEmail, klantEmail, standaard]);

  return (
    <input
      name="to"
      type="email"
      value={waarde}
      onChange={(e) => {
        zelfGetypt.current = true;
        setWaarde(e.target.value);
      }}
      placeholder="klant@bedrijf.nl"
      className="veld"
    />
  );
}
