/**
 * Foutafhandeling voor Supabase-queries.
 *
 * Probleem dat dit oplost: `const { data } = await sb.from(...)` zonder naar
 * `error` te kijken geeft bij een fout (kapotte join zoals PGRST201, ontbrekende
 * kolom, RLS, time-out) gewoon een lege lijst. Jessi ziet dan "geen orders" en
 * denkt dat er niets is. Met deze helpers:
 *
 *  - logDbFout(context, error): één regel in de serverlog (Vercel) met context,
 *    foutcode en een ingekorte melding. Zonder persoonsgegevens: e-mailadressen,
 *    telefoonnummers en lange getallen worden gemaskeerd, en de `details` van
 *    Postgres (die rijwaarden kunnen bevatten) loggen we niet.
 *  - eisData(context, resultaat): logt en gooit een DataLaadFout. De error
 *    boundary van de route (app/dashboard/error.tsx, app/portaal/error.tsx) toont
 *    dan een nette melding met "Opnieuw proberen" in plaats van een lege lijst.
 *  - eisRijen(context, resultaat): voor update/delete met `.select()`: 0 rijen
 *    geraakt (RLS weigerde stil, of de rij bestaat niet) wordt een fout.
 *
 * Puur: geen server-only imports, dus ook bruikbaar in tests.
 */

export type DbFoutInfo = { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined;

/** Fout die een error boundary opvangt; de melding is veilig om te tonen. */
export class DataLaadFout extends Error {
  readonly context: string;
  readonly code: string | null;
  constructor(context: string, code: string | null) {
    super('De gegevens konden niet worden geladen.');
    this.name = 'DataLaadFout';
    this.context = context;
    this.code = code;
  }
}

/** Haalt persoonsgegevens uit een foutmelding voordat die in een log komt. */
export function maskeer(tekst: string): string {
  return tekst
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[e-mail]')
    .replace(/(?:\+|00)?\d[\d\s-]{7,}\d/g, '[nummer]')
    .replace(/\(([^()]*)\)=\(([^()]*)\)/g, '($1)=([waarde])')
    .slice(0, 300);
}

/** Logt een databasefout met context, zonder persoonsgegevens. Doet niets zonder fout. */
export function logDbFout(context: string, error: DbFoutInfo): void {
  if (!error) return;
  const code = error.code ? String(error.code) : 'onbekend';
  const melding = maskeer(String(error.message ?? ''));
  const hint = error.hint ? ` hint: ${maskeer(String(error.hint))}` : '';
  console.error(`[db] ${context}: ${code} ${melding}${hint}`);
}

/**
 * Data uit een Supabase-resultaat, of een DataLaadFout als de query faalde.
 * Gebruik voor lijsten en detailpagina's waar een lege uitkomst misleidend is.
 */
export function eisData<T>(context: string, resultaat: { data: T | null; error: DbFoutInfo }): T | null {
  if (resultaat.error) {
    logDbFout(context, resultaat.error);
    throw new DataLaadFout(context, resultaat.error.code ? String(resultaat.error.code) : null);
  }
  return resultaat.data;
}

/** Uitkomst van een schrijfactie: ok, of een melding in gewone taal. */
export type SchrijfUitkomst = { ok: true } | { ok: false; fout: string };

/**
 * Controleert een update/delete die met `.select('id')` is uitgevoerd.
 * Fout of 0 geraakte rijen (RLS weigerde stil, of de rij bestaat niet meer)
 * geeft `{ ok: false }` met een melding; anders `{ ok: true }`.
 */
export function eisRijen(
  context: string,
  resultaat: { data: unknown[] | null; error: DbFoutInfo },
  melding = 'Dat lukte niet. Je hebt hier geen rechten voor, of het item bestaat niet meer.',
): SchrijfUitkomst {
  if (resultaat.error) {
    logDbFout(context, resultaat.error);
    return { ok: false, fout: 'Opslaan lukte niet door een fout in de database. Probeer het opnieuw.' };
  }
  if (!resultaat.data || resultaat.data.length === 0) {
    console.error(`[db] ${context}: 0 rijen geraakt (RLS of niet gevonden)`);
    return { ok: false, fout: melding };
  }
  return { ok: true };
}
