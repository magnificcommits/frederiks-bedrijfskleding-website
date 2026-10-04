import { getSpaarInstellingenBasis, synchroniseerBasisRegel, zetInstellingen } from '@/lib/kms/sparenData';
import { berekenStanden, laadEnSynchroniseer } from '@/lib/kms/sparenGrootboek';
import { vraagInwisselingAan } from '@/lib/kms/sparenInwisselen';
import { ronde2, type SpaarInstellingen } from '@/lib/kms/sparenTypes';

/**
 * Publieke ingang van het spaarsysteem. Deze functies bestonden al en worden
 * buiten de sparenmodule gebruikt (portaaloverzicht, instellingenpagina); hun
 * vorm blijft gelijk. De rekenkern staat in sparenGrootboek.ts, de basisdata in
 * sparenData.ts en de schrijfacties in sparenInwisselen.ts.
 *
 * Alleen server-side gebruiken, altijd achter dashAuthed() (behalve
 * getSpaarsaldo/getSpaarInstellingen die ook het portaal aanroept voor de
 * eigen organisatie).
 */

export type { SpaarInstellingen } from '@/lib/kms/sparenTypes';
export type Spaarsaldo = { verdiend: number; ingewisseld: number; saldo: number; euroWaarde: number };
export type SpaarsaldoKlant = {
  organisatieId: string;
  naam: string;
  verdiend: number;
  ingewisseld: number;
  saldo: number;
  euroWaarde: number;
};

/** Actief, punten per euro (basisregel) en waarde per punt. */
export async function getSpaarInstellingen(): Promise<SpaarInstellingen> {
  return getSpaarInstellingenBasis();
}

/** Schrijft de drie basisinstellingen en houdt de basisregel gelijk. */
export async function zetSpaarInstellingen(v: SpaarInstellingen): Promise<boolean> {
  const ok = await zetInstellingen({
    spaar_actief: v.actief ? 'true' : 'false',
    spaar_punten_per_euro: String(v.puntenPerEuro),
    spaar_euro_per_punt: String(v.euroPerPunt),
  });
  if (ok) await synchroniseerBasisRegel(v.puntenPerEuro);
  return ok;
}

/** Spaarsaldo voor één organisatie (boekt eerst openstaande automatische punten). */
export async function getSpaarsaldo(orgId: string): Promise<Spaarsaldo> {
  const leeg = { verdiend: 0, ingewisseld: 0, saldo: 0, euroWaarde: 0 };
  if (!orgId) return leeg;
  try {
    const b = await laadEnSynchroniseer(orgId);
    const s = berekenStanden(b).find((x) => x.organisatieId === orgId);
    if (!s) return leeg;
    const saldo = Math.max(0, s.saldo);
    return { verdiend: s.verdiend, ingewisseld: s.ingewisseld, saldo, euroWaarde: ronde2(saldo * b.instellingen.euroPerPunt) };
  } catch {
    return leeg;
  }
}

/** Spaarsaldo voor alle organisaties, gesorteerd op saldo aflopend. */
export async function getSpaarsaldoAlle(): Promise<SpaarsaldoKlant[]> {
  const b = await laadEnSynchroniseer();
  return berekenStanden(b)
    .map((s) => ({
      organisatieId: s.organisatieId,
      naam: s.naam,
      verdiend: s.verdiend,
      ingewisseld: s.ingewisseld,
      saldo: Math.max(0, s.saldo),
      euroWaarde: s.euroWaarde,
    }))
    .sort((a, c) => c.saldo - a.saldo);
}

/** Wisselt punten in voor één organisatie, vanuit het dashboard. Guard op saldo. */
export async function wisselPuntenIn(
  orgId: string,
  punten: number,
  omschrijving?: string,
): Promise<{ ok: boolean; kortingEuro: number; error?: string }> {
  const { euroPerPunt } = await getSpaarInstellingenBasis();
  const r = await vraagInwisselingAan({
    orgId,
    beloningId: null,
    punten,
    bron: 'dashboard',
    door: 'dashboard',
    notitie: omschrijving ?? null,
    directGoedkeuren: true,
  });
  if (!r.ok) return { ok: false, kortingEuro: 0, error: r.fout };
  return { ok: true, kortingEuro: ronde2(Math.floor(punten) * euroPerPunt) };
}
