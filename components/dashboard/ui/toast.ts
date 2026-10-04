/**
 * Melding onderin beeld vanuit clientcode, zonder provider:
 *
 *   toon('Taak verwijderd', { ongedaan: { actie: () => zetTerug(id) } });
 *   toon('Opslaan is mislukt', { soort: 'fout' });
 *
 * De globale <Toast /> in de DashboardShell luistert hiernaar. Server actions
 * die doorsturen gebruiken ?ok=... of ?fout=... in de URL; dat pakt dezelfde
 * Toast op.
 */
export type ToastSoort = 'ok' | 'fout';
export type ToastOpties = {
  soort?: ToastSoort;
  /** Knop "Ongedaan maken" in de melding; de melding blijft dan langer staan. */
  ongedaan?: { label?: string; actie: () => void | Promise<unknown> };
  /** Hoe lang de melding blijft staan, in ms. */
  duur?: number;
};
export type ToastDetail = ToastOpties & { tekst: string };

export const TOAST_EVENT = 'fb:toast';

export function toon(tekst: string, opties: ToastOpties = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { tekst, ...opties } }));
}
