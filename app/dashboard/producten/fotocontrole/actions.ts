'use server';
import { dashAuthed } from '@/lib/kms/adminClient';
import { bewaarFotoMetingen, type NieuweMeting } from '@/lib/kms/afbeeldingen';

/** Bewaart een blok metingen uit de browser. Stil als de tabel nog niet bestaat. */
export async function bewaarMetingenActie(rijen: NieuweMeting[]): Promise<{ ok: boolean; aantal: number }> {
  if (!(await dashAuthed())) return { ok: false, aantal: 0 };
  if (!Array.isArray(rijen)) return { ok: false, aantal: 0 };
  return bewaarFotoMetingen(rijen.slice(0, 100));
}
