'use server';
import { revalidatePath } from 'next/cache';
import { dashAuthed, magEigenaar } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { getBeschikbaarheid, zetBeschikbaarheid } from '@/lib/afspraken/beschikbaarheid';
import { normaliseerBeschikbaarheid, type Beschikbaarheid } from '@/lib/afspraken/soorten';
import { isDatum, isTijd, plusDagen, vandaagNl, weekdagVan } from '@/app/dashboard/taken/tijd';

type Uitkomst = { ok: boolean; fout?: string };

async function wijzig(actie: string, details: Record<string, unknown>, aanpassen: (b: Beschikbaarheid) => void): Promise<Uitkomst> {
  if (!(await dashAuthed()) || !(await magEigenaar())) return { ok: false, fout: 'Geen toegang' };
  const b = await getBeschikbaarheid();
  aanpassen(b);
  // Oude dagen opruimen, zodat de lijst niet blijft groeien.
  const gisteren = plusDagen(vandaagNl(), -1);
  b.geslotenTijden = Object.fromEntries(Object.entries(b.geslotenTijden).filter(([d, t]) => d >= gisteren && t.length));
  b.extraDagen = b.extraDagen.filter((d) => d >= gisteren);
  const ok = await zetBeschikbaarheid(normaliseerBeschikbaarheid(b));
  if (!ok) return { ok: false, fout: 'Opslaan lukte niet' };
  await logAudit(actie, { entiteit: 'instellingen', entiteitId: 'afspraken_beschikbaarheid', details });
  revalidatePath('/dashboard/afspraken/beschikbaarheid');
  return { ok: true };
}

/** Losse tijden dicht of open zetten. */
export async function zetTijdenActie(datum: string, tijden: string[], dicht: boolean): Promise<Uitkomst> {
  if (!isDatum(datum) || !tijden.every((t) => isTijd(t))) return { ok: false, fout: 'Ongeldige tijd' };
  return wijzig('beschikbaarheid_tijden', { datum, tijden, dicht }, (b) => {
    const huidig = new Set(b.geslotenTijden[datum] ?? []);
    for (const t of tijden) {
      if (dicht) huidig.add(t);
      else huidig.delete(t);
    }
    b.geslotenTijden[datum] = [...huidig].sort();
  });
}

/** Een hele dag dicht (vrij, vol, vakantie) of weer open, ook een dag buiten de vaste werkdagen. */
export async function zetDagActie(datum: string, stand: 'dicht' | 'open'): Promise<Uitkomst> {
  if (!isDatum(datum)) return { ok: false, fout: 'Ongeldige datum' };
  return wijzig('beschikbaarheid_dag', { datum, stand }, (b) => {
    if (stand === 'dicht') {
      b.geblokkeerd = [...new Set([...b.geblokkeerd, datum])];
      b.extraDagen = b.extraDagen.filter((d) => d !== datum);
    } else {
      b.geblokkeerd = b.geblokkeerd.filter((d) => d !== datum);
      if (!b.werkdagen.includes(weekdagVan(datum))) b.extraDagen = [...new Set([...b.extraDagen, datum])];
      delete b.geslotenTijden[datum];
    }
  });
}

/** Een periode dicht, bijvoorbeeld vakantie. */
export async function blokkeerPeriodeActie(van: string, tot: string): Promise<Uitkomst> {
  if (!isDatum(van) || !isDatum(tot) || tot < van) return { ok: false, fout: 'Kies een geldige periode' };
  return wijzig('beschikbaarheid_periode', { van, tot }, (b) => {
    const dagen: string[] = [];
    for (let d = van, n = 0; d <= tot && n < 370; d = plusDagen(d, 1), n++) dagen.push(d);
    b.geblokkeerd = [...new Set([...b.geblokkeerd, ...dagen])];
    b.extraDagen = b.extraDagen.filter((d) => !dagen.includes(d));
  });
}
