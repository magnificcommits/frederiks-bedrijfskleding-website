import { kmsAdmin } from '@/lib/kms/adminClient';
import { nlDelen, nlNaarDate, plusDagen, plusMinuten, weekdagVan, minutenVan } from '@/app/dashboard/taken/tijd';
import { afspraakPersoon, getBeschikbaarheid } from '@/lib/afspraken/beschikbaarheid';
import { SOORT_INFO, type AfspraakSoort, type Beschikbaarheid } from '@/lib/afspraken/soorten';

/**
 * Het overzicht voor Jessi: per dag de blokjes van een halfuur (of de ingestelde
 * stap) met wat er staat. Open kan een klant boeken, dicht heeft Jessi zelf
 * dichtgezet, geboekt is een online afspraak, agenda is een afspraak die ze zelf
 * in Taken zette. Zelfde regels als de boekpagina (lib/afspraken/beschikbaarheid.ts).
 */

export type BlokStatus = 'open' | 'dicht' | 'geboekt' | 'agenda' | 'pauze' | 'voorbij';
export type PlanBlok = { tijd: string; status: BlokStatus; label?: string; href?: string };
export type PlanDag = {
  datum: string;
  /** Vaste werkdag volgens de instellingen. */
  werkdag: boolean;
  /** Hele dag dichtgezet (vakantie, vrij, vol). */
  dicht: boolean;
  /** Geen vaste werkdag, maar toch open gezet. */
  extraOpen: boolean;
  /** Maximum aantal online afspraken voor die dag bereikt. */
  vol: boolean;
  geboekt: number;
  blokken: PlanBlok[];
};

export type Planner = { dagen: PlanDag[]; stapMin: number; maxPerDag: number };

/** Alle begintijden van het raster: van de vroegste tot de laatste tijd uit de vaste tijdvakken. */
export function raster(inst: Beschikbaarheid): { tijd: string; binnenWerktijd: boolean }[] {
  const van = Math.min(...inst.tijdvakken.map((t) => minutenVan(t.van)));
  const tot = Math.max(...inst.tijdvakken.map((t) => minutenVan(t.tot)));
  const uit: { tijd: string; binnenWerktijd: boolean }[] = [];
  for (let m = van; m + inst.stapMin <= tot; m += inst.stapMin) {
    const tijd = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const binnenWerktijd = inst.tijdvakken.some((t) => m >= minutenVan(t.van) && m + inst.stapMin <= minutenVan(t.tot));
    uit.push({ tijd, binnenWerktijd });
  }
  return uit;
}

export async function laadPlanner(vanaf: string, aantalDagen: number): Promise<Planner> {
  const inst = await getBeschikbaarheid();
  const dagen: string[] = [];
  for (let i = 0; i < aantalDagen; i++) dagen.push(plusDagen(vanaf, i));
  const leeg: Planner = { dagen: [], stapMin: inst.stapMin, maxPerDag: inst.maxPerDag };
  const sb = kmsAdmin();
  if (!sb) return leeg;

  const vanMoment = nlNaarDate(dagen[0]).toISOString();
  const totMoment = nlNaarDate(plusDagen(dagen[dagen.length - 1], 1)).toISOString();
  const persoon = await afspraakPersoon(inst);
  let takenQuery = sb
    .from('taken')
    .select('id, titel, vervaldatum, tijd, eind_tijd')
    .eq('soort', 'afspraak')
    .is('verwijderd_op', null)
    .not('tijd', 'is', null)
    .gte('vervaldatum', dagen[0])
    .lte('vervaldatum', dagen[dagen.length - 1])
    .limit(1000);
  if (persoon) takenQuery = takenQuery.or(`persoon_id.eq.${persoon.id},persoon_id.is.null`);
  const [afsprakenRes, takenRes] = await Promise.all([
    sb
      .from('afspraken')
      .select('id, soort, naam, bedrijf, start_op, eind_op, taak_id')
      .eq('status', 'gepland')
      .lt('start_op', totMoment)
      .gt('eind_op', vanMoment)
      .limit(1000),
    takenQuery,
  ]);

  type A = { id: string; soort: AfspraakSoort; naam: string; bedrijf: string | null; start_op: string; eind_op: string; taak_id: string | null };
  type T = { id: string; titel: string | null; vervaldatum: string; tijd: string; eind_tijd: string | null };
  const afspraken = (afsprakenRes.data as A[]) ?? [];
  const gekoppeld = new Set(afspraken.map((a) => a.taak_id).filter(Boolean));
  const taken = ((takenRes.data as T[]) ?? []).filter((t) => !gekoppeld.has(t.id));

  const nu = Date.now();
  const geblokkeerd = new Set(inst.geblokkeerd);
  const extra = new Set(inst.extraDagen);
  const rooster = raster(inst);
  const stap = inst.stapMin * 60_000;

  leeg.dagen = dagen.map((datum) => {
    const werkdag = inst.werkdagen.includes(weekdagVan(datum));
    const extraOpen = !werkdag && extra.has(datum);
    const dicht = geblokkeerd.has(datum) || (!werkdag && !extraOpen);
    const gesloten = new Set(inst.geslotenTijden[datum] ?? []);
    const vanDag = afspraken.filter((a) => nlDelen(new Date(a.start_op)).datum === datum);
    const takenDag = taken.filter((t) => t.vervaldatum === datum);
    const blokken: PlanBlok[] = rooster.map(({ tijd, binnenWerktijd }) => {
      const start = nlNaarDate(datum, tijd).getTime();
      const eind = start + stap;
      const a = vanDag.find((x) => start < new Date(x.eind_op).getTime() && eind > new Date(x.start_op).getTime());
      if (a) return { tijd, status: 'geboekt', label: `${SOORT_INFO[a.soort].label}: ${a.bedrijf || a.naam}`, href: '/dashboard/afspraken' };
      const t = takenDag.find((x) => {
        const ts = nlNaarDate(datum, x.tijd.slice(0, 5)).getTime();
        const eindTijd = x.eind_tijd && x.eind_tijd.slice(0, 5) > x.tijd.slice(0, 5) ? x.eind_tijd.slice(0, 5) : plusMinuten(x.tijd.slice(0, 5), 60);
        return start < nlNaarDate(datum, eindTijd).getTime() && eind > ts;
      });
      if (t) return { tijd, status: 'agenda', label: t.titel ?? 'Afspraak in de agenda', href: '/dashboard/taken?weergave=agenda' };
      if (eind <= nu) return { tijd, status: 'voorbij' };
      if (!binnenWerktijd) return { tijd, status: 'pauze' };
      if (dicht || gesloten.has(tijd)) return { tijd, status: 'dicht' };
      return { tijd, status: 'open' };
    });
    return { datum, werkdag, dicht, extraOpen, vol: vanDag.length >= inst.maxPerDag, geboekt: vanDag.length, blokken };
  });
  return leeg;
}
