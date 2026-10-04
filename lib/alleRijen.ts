import { DataLaadFout, logDbFout, type DbFoutInfo } from '@/lib/dbFout';

/**
 * Supabase (PostgREST) geeft nooit meer dan 1000 rijen per verzoek terug, ook
 * niet met `.limit(5000)`. Er komt dan geen fout, alleen stil een afgekapte lijst.
 * Met 25.000 productvarianten gaat dat direct mis.
 *
 * `alleRijen` haalt een query in blokken van 1000 op met `.range()` tot alles
 * binnen is. De query moet een vaste volgorde hebben (bijvoorbeeld `.order('id')`),
 * anders kunnen rijen tussen twee blokken verschuiven.
 *
 *   const rijen = await alleRijen('varianten', (van, tot) =>
 *     sb.from('product_varianten').select('id, maat').order('id').range(van, tot));
 *
 * Bij een fout: loggen en een DataLaadFout gooien (de error boundary toont een
 * nette melding), tenzij `bijFout: 'leeg'` is gegeven; dan komt terug wat er al was.
 */

export const BLOK = 1000;

type Resultaat<T> = PromiseLike<{ data: T[] | null; error: DbFoutInfo }>;

export async function alleRijen<T>(
  context: string,
  maak: (van: number, tot: number) => Resultaat<T>,
  opties: { max?: number; bijFout?: 'gooi' | 'leeg' } = {},
): Promise<T[]> {
  const max = opties.max ?? 100_000;
  const uit: T[] = [];
  for (let van = 0; van < max; van += BLOK) {
    const { data, error } = await maak(van, Math.min(van + BLOK, max) - 1);
    if (error) {
      logDbFout(context, error);
      if (opties.bijFout === 'leeg') return uit;
      throw new DataLaadFout(context, error.code ? String(error.code) : null);
    }
    const rijen = data ?? [];
    uit.push(...rijen);
    if (rijen.length < BLOK) break;
  }
  return uit;
}
