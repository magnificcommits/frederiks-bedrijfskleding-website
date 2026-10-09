'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zoekScore } from '@/lib/zoekScore';

type Hit = { type: string; label: string; sub: string; href: string; woorden?: string };

/**
 * Universeel zoeken met Cmd/Ctrl+K (of de zoekbalk boven het menu).
 *
 * Drie bronnen:
 *  1. Schermen: elk menu-onderdeel, met zoekwoorden ("mail" vindt Nieuwsbrief).
 *  2. Acties: iets nieuws aanmaken (klant, offerte, order, taak, nieuwsbrief…).
 *  3. Records uit de database via /api/dashboard/search (vanaf 2 tekens):
 *     klanten, contactpersonen, werknemers, orders, offertes, facturen,
 *     producten, leads, prospects, taken, nieuwsbrieven en drukproeven.
 *
 * Zoeken negeert hoofdletters en accenten en elk woord mag het begin van een
 * woord zijn: "nieuw kl" vindt "Nieuwe klant".
 */
const SCHERMEN: Hit[] = [
  { type: 'Scherm', label: 'Overzicht', sub: 'Signalen en wat er loopt', href: '/dashboard', woorden: 'dashboard home start' },
  { type: 'Scherm', label: 'Orders', sub: 'Bestellingen', href: '/dashboard/orders', woorden: 'bestelling bestellingen' },
  { type: 'Scherm', label: 'Offertes', sub: '', href: '/dashboard/offertes', woorden: 'prijsopgave aanbieding' },
  { type: 'Scherm', label: 'Klanten', sub: 'Bedrijven, werknemers, assortiment', href: '/dashboard/klanten', woorden: 'bedrijven organisaties crm relaties' },
  { type: 'Scherm', label: 'Passen en maten', sub: 'Passessies en maten noteren', href: '/dashboard/passessie', woorden: 'pasdag passen maten' },
  { type: 'Scherm', label: 'Producten', sub: 'Catalogus', href: '/dashboard/producten', woorden: 'artikelen catalogus kleding' },
  { type: 'Scherm', label: 'Leads', sub: 'Aanvragen via de website', href: '/dashboard/leads', woorden: 'aanvragen formulier' },
  { type: 'Scherm', label: 'Taken en afspraken', sub: 'Lijst, agenda, archief', href: '/dashboard/taken', woorden: 'todo agenda afspraak herinnering planning' },
  { type: 'Scherm', label: 'Archief van taken', sub: 'Taken en afspraken', href: '/dashboard/taken?weergave=archief', woorden: 'gearchiveerd' },
  { type: 'Scherm', label: 'Prullenbak van taken', sub: 'Verwijderde taken terugzetten', href: '/dashboard/taken?weergave=prullenbak', woorden: 'verwijderd terugzetten' },
  { type: 'Scherm', label: 'Agenda', sub: 'Taken en afspraken per week', href: '/dashboard/taken?weergave=agenda', woorden: 'kalender week' },
  { type: 'Scherm', label: 'Instellingen voor taken', sub: 'Statussen, personen, meldingen', href: '/dashboard/taken/instellingen', woorden: 'status statussen personen dagoverzicht weekoverzicht' },
  { type: 'Scherm', label: 'Nieuwsbrief', sub: 'Nieuwsbrieven en templates', href: '/dashboard/nieuwsbrief', woorden: 'mail mailing email e-mail mailblue template' },
  { type: 'Scherm', label: 'Beheerders', sub: 'Wie mag in het KMS', href: '/dashboard/admins', woorden: 'gebruikers admins accounts toegang' },
  { type: 'Scherm', label: 'Prospects', sub: 'Potentiele klanten', href: '/dashboard/prospects', woorden: 'acquisitie potentieel' },
  { type: 'Scherm', label: 'Brieven met QR', sub: 'Prospectbrieven printen', href: '/dashboard/prospects/brieven', woorden: 'brief qr kennismaking print' },
  { type: 'Scherm', label: 'Campagnes', sub: '', href: '/dashboard/campagnes', woorden: 'marketing mail' },
  { type: 'Scherm', label: 'Medewerker-verzoeken', sub: 'Nieuwe werknemers uit het portaal', href: '/dashboard/medewerker-verzoeken', woorden: 'verzoek aanvraag werknemer' },
  { type: 'Scherm', label: 'Facturen', sub: '', href: '/dashboard/facturen', woorden: 'factuur rekening betaling' },
  { type: 'Scherm', label: 'Sparen', sub: 'Spaarprogramma', href: '/dashboard/sparen', woorden: 'punten' },
  { type: 'Scherm', label: 'Voorraad', sub: '', href: '/dashboard/voorraad', woorden: 'magazijn stock' },
  { type: 'Scherm', label: 'Leveranciers', sub: '', href: '/dashboard/leveranciers', woorden: 'groothandel merken' },
  { type: 'Scherm', label: 'Inkoop', sub: 'Bestellen bij leveranciers', href: '/dashboard/inkoop', woorden: 'inkooporder bestellen' },
  { type: 'Scherm', label: 'Werkbonnen en logo’s', sub: 'Productieplanning, bedrukken en borduren', href: '/dashboard/logos', woorden: 'logo werkbon bedrukken borduren productie' },
  { type: 'Scherm', label: 'Drukproeven', sub: '', href: '/dashboard/drukproeven', woorden: 'drukproef proef mockup' },
  { type: 'Scherm', label: 'Retouren', sub: '', href: '/dashboard/retouren', woorden: 'retour ruilen terugsturen' },
  { type: 'Scherm', label: 'Klachten en vragen', sub: '', href: '/dashboard/klachten', woorden: 'klacht vraag service' },
  { type: 'Scherm', label: 'Afspraken', sub: 'Online geboekt via de website', href: '/dashboard/afspraken', woorden: 'afspraak boeking pasdag showroom adviesgesprek agenda' },
  { type: 'Scherm', label: 'Beschikbaarheid', sub: 'Tijden open of dicht zetten', href: '/dashboard/afspraken/beschikbaarheid', woorden: 'vol dicht open vakantie vrij beschikbaar tijden blokkeren' },
  { type: 'Scherm', label: 'Reviews en NPS', sub: 'Tevredenheid na levering', href: '/dashboard/reviews', woorden: 'review nps tevredenheid beoordeling google' },
  { type: 'Scherm', label: 'Pakketten', sub: 'Startpakketten en pakketten', href: '/dashboard/pakketten', woorden: 'startpakket bundel' },
  { type: 'Scherm', label: 'Analyse', sub: '', href: '/dashboard/analyse', woorden: 'cijfers omzet grafiek' },
  { type: 'Scherm', label: 'AI-assistent', sub: '', href: '/dashboard/ai-assistent', woorden: 'ai claude vraag' },
  { type: 'Scherm', label: 'Rapportages', sub: '', href: '/dashboard/rapportages', woorden: 'rapport overzicht cijfers' },
  { type: 'Scherm', label: 'Meldingen', sub: '', href: '/dashboard/meldingen', woorden: 'notificaties' },
  { type: 'Scherm', label: 'Import', sub: 'Excel of CSV inlezen', href: '/dashboard/import', woorden: 'excel csv inlezen' },
  { type: 'Scherm', label: 'Export CSV', sub: '', href: '/dashboard/export', woorden: 'excel downloaden' },
  { type: 'Scherm', label: 'Logboek', sub: 'Wie deed wat', href: '/dashboard/audit', woorden: 'audit log historie' },
  { type: 'Scherm', label: 'Instellingen', sub: '', href: '/dashboard/instellingen', woorden: 'configuratie bedrijfsgegevens' },
  { type: 'Scherm', label: 'Beveiliging (2FA)', sub: '', href: '/dashboard/beveiliging', woorden: '2fa tweestaps wachtwoord authenticator' },
  { type: 'Scherm', label: 'Fotocontrole', sub: 'Productfoto’s op maat en scherpte', href: '/dashboard/producten/fotocontrole', woorden: 'foto afbeelding wazig klein' },
  { type: 'Scherm', label: 'Maten en kleuren', sub: 'Vaste lijsten en opschonen', href: '/dashboard/instellingen/varianten', woorden: 'varianten maat kleur opschonen' },
  { type: 'Scherm', label: 'Service-instellingen', sub: 'Retourbeleid en klachtcategorieën', href: '/dashboard/instellingen/service', woorden: 'retourtermijn retourbeleid klacht' },
  { type: 'Scherm', label: 'Voorraadtelling', sub: 'Tellen per merk of locatie', href: '/dashboard/voorraad/telling', woorden: 'tellen inventarisatie' },
  { type: 'Scherm', label: 'Btw-overzicht', sub: 'Rapport per periode', href: '/dashboard/rapportages/btw', woorden: 'btw aangifte boekhouding' },
  { type: 'Scherm', label: 'Openstaande facturen', sub: 'Debiteuren en ouderdom', href: '/dashboard/rapportages/debiteuren', woorden: 'debiteuren openstaand ouderdom' },
  { type: 'Scherm', label: 'Functies', sub: 'Nu afdelingen bij de klant', href: '/dashboard/functies', woorden: 'afdelingen' },
];

const ACTIES: Hit[] = [
  { type: 'Actie', label: 'Nieuwe klant', sub: 'Met afdelingen en werknemers', href: '/dashboard/klanten/nieuw', woorden: 'klant toevoegen aanmaken bedrijf' },
  { type: 'Actie', label: 'Nieuwe offerte', sub: '', href: '/dashboard/offertes/nieuw', woorden: 'offerte maken aanmaken' },
  { type: 'Actie', label: 'Nieuwe order', sub: '', href: '/dashboard/orders/nieuw', woorden: 'order bestelling maken aanmaken' },
  { type: 'Actie', label: 'Nieuwe taak', sub: '', href: '/dashboard/taken?nieuw=taak', woorden: 'taak todo maken aanmaken' },
  { type: 'Actie', label: 'Nieuwe afspraak', sub: '', href: '/dashboard/taken?nieuw=afspraak', woorden: 'afspraak agenda maken aanmaken' },
  { type: 'Actie', label: 'Nieuwe drukproef', sub: '', href: '/dashboard/drukproeven/nieuw', woorden: 'drukproef maken aanmaken' },
  { type: 'Actie', label: 'Nieuwe nieuwsbrief', sub: '', href: '/dashboard/nieuwsbrief', woorden: 'nieuwsbrief mail maken aanmaken' },
];

/** Werklijsten die je vanuit het niets wilt kunnen openen. */
const SNELFILTERS: Hit[] = [
  { type: 'Werklijst', label: 'Orders die op goedkeuring wachten', sub: '', href: '/dashboard/orders?goedkeuring=wacht', woorden: 'goedkeuren' },
  { type: 'Werklijst', label: 'Verlopen taken', sub: '', href: '/dashboard/taken?wanneer=verlopen', woorden: 'te laat achterstand' },
  { type: 'Werklijst', label: 'Producten zonder foto', sub: '', href: '/dashboard/producten?zonderfoto=1', woorden: 'afbeelding' },
  { type: 'Werklijst', label: 'Klanten die mogelijk dubbel staan', sub: '', href: '/dashboard/klanten?dubbel=1', woorden: 'dubbel duplicaat' },
  { type: 'Werklijst', label: 'Retouren die beoordeeld moeten worden', sub: '', href: '/dashboard/retouren?status=aangemeld', woorden: 'retour' },
];

const LOKAAL = [...ACTIES, ...SCHERMEN, ...SNELFILTERS];

/** Score > 0 als elk zoekwoord in label, sub of zoekwoorden voorkomt; hoger = beter (zie lib/zoekScore.ts). */
const score = (h: Hit, term: string) => zoekScore(h, term);

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [records, setRecords] = useState<Hit[]>([]);
  const [actief, setActief] = useState(0);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Na sluiten de focus terug naar waar je was (de zoekknop of de lijst).
    const vorigeFocus = document.activeElement as HTMLElement | null;
    setQ('');
    setRecords([]);
    setActief(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      vorigeFocus?.focus?.();
    };
  }, [open]);

  // Records ophalen vanaf 2 tekens, met debounce.
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setRecords([]);
      setBezig(false);
      return;
    }
    setBezig(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dashboard/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = res.ok ? ((await res.json()) as { results: Hit[] }) : { results: [] };
        setRecords(data.results ?? []);
        setBezig(false);
      } catch {
        // Afgebroken (nieuwe toets): de volgende zoekopdracht neemt het over.
        // Echt mislukt: niet eeuwig "bezig" blijven tonen.
        if (!ctrl.signal.aborted) setBezig(false);
      }
    }, 180);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, open]);

  const lijst = useMemo(() => {
    const term = q.trim();
    if (!term) return [...ACTIES.slice(0, 3), ...SCHERMEN.slice(0, 8), ...SNELFILTERS.slice(0, 2)];
    const lokaal = LOKAAL.map((h) => ({ h, s: score(h, term) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.h);
    return [...lokaal, ...records];
  }, [q, records]);

  useEffect(() => setActief(0), [lijst.length]);

  // Met de pijltjes door een lange lijst: de gekozen regel in beeld houden.
  useEffect(() => {
    if (open) document.getElementById(`palet-optie-${actief}`)?.scrollIntoView({ block: 'nearest' });
  }, [actief, open]);

  function ga(hit: Hit) {
    onClose();
    router.push(hit.href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActief((i) => Math.min(i + 1, lijst.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActief((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && lijst[actief]) {
      e.preventDefault();
      ga(lijst[actief]);
    }
  }

  if (!open) return null;

  // Groepskopjes tonen waar het type verandert.
  const kop = (h: Hit) => (h.type === 'Scherm' ? 'Schermen' : h.type === 'Actie' ? 'Acties' : h.type === 'Werklijst' ? 'Werklijsten' : h.type);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" onKeyDown={onKey}>
      <button type="button" tabIndex={-1} aria-label="Sluiten" onClick={onClose} className="absolute inset-0 cursor-default bg-black/50" />
      <div role="dialog" aria-modal="true" aria-label="Zoeken" className="relative w-full max-w-xl overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-center border-b border-line">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek een scherm, klant, werknemer, order, offerte, factuur, product…"
            aria-label="Zoeken en navigeren"
            role="combobox"
            aria-expanded={lijst.length > 0}
            aria-controls="palet-lijst"
            aria-autocomplete="list"
            aria-activedescendant={lijst[actief] ? `palet-optie-${actief}` : undefined}
            className="w-full px-4 py-3 text-base focus:outline-none md:text-sm"
          />
          {bezig && (
            <span
              className="mr-4 inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-ink-300 border-t-transparent"
              aria-hidden="true"
            />
          )}
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          {lijst.length === 0 ? (
            <p className="px-5 py-6 text-center text-[13px] text-warm">
              {bezig ? 'Zoeken…' : q.trim().length < 2 ? 'Typ nog een teken om ook in klanten en orders te zoeken.' : `Niets gevonden voor “${q.trim()}”.`}
            </p>
          ) : (
            <ul id="palet-lijst" role="listbox" aria-label="Resultaten" className="py-1.5">
              {lijst.map((h, i) => {
                const nieuweKop = i === 0 || kop(lijst[i - 1]) !== kop(h);
                return (
                  <li key={`${h.type}-${h.href}-${i}`} role="presentation">
                    {nieuweKop && (
                      <p aria-hidden="true" className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-warm">{kop(h)}</p>
                    )}
                    <button
                      type="button"
                      id={`palet-optie-${i}`}
                      role="option"
                      aria-selected={i === actief}
                      tabIndex={-1}
                      onMouseEnter={() => setActief(i)}
                      onClick={() => ga(h)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-[13px] max-md:min-h-[48px] ${i === actief ? 'bg-mist shadow-[inset_2px_0_0_theme(colors.amber.500)]' : ''}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink-900">{h.label}</span>
                        {h.sub && <span className="block truncate text-[11px] text-warm">{h.sub}</span>}
                      </span>
                      <span className="chip-tel shrink-0 uppercase tracking-wide">{h.type}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-1.5 text-[11px] text-warm">
          <span className="[@media(pointer:coarse)]:hidden">↑↓ kiezen · Enter openen · Esc sluiten</span>
          <span>{q.trim().length < 2 ? 'Vanaf 2 tekens ook klanten, orders en meer' : bezig ? 'Zoeken…' : `${lijst.length} resultaten`}</span>
        </div>
      </div>
    </div>
  );
}
