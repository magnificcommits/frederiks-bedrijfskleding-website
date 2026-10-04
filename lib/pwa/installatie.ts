/**
 * Installatiestatus in de browser, gedeeld door PwaRegistratie en InstalleerApp.
 *
 * Chrome en Edge sturen `beforeinstallprompt` vaak al direct na het laden, nog
 * voordat de installeerknop in beeld is. Daarom luistert deze module zodra hij
 * geladen wordt (via PwaRegistratie in de layout) en bewaart hij het event.
 * Alleen in de browser gebruiken.
 */

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
};

let uitgesteld: InstallPromptEvent | null = null;
let geinstalleerd = false;
const luisteraars = new Set<() => void>();

function meld() {
  luisteraars.forEach((f) => f());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // geen eigen balk van de browser; wij tonen een rustige knop
    uitgesteld = e as InstallPromptEvent;
    meld();
  });
  window.addEventListener('appinstalled', () => {
    uitgesteld = null;
    geinstalleerd = true;
    meld();
  });
}

export function abonneer(f: () => void): () => void {
  luisteraars.add(f);
  return () => {
    luisteraars.delete(f);
  };
}

export function installPrompt(): InstallPromptEvent | null {
  return uitgesteld;
}

/** Toont de installatievraag van de browser. Geeft true als de gebruiker op Installeren tikte. */
export async function vraagInstallatie(): Promise<boolean> {
  const e = uitgesteld;
  if (!e) return false;
  uitgesteld = null; // een prompt mag maar één keer gebruikt worden
  meld();
  try {
    await e.prompt();
    const keuze = await e.userChoice;
    return keuze.outcome === 'accepted';
  } catch {
    return false;
  }
}

/** Draait de pagina al als geïnstalleerde app? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (geinstalleerd) return true;
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  try {
    return ios
      || window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: window-controls-overlay)').matches
      || window.matchMedia('(display-mode: minimal-ui)').matches;
  } catch {
    return ios;
  }
}

/** iPhone of iPad (ook een iPad die zich als Mac voordoet). Daar bestaat geen installatievraag. */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}
