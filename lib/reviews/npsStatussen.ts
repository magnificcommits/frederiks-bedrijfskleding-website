/**
 * Orderstatussen waarin de bestelling echt bij de klant is (of onderweg). Alleen
 * dan gaat de tevredenheidsmail. Bewust zonder 'compleet_geleverd' (alles binnen
 * bij Frederiks, nog niet bij de klant) en zonder 'geannuleerd'.
 * Zelfde lijst als de trigger orders_zet_geleverd_op in de database.
 * Los bestand zonder imports, zodat het ook in tests bruikbaar is.
 */
export const NPS_ORDERSTATUSSEN = ['verzonden', 'factureren', 'afgerond'] as const;

export function isNpsOrderstatus(status: string | null | undefined): boolean {
  return (NPS_ORDERSTATUSSEN as readonly string[]).includes(String(status ?? ''));
}
