/**
 * Terugval zolang een migratie met nieuwe kolommen nog niet gedraaid is: eerst
 * met de nieuwe kolommen proberen, bij "kolom bestaat niet" nogmaals zonder.
 * Zo blijft in elk geval de oude tekstkolom gevuld.
 */

type PgFout = { code?: string; message?: string } | null | undefined;

/** "column ... does not exist" (42703), of PostgREST die de kolom niet in zijn schema heeft (PGRST204). */
export function kolomOntbreekt(fout: PgFout): boolean {
  if (!fout) return false;
  if (fout.code === '42703' || fout.code === 'PGRST204') return true;
  const m = String(fout.message ?? '').toLowerCase();
  return m.includes('does not exist') || m.includes('could not find') || m.includes('schema cache');
}

/**
 * Voert een insert/update uit met de id-kolommen erbij. Bestaan die kolommen
 * nog niet, dan nogmaals zonder, zodat de naam in elk geval wordt opgeslagen.
 */
export async function metIdTerugval<T extends { error: PgFout }>(
  rij: Record<string, unknown>,
  idKolommen: string[],
  uitvoeren: (rij: Record<string, unknown>) => PromiseLike<T>,
): Promise<T> {
  const eerste = await uitvoeren(rij);
  if (!kolomOntbreekt(eerste.error) || !idKolommen.some((k) => k in rij)) return eerste;
  const zonder = { ...rij };
  for (const k of idKolommen) delete zonder[k];
  return uitvoeren(zonder);
}
