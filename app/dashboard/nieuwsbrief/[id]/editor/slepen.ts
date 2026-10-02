/**
 * Slepen en neerzetten (native HTML5 drag-and-drop, geen bibliotheek).
 *
 * Wat er gesleept wordt, staat in één gedeelde variabele: tijdens `dragover`
 * mag de browser de inhoud van dataTransfer niet laten lezen, en we willen
 * juist dan al weten of iets ergens neergezet mag worden. In dataTransfer zetten
 * we alleen een korte tekst, omdat Firefox anders helemaal niet wil slepen.
 */
import type { DragEvent } from 'react';
import type { BlokType } from '@/lib/nieuwsbrief/types';

export type Sleep =
  | { soort: 'nieuwBlok'; blokType: BlokType }
  | { soort: 'structuur'; verhouding: number[] }
  | { soort: 'module'; moduleId: string }
  | { soort: 'blok'; blokId: string }
  | { soort: 'sectie'; sectieId: string };

/** Waar de invoeglijn nu staat. */
export type DropDoel = { soort: 'sectie'; index: number } | { soort: 'kolom'; sectieId: string; kolomId: string; index: number } | null;

let huidig: Sleep | null = null;

export function startSleep(e: DragEvent, sleep: Sleep, beeld?: HTMLElement | null) {
  huidig = sleep;
  e.dataTransfer.effectAllowed = sleep.soort === 'blok' || sleep.soort === 'sectie' ? 'move' : 'copy';
  try {
    e.dataTransfer.setData('text/plain', `nieuwsbrief:${sleep.soort}`);
  } catch {
    /* sommige browsers weigeren dit; niet erg */
  }
  if (beeld) {
    try {
      e.dataTransfer.setDragImage(beeld, 16, 16);
    } catch {
      /* geen eigen sleepbeeld, dan het standaardbeeld */
    }
  }
}

export function huidigeSleep(): Sleep | null {
  return huidig;
}

export function stopSleep() {
  huidig = null;
}

/** Hoort dit thuis in een kolom (tussen blokken)? */
export function pastInKolom(s: Sleep | null): boolean {
  return s?.soort === 'nieuwBlok' || s?.soort === 'blok';
}

/** Hoort dit thuis tussen secties? Een nieuw blok mag ook: dat krijgt dan een eigen sectie. */
export function pastTussenSecties(s: Sleep | null): boolean {
  return s?.soort === 'structuur' || s?.soort === 'module' || s?.soort === 'sectie' || s?.soort === 'nieuwBlok';
}

/**
 * Bepaal de invoegpositie in een lijst elementen aan de hand van de muis:
 * boven het midden van een element = ervoor, eronder = erna.
 */
export function invoegIndex(elementen: Element[], clientY: number): number {
  for (let i = 0; i < elementen.length; i++) {
    const r = elementen[i].getBoundingClientRect();
    if (clientY < r.top + r.height / 2) return i;
  }
  return elementen.length;
}

export function zelfdeDoel(a: DropDoel, b: DropDoel): boolean {
  if (a === b) return true;
  if (!a || !b || a.soort !== b.soort || a.index !== b.index) return false;
  return a.soort === 'sectie' || (b.soort === 'kolom' && a.kolomId === b.kolomId);
}
