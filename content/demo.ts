/**
 * Demovideo van het kledingportaal (/kledingbeheer/demo).
 *
 * Zet het bestand in /public/demo/ (MP4, H.264, liefst onder 40 MB) en vul hier
 * het pad in. Zolang `video` leeg is, toont de pagina na het formulier het
 * voorbeeldportaal in plaats van een video, en heet de knop ook zo: we vragen
 * geen gegevens voor iets dat er nog niet is.
 *
 * Een video van YouTube, Vimeo of Loom kan ook, maar dan moet de CSP in
 * next.config.mjs een frame-src voor dat domein krijgen. Zelf hosten is eenvoudiger.
 */
export const demoVideo = {
  video: '' as string,
  poster: '' as string,
  /** Hoe lang de video duurt, zoals de bezoeker het leest. */
  duur: '3 minuten',
};
