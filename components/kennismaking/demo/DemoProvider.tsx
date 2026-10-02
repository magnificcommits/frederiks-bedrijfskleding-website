'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  inAanvraagVoor,
  verbruiktDoor,
  type DemoData,
  type DemoMaten,
  type DemoMedewerker,
  type DemoOrder,
  type DemoOrderRegel,
} from '@/lib/prospect/demo/model';

/**
 * Lokale staat van het voorbeeldportaal. Niets gaat naar de server: alles leeft in
 * React-state en (best effort) in sessionStorage, zodat rondklikken tussen pagina's
 * de winkelmand en keuzes vasthoudt. Sluit je het tabblad, dan is alles weg.
 */

export type MandRegel = { id: string; artikelId: string; maat: string; aantal: number; medewerkerId: string | null };

export type DrukproefBesluit = { status: 'wacht' | 'goedgekeurd' | 'wijziging'; opmerking: string };

export type NieuweMedewerker = {
  voornaam: string;
  achternaam: string;
  functie: string;
  afdelingId: string;
  maten: DemoMaten;
  budget: number;
};

type Opslag = {
  v: 1;
  medewerkers: DemoMedewerker[];
  orders: DemoOrder[];
  mand: MandRegel[];
  voorMedewerkerId: string | null;
  drukproef: DrukproefBesluit;
  rondleidingGezien: boolean;
};

type Paden = { kennismaking: string; pasdag: string; portaal: string };

type DemoContext = {
  data: DemoData;
  paden: Paden;
  geladen: boolean;
  medewerkers: DemoMedewerker[];
  orders: DemoOrder[];
  mand: MandRegel[];
  voorMedewerkerId: string | null;
  drukproef: DrukproefBesluit;
  rondleidingGezien: boolean;
  medewerker: (id: string | null | undefined) => DemoMedewerker | null;
  budgetVan: (id: string) => { budget: number; verbruikt: number; inAanvraag: number; restant: number };
  leidinggevendeVan: (medewerkerId: string | null) => DemoMedewerker | null;
  setVoorMedewerker: (id: string | null) => void;
  voegToe: (artikelId: string, maat: string, medewerkerId: string | null, aantal?: number) => void;
  wijzigAantal: (regelId: string, aantal: number) => void;
  leegMand: () => void;
  plaatsBestelling: () => DemoOrder[];
  herbestel: (orderId: string) => number;
  voegMedewerkerToe: (m: NieuweMedewerker) => DemoMedewerker;
  beoordeel: (orderId: string, besluit: 'goedgekeurd' | 'afgewezen') => void;
  setDrukproef: (b: DrukproefBesluit) => void;
  setRondleidingGezien: (v: boolean) => void;
};

const Ctx = createContext<DemoContext | null>(null);

export function useDemo(): DemoContext {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDemo buiten DemoProvider');
  return c;
}

function leesOpslag(sleutel: string): Opslag | null {
  try {
    const ruw = window.sessionStorage.getItem(sleutel);
    if (!ruw) return null;
    const o = JSON.parse(ruw) as Partial<Opslag>;
    if (o?.v !== 1 || !Array.isArray(o.medewerkers) || !Array.isArray(o.orders) || !Array.isArray(o.mand)) return null;
    return {
      v: 1,
      medewerkers: o.medewerkers,
      orders: o.orders,
      mand: o.mand,
      voorMedewerkerId: typeof o.voorMedewerkerId === 'string' ? o.voorMedewerkerId : null,
      drukproef: o.drukproef && typeof o.drukproef.status === 'string' ? o.drukproef : { status: 'wacht', opmerking: '' },
      rondleidingGezien: Boolean(o.rondleidingGezien),
    };
  } catch {
    return null;
  }
}

function schrijfOpslag(sleutel: string, o: Opslag) {
  try {
    window.sessionStorage.setItem(sleutel, JSON.stringify(o));
  } catch {
    /* privévenster of opslag vol: de demo werkt gewoon zonder */
  }
}

let teller = 0;
const nieuwId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(teller++).toString(36)}`;

function vandaagLabel(): string {
  try {
    return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date());
  } catch {
    return 'Vandaag';
  }
}

export default function DemoProvider({ data, paden, children }: { data: DemoData; paden: Paden; children: ReactNode }) {
  const sleutel = `fb-voorbeeldportaal:${data.token}`;
  const [medewerkers, setMedewerkers] = useState<DemoMedewerker[]>(data.medewerkers);
  const [orders, setOrders] = useState<DemoOrder[]>(data.orders);
  const [mand, setMand] = useState<MandRegel[]>([]);
  const [voorMedewerkerId, setVoorMedewerker] = useState<string | null>(null);
  const [drukproef, setDrukproef] = useState<DrukproefBesluit>({ status: 'wacht', opmerking: '' });
  const [rondleidingGezien, setRondleidingGezien] = useState(false);
  const [geladen, setGeladen] = useState(false);
  const geladenRef = useRef(false);

  // Na mount: eerdere staat uit deze sessie terugzetten.
  useEffect(() => {
    const o = leesOpslag(sleutel);
    if (o) {
      setMedewerkers(o.medewerkers);
      setOrders(o.orders);
      setMand(o.mand);
      setVoorMedewerker(o.voorMedewerkerId);
      setDrukproef(o.drukproef);
      setRondleidingGezien(o.rondleidingGezien);
    }
    geladenRef.current = true;
    setGeladen(true);
  }, [sleutel]);

  useEffect(() => {
    if (!geladenRef.current) return;
    schrijfOpslag(sleutel, { v: 1, medewerkers, orders, mand, voorMedewerkerId, drukproef, rondleidingGezien });
  }, [sleutel, medewerkers, orders, mand, voorMedewerkerId, drukproef, rondleidingGezien]);

  const medewerker = useCallback((id: string | null | undefined) => medewerkers.find((m) => m.id === id) ?? null, [medewerkers]);

  const budgetVan = useCallback(
    (id: string) => {
      const m = medewerkers.find((x) => x.id === id);
      const budget = m?.budget ?? 0;
      const verbruikt = verbruiktDoor(orders, id);
      const inAanvraag = inAanvraagVoor(orders, id);
      return { budget, verbruikt, inAanvraag, restant: budget - verbruikt - inAanvraag };
    },
    [medewerkers, orders],
  );

  const leidinggevendeVan = useCallback(
    (medewerkerId: string | null) => {
      const m = medewerkers.find((x) => x.id === medewerkerId);
      const afd = m?.afdelingId ?? data.afdelingen[0]?.id;
      return medewerkers.find((x) => x.afdelingId === afd && x.rol === 'leidinggevende') ?? null;
    },
    [medewerkers, data.afdelingen],
  );

  const voegToe = useCallback((artikelId: string, maat: string, medewerkerId: string | null, aantal = 1) => {
    setMand((huidig) => {
      const bestaand = huidig.find((r) => r.artikelId === artikelId && r.maat === maat && r.medewerkerId === medewerkerId);
      if (bestaand) return huidig.map((r) => (r === bestaand ? { ...r, aantal: Math.min(99, r.aantal + aantal) } : r));
      return [...huidig, { id: nieuwId('m'), artikelId, maat, aantal, medewerkerId }];
    });
  }, []);

  const wijzigAantal = useCallback((regelId: string, aantal: number) => {
    setMand((huidig) =>
      aantal <= 0 ? huidig.filter((r) => r.id !== regelId) : huidig.map((r) => (r.id === regelId ? { ...r, aantal: Math.min(99, aantal) } : r)),
    );
  }, []);

  const leegMand = useCallback(() => setMand([]), []);

  const plaatsBestelling = useCallback((): DemoOrder[] => {
    if (mand.length === 0) return [];
    const groepen = new Map<string, MandRegel[]>();
    for (const r of mand) {
      const k = r.medewerkerId ?? '';
      groepen.set(k, [...(groepen.get(k) ?? []), r]);
    }
    let volgnummer = orders.reduce((max, o) => Math.max(max, o.ordernummer), 0);
    const nieuw: DemoOrder[] = [];
    for (const [mwId, regels] of groepen) {
      const orderRegels: DemoOrderRegel[] = regels.flatMap((r) => {
        const a = data.artikelen.find((x) => x.id === r.artikelId);
        return a ? [{ artikelId: a.id, naam: a.naam, maat: r.maat, kleur: a.kleur, aantal: r.aantal, stukprijs: a.prijs }] : [];
      });
      if (orderRegels.length === 0) continue;
      const bedrag = Math.round(orderRegels.reduce((t, r) => t + r.aantal * r.stukprijs, 0) * 100) / 100;
      const mw = mwId ? medewerkers.find((m) => m.id === mwId) ?? null : null;
      let boven = false;
      if (mw) {
        const restant = mw.budget - verbruiktDoor(orders, mw.id) - inAanvraagVoor(orders, mw.id);
        boven = bedrag > restant;
      }
      volgnummer += 1;
      nieuw.push({
        id: nieuwId('o'),
        ordernummer: volgnummer,
        datumLabel: vandaagLabel(),
        medewerkerId: mw?.id ?? null,
        aangevraagdDoor: 'Jij (beheerder)',
        status: boven ? 'wacht' : 'besteld',
        goedkeuring: boven ? 'wacht' : 'niet_nodig',
        reden: boven ? 'Boven het resterende budget' : undefined,
        regels: orderRegels,
        bedrag,
        lokaal: true,
      });
    }
    setOrders((huidig) => [...nieuw, ...huidig]);
    setMand([]);
    return nieuw;
  }, [mand, orders, medewerkers, data.artikelen]);

  const herbestel = useCallback(
    (orderId: string) => {
      const o = orders.find((x) => x.id === orderId);
      if (!o) return 0;
      let n = 0;
      for (const r of o.regels) {
        if (!r.artikelId || !r.maat) continue;
        if (!data.artikelen.some((a) => a.id === r.artikelId)) continue;
        voegToe(r.artikelId, r.maat, o.medewerkerId, r.aantal);
        n += r.aantal;
      }
      return n;
    },
    [orders, data.artikelen, voegToe],
  );

  const voegMedewerkerToe = useCallback((m: NieuweMedewerker) => {
    const voornaam = m.voornaam.trim().slice(0, 40) || 'Nieuwe collega';
    const achter = m.achternaam.trim();
    const nieuw: DemoMedewerker = {
      id: nieuwId('mw'),
      voornaam,
      naam: achter ? `${voornaam} ${achter.slice(0, 40)}` : voornaam,
      functie: m.functie.trim().slice(0, 60) || 'Medewerker',
      afdelingId: m.afdelingId,
      rol: 'medewerker',
      maten: m.maten,
      budget: Math.max(0, Math.min(5000, Math.round(m.budget))),
      heeftLogin: false,
      nieuw: true,
    };
    setMedewerkers((huidig) => [...huidig, nieuw]);
    return nieuw;
  }, []);

  const beoordeel = useCallback((orderId: string, besluit: 'goedgekeurd' | 'afgewezen') => {
    setOrders((huidig) =>
      huidig.map((o) =>
        o.id === orderId ? { ...o, goedkeuring: besluit, status: besluit === 'goedgekeurd' ? 'besteld' : 'afgewezen' } : o,
      ),
    );
  }, []);

  const waarde = useMemo<DemoContext>(
    () => ({
      data,
      paden,
      geladen,
      medewerkers,
      orders,
      mand,
      voorMedewerkerId,
      drukproef,
      rondleidingGezien,
      medewerker,
      budgetVan,
      leidinggevendeVan,
      setVoorMedewerker,
      voegToe,
      wijzigAantal,
      leegMand,
      plaatsBestelling,
      herbestel,
      voegMedewerkerToe,
      beoordeel,
      setDrukproef,
      setRondleidingGezien,
    }),
    [
      data, paden, geladen, medewerkers, orders, mand, voorMedewerkerId, drukproef, rondleidingGezien,
      medewerker, budgetVan, leidinggevendeVan, voegToe, wijzigAantal, leegMand, plaatsBestelling, herbestel,
      voegMedewerkerToe, beoordeel,
    ],
  );

  return <Ctx.Provider value={waarde}>{children}</Ctx.Provider>;
}
