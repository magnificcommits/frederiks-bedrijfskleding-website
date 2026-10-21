/**
 * Korting per merk per klant (Jessi, 21 okt 2026). Een merkkorting gaat voor de
 * algemene klantkorting; staat er voor het merk niets, dan geldt de klantkorting.
 * Puur rekenwerk, zodat portaal (server en browser) en KMS hetzelfde uitkomen.
 */
export type MerkKortingen = Record<string, number>;

export function merkSleutel(merk: string | null | undefined): string {
  return String(merk ?? '').trim().toLowerCase();
}

export function kortingVoorMerk(merkKortingen: MerkKortingen | null | undefined, merk: string | null | undefined, standaard: number | null | undefined): number {
  const m = merkKortingen?.[merkSleutel(merk)];
  if (m != null && Number.isFinite(m) && m >= 0 && m <= 100) return m;
  const s = Number(standaard) || 0;
  return s > 0 && s <= 100 ? s : 0;
}
