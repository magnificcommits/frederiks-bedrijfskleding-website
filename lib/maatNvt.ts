/**
 * Maat "NVT" (niet van toepassing) bij een werknemer: hij draagt dit artikel niet,
 * bijvoorbeeld een damesmodel bij een man. Telt niet als ontbrekende maat en het
 * artikel verdwijnt uit zijn portaal. Opgeslagen als voorkeursmaat 'NVT'.
 */
export const NVT_MAAT = 'NVT';

export function isNvtMaat(maat: string | null | undefined): boolean {
  return String(maat ?? '').trim().toUpperCase() === NVT_MAAT;
}
