/**
 * Toestand van de nieuwsbrief-editor: een reducer met onveranderlijke updates,
 * een geschiedenis voor ongedaan maken / opnieuw, en de huidige selectie.
 *
 * Puur (geen React, geen DOM): ook los te testen.
 *
 * Afspraken:
 *  - Elke actie die het ontwerp wijzigt, zet het oude ontwerp op de
 *    geschiedenis-stapel (max. GESCHIEDENIS_MAX). Snel achter elkaar typen in
 *    hetzelfde veld (zelfde `sleutel`, binnen SAMENVOEG_MS) wordt één stap.
 *  - Secties en blokken die er nieuw bij komen (dupliceren, module invoegen)
 *    krijgen ALTIJD nieuwe id's, zodat er nooit twee dezelfde id's zijn.
 *  - Indexen bij verplaatsen zijn posities in de lijst VÓÓR het verplaatsen
 *    (zoals een invoeglijn die je ziet); de reducer corrigeert zelf.
 */
import {
  defaultBlok,
  defaultSectie,
  kopieerBlok,
  kopieerSectie,
  nieuwId,
  type Blok,
  type BlokType,
  type Instellingen,
  type Kolom,
  type Ontwerp,
  type Sectie,
  type SectieStijl,
  type BlokStijl,
} from '@/lib/nieuwsbrief/types';

export const GESCHIEDENIS_MAX = 100;
export const SAMENVOEG_MS = 1200;

export type Selectie = { soort: 'sectie'; sectieId: string } | { soort: 'blok'; blokId: string } | null;

export type EditorState = {
  ontwerp: Ontwerp;
  verleden: Ontwerp[];
  toekomst: Ontwerp[];
  selectie: Selectie;
  /** Telt op bij elke wijziging van het ontwerp (ook bij ongedaan maken); voor automatisch opslaan. */
  versie: number;
  /** Voor het samenvoegen van typ-stappen. */
  laatsteSleutel: string | null;
  laatsteTijd: number;
};

/** Een gedeeltelijke stijl-wijziging; padding mag in z'n geheel. */
export type BlokPatch = { stijl?: Partial<BlokStijl> } & Record<string, unknown>;
export type SectiePatch = Partial<Omit<Sectie, 'id' | 'kolommen' | 'stijl'>> & { stijl?: Partial<SectieStijl> };

export type Actie =
  | { type: 'instellingen'; patch: Partial<Instellingen>; sleutel?: string; tijd?: number }
  | { type: 'sectieToevoegen'; index: number; verhouding: number[]; blokType?: BlokType }
  | { type: 'sectieInvoegen'; index: number; sectie: Sectie }
  | { type: 'sectieVerplaatsen'; sectieId: string; naarIndex: number }
  | { type: 'sectieOmhoog'; sectieId: string }
  | { type: 'sectieOmlaag'; sectieId: string }
  | { type: 'sectieDupliceren'; sectieId: string }
  | { type: 'sectieVerwijderen'; sectieId: string }
  | { type: 'sectieWijzigen'; sectieId: string; patch: SectiePatch; sleutel?: string; tijd?: number }
  | { type: 'sectieStructuur'; sectieId: string; verhouding: number[] }
  | { type: 'blokToevoegen'; sectieId: string; kolomId: string; index: number; blokType: BlokType }
  | { type: 'blokVerplaatsen'; blokId: string; sectieId: string; kolomId: string; naarIndex: number }
  | { type: 'blokOmhoog'; blokId: string }
  | { type: 'blokOmlaag'; blokId: string }
  | { type: 'blokDupliceren'; blokId: string }
  | { type: 'blokVerwijderen'; blokId: string }
  | { type: 'blokWijzigen'; blokId: string; patch: BlokPatch; sleutel?: string; tijd?: number }
  | { type: 'verwijderSelectie' }
  | { type: 'selecteer'; selectie: Selectie }
  | { type: 'naarContainer' }
  | { type: 'ongedaan' }
  | { type: 'opnieuw' }
  | { type: 'vervang'; ontwerp: Ontwerp };

export function beginState(ontwerp: Ontwerp): EditorState {
  return { ontwerp, verleden: [], toekomst: [], selectie: null, versie: 0, laatsteSleutel: null, laatsteTijd: 0 };
}

/* ------------------------------------------------------------------ */
/* Zoeken                                                              */
/* ------------------------------------------------------------------ */

export type BlokPlek = { sectieIndex: number; kolomIndex: number; blokIndex: number; sectie: Sectie; kolom: Kolom; blok: Blok };

export function vindBlok(o: Ontwerp, blokId: string): BlokPlek | null {
  for (let s = 0; s < o.secties.length; s++) {
    const sectie = o.secties[s];
    for (let k = 0; k < sectie.kolommen.length; k++) {
      const kolom = sectie.kolommen[k];
      const b = kolom.blokken.findIndex((x) => x.id === blokId);
      if (b !== -1) return { sectieIndex: s, kolomIndex: k, blokIndex: b, sectie, kolom, blok: kolom.blokken[b] };
    }
  }
  return null;
}

export function vindSectieIndex(o: Ontwerp, sectieId: string): number {
  return o.secties.findIndex((s) => s.id === sectieId);
}

/** De sectie waar de selectie in zit (de sectie zelf, of de sectie van het blok). */
export function sectieVanSelectie(o: Ontwerp, sel: Selectie): Sectie | null {
  if (!sel) return null;
  if (sel.soort === 'sectie') return o.secties.find((s) => s.id === sel.sectieId) ?? null;
  return vindBlok(o, sel.blokId)?.sectie ?? null;
}

/* ------------------------------------------------------------------ */
/* Onveranderlijke hulpfuncties                                        */
/* ------------------------------------------------------------------ */

function metSecties(o: Ontwerp, secties: Sectie[]): Ontwerp {
  return { ...o, secties };
}

function vervangSectie(o: Ontwerp, index: number, sectie: Sectie): Ontwerp {
  const secties = o.secties.slice();
  secties[index] = sectie;
  return metSecties(o, secties);
}

function vervangKolom(sectie: Sectie, kolomIndex: number, kolom: Kolom): Sectie {
  const kolommen = sectie.kolommen.slice();
  kolommen[kolomIndex] = kolom;
  return { ...sectie, kolommen };
}

function grens(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Blok verwijderen; geeft het nieuwe ontwerp en het verwijderde blok terug. */
function haalBlokWeg(o: Ontwerp, plek: BlokPlek): Ontwerp {
  const blokken = plek.kolom.blokken.filter((_, i) => i !== plek.blokIndex);
  return vervangSectie(o, plek.sectieIndex, vervangKolom(plek.sectie, plek.kolomIndex, { ...plek.kolom, blokken }));
}

function zetBlokIn(o: Ontwerp, sectieId: string, kolomId: string, index: number, blok: Blok): Ontwerp | null {
  const s = vindSectieIndex(o, sectieId);
  if (s === -1) return null;
  const sectie = o.secties[s];
  const k = sectie.kolommen.findIndex((x) => x.id === kolomId);
  if (k === -1) return null;
  const kolom = sectie.kolommen[k];
  const blokken = kolom.blokken.slice();
  blokken.splice(grens(index, 0, blokken.length), 0, blok);
  return vervangSectie(o, s, vervangKolom(sectie, k, { ...kolom, blokken }));
}

/** Verhouding netjes maken: zelfde lengte als het aantal kolommen, positief, opgeteld 100. */
export function schoneVerhouding(v: number[]): number[] {
  const n = grens(v.length, 1, 4);
  const delen = v.slice(0, n).map((x) => (Number.isFinite(x) && x > 0 ? x : 1));
  const som = delen.reduce((a, b) => a + b, 0);
  const pct = delen.map((x) => Math.round((x / som) * 100));
  pct[pct.length - 1] += 100 - pct.reduce((a, b) => a + b, 0);
  return pct;
}

/* ------------------------------------------------------------------ */
/* Ontwerp-wijzigingen (zonder geschiedenis)                           */
/* ------------------------------------------------------------------ */

type Wijziging = { ontwerp: Ontwerp; selectie?: Selectie } | null;

function pasToe(o: Ontwerp, a: Actie, sel: Selectie): Wijziging {
  switch (a.type) {
    case 'instellingen':
      return { ontwerp: { ...o, instellingen: { ...o.instellingen, ...a.patch } } };

    case 'sectieToevoegen': {
      const sectie = defaultSectie(schoneVerhouding(a.verhouding));
      let selectie: Selectie = { soort: 'sectie', sectieId: sectie.id };
      if (a.blokType) {
        const blok = defaultBlok(a.blokType);
        sectie.kolommen[0] = { ...sectie.kolommen[0], blokken: [blok] };
        selectie = { soort: 'blok', blokId: blok.id };
      }
      const secties = o.secties.slice();
      secties.splice(grens(a.index, 0, secties.length), 0, sectie);
      return { ontwerp: metSecties(o, secties), selectie };
    }

    case 'sectieInvoegen': {
      // Altijd een kopie met nieuwe id's: een module kan vaker worden ingevoegd.
      const sectie = kopieerSectie(a.sectie);
      const secties = o.secties.slice();
      secties.splice(grens(a.index, 0, secties.length), 0, sectie);
      return { ontwerp: metSecties(o, secties), selectie: { soort: 'sectie', sectieId: sectie.id } };
    }

    case 'sectieVerplaatsen': {
      const van = vindSectieIndex(o, a.sectieId);
      if (van === -1) return null;
      let naar = grens(a.naarIndex, 0, o.secties.length);
      if (van < naar) naar -= 1;
      if (naar === van) return null;
      const secties = o.secties.slice();
      const [s] = secties.splice(van, 1);
      secties.splice(naar, 0, s);
      return { ontwerp: metSecties(o, secties) };
    }

    case 'sectieOmhoog':
    case 'sectieOmlaag': {
      const van = vindSectieIndex(o, a.sectieId);
      if (van === -1) return null;
      const naar = a.type === 'sectieOmhoog' ? van - 1 : van + 2;
      if (naar < 0 || naar > o.secties.length) return null;
      return pasToe(o, { type: 'sectieVerplaatsen', sectieId: a.sectieId, naarIndex: naar }, sel);
    }

    case 'sectieDupliceren': {
      const i = vindSectieIndex(o, a.sectieId);
      if (i === -1) return null;
      const kopie = kopieerSectie(o.secties[i]);
      const secties = o.secties.slice();
      secties.splice(i + 1, 0, kopie);
      return { ontwerp: metSecties(o, secties), selectie: { soort: 'sectie', sectieId: kopie.id } };
    }

    case 'sectieVerwijderen': {
      const i = vindSectieIndex(o, a.sectieId);
      if (i === -1) return null;
      return { ontwerp: metSecties(o, o.secties.filter((_, x) => x !== i)), selectie: null };
    }

    case 'sectieWijzigen': {
      const i = vindSectieIndex(o, a.sectieId);
      if (i === -1) return null;
      const oud = o.secties[i];
      const { stijl, ...rest } = a.patch;
      const nieuw: Sectie = { ...oud, ...rest, stijl: stijl ? { ...oud.stijl, ...stijl } : oud.stijl };
      return { ontwerp: vervangSectie(o, i, nieuw) };
    }

    case 'sectieStructuur': {
      const i = vindSectieIndex(o, a.sectieId);
      if (i === -1) return null;
      const oud = o.secties[i];
      const verhouding = schoneVerhouding(a.verhouding);
      const n = verhouding.length;
      let kolommen = oud.kolommen.slice(0, n);
      if (oud.kolommen.length > n) {
        // Blokken uit kolommen die verdwijnen, gaan naar de laatste kolom die blijft.
        const over = oud.kolommen.slice(n).flatMap((k) => k.blokken);
        const laatste = kolommen[n - 1];
        kolommen[n - 1] = { ...laatste, blokken: [...laatste.blokken, ...over] };
      }
      while (kolommen.length < n) kolommen = [...kolommen, { id: nieuwId(), blokken: [] }];
      return { ontwerp: vervangSectie(o, i, { ...oud, kolommen, verhouding }) };
    }

    case 'blokToevoegen': {
      const blok = defaultBlok(a.blokType);
      const nieuw = zetBlokIn(o, a.sectieId, a.kolomId, a.index, blok);
      return nieuw ? { ontwerp: nieuw, selectie: { soort: 'blok', blokId: blok.id } } : null;
    }

    case 'blokVerplaatsen': {
      const plek = vindBlok(o, a.blokId);
      if (!plek) return null;
      let naar = a.naarIndex;
      const zelfdeKolom = plek.sectie.id === a.sectieId && plek.kolom.id === a.kolomId;
      if (zelfdeKolom) {
        if (plek.blokIndex < naar) naar -= 1;
        if (naar === plek.blokIndex) return null;
      }
      const zonder = haalBlokWeg(o, plek);
      const nieuw = zetBlokIn(zonder, a.sectieId, a.kolomId, naar, plek.blok);
      return nieuw ? { ontwerp: nieuw, selectie: { soort: 'blok', blokId: plek.blok.id } } : null;
    }

    case 'blokOmhoog':
    case 'blokOmlaag': {
      const plek = vindBlok(o, a.blokId);
      if (!plek) return null;
      const naar = a.type === 'blokOmhoog' ? plek.blokIndex - 1 : plek.blokIndex + 2;
      if (naar < 0 || naar > plek.kolom.blokken.length) return null;
      return pasToe(o, { type: 'blokVerplaatsen', blokId: a.blokId, sectieId: plek.sectie.id, kolomId: plek.kolom.id, naarIndex: naar }, sel);
    }

    case 'blokDupliceren': {
      const plek = vindBlok(o, a.blokId);
      if (!plek) return null;
      const kopie = kopieerBlok(plek.blok);
      const nieuw = zetBlokIn(o, plek.sectie.id, plek.kolom.id, plek.blokIndex + 1, kopie);
      return nieuw ? { ontwerp: nieuw, selectie: { soort: 'blok', blokId: kopie.id } } : null;
    }

    case 'blokVerwijderen': {
      const plek = vindBlok(o, a.blokId);
      if (!plek) return null;
      return { ontwerp: haalBlokWeg(o, plek), selectie: { soort: 'sectie', sectieId: plek.sectie.id } };
    }

    case 'blokWijzigen': {
      const plek = vindBlok(o, a.blokId);
      if (!plek) return null;
      const { stijl, ...rest } = a.patch;
      const oud = plek.blok;
      const nieuwBlok = { ...oud, ...rest, id: oud.id, type: oud.type, stijl: stijl ? { ...oud.stijl, ...stijl } : oud.stijl } as Blok;
      const blokken = plek.kolom.blokken.slice();
      blokken[plek.blokIndex] = nieuwBlok;
      return { ontwerp: vervangSectie(o, plek.sectieIndex, vervangKolom(plek.sectie, plek.kolomIndex, { ...plek.kolom, blokken })) };
    }

    case 'verwijderSelectie': {
      if (!sel) return null;
      if (sel.soort === 'blok') return pasToe(o, { type: 'blokVerwijderen', blokId: sel.blokId }, sel);
      return pasToe(o, { type: 'sectieVerwijderen', sectieId: sel.sectieId }, sel);
    }

    case 'vervang':
      return { ontwerp: a.ontwerp };

    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

/** Bestaat de selectie nog in dit ontwerp? Anders weg ermee. */
function geldigeSelectie(o: Ontwerp, sel: Selectie): Selectie {
  if (!sel) return null;
  if (sel.soort === 'sectie') return o.secties.some((s) => s.id === sel.sectieId) ? sel : null;
  return vindBlok(o, sel.blokId) ? sel : null;
}

export function editorReducer(state: EditorState, a: Actie): EditorState {
  switch (a.type) {
    case 'selecteer':
      return { ...state, selectie: geldigeSelectie(state.ontwerp, a.selectie), laatsteSleutel: null };

    case 'naarContainer': {
      const sel = state.selectie;
      if (sel?.soort !== 'blok') return { ...state, selectie: null };
      const plek = vindBlok(state.ontwerp, sel.blokId);
      return { ...state, selectie: plek ? { soort: 'sectie', sectieId: plek.sectie.id } : null };
    }

    case 'ongedaan': {
      if (state.verleden.length === 0) return state;
      const vorige = state.verleden[state.verleden.length - 1];
      return {
        ...state,
        ontwerp: vorige,
        verleden: state.verleden.slice(0, -1),
        toekomst: [state.ontwerp, ...state.toekomst].slice(0, GESCHIEDENIS_MAX),
        selectie: geldigeSelectie(vorige, state.selectie),
        versie: state.versie + 1,
        laatsteSleutel: null,
      };
    }

    case 'opnieuw': {
      if (state.toekomst.length === 0) return state;
      const [volgende, ...rest] = state.toekomst;
      return {
        ...state,
        ontwerp: volgende,
        verleden: [...state.verleden, state.ontwerp].slice(-GESCHIEDENIS_MAX),
        toekomst: rest,
        selectie: geldigeSelectie(volgende, state.selectie),
        versie: state.versie + 1,
        laatsteSleutel: null,
      };
    }

    default: {
      const w = pasToe(state.ontwerp, a, state.selectie);
      if (!w || w.ontwerp === state.ontwerp) return state;

      const sleutel = 'sleutel' in a && a.sleutel ? a.sleutel : null;
      const tijd = 'tijd' in a && typeof a.tijd === 'number' ? a.tijd : 0;
      const samenvoegen =
        sleutel !== null && sleutel === state.laatsteSleutel && tijd > 0 && tijd - state.laatsteTijd < SAMENVOEG_MS && state.verleden.length > 0;

      return {
        ...state,
        ontwerp: w.ontwerp,
        verleden: samenvoegen ? state.verleden : [...state.verleden, state.ontwerp].slice(-GESCHIEDENIS_MAX),
        toekomst: [],
        selectie: w.selectie !== undefined ? w.selectie : geldigeSelectie(w.ontwerp, state.selectie),
        versie: state.versie + 1,
        laatsteSleutel: sleutel,
        laatsteTijd: tijd,
      };
    }
  }
}
