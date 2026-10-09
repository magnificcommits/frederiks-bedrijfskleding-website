import { kmsAdmin } from '@/lib/kms/adminClient';
import { env } from '@/lib/env';
import { nlDelen, nlNaarDate, plusDagen, plusMinuten, weekdagVan, minutenVan } from '@/app/dashboard/taken/tijd';
import {
  normaliseerBeschikbaarheid,
  STANDAARD_BESCHIKBAARHEID,
  type AfspraakSoort,
  type Beschikbaarheid,
  type VrijeDag,
} from '@/lib/afspraken/soorten';

/**
 * Beschikbaarheid voor online afspraken: instellingen (sleutel/waarde-tabel
 * `instellingen`, geen migratie nodig) en de berekening van vrije tijden.
 *
 * Bezet is:
 *  - elke geplande online afspraak (tabel afspraken);
 *  - elke afspraak met een tijd in de takenmodule van dezelfde persoon of zonder
 *    persoon (zo telt een klantbezoek dat Jessi zelf invoerde ook mee).
 * Rond elk bezet blok komt de buffer. Taken (geen afspraken) houden je niet bezet,
 * net als in de agenda-feed.
 *
 * Alleen server-side gebruiken (service-role).
 */

const SLEUTEL = 'afspraken_beschikbaarheid';

export async function getBeschikbaarheid(): Promise<Beschikbaarheid> {
  const sb = kmsAdmin();
  if (!sb) return STANDAARD_BESCHIKBAARHEID;
  const { data } = await sb.from('instellingen').select('waarde').eq('sleutel', SLEUTEL).maybeSingle();
  const raw = (data as { waarde: string | null } | null)?.waarde;
  if (!raw) return STANDAARD_BESCHIKBAARHEID;
  try {
    return normaliseerBeschikbaarheid(JSON.parse(raw));
  } catch {
    return STANDAARD_BESCHIKBAARHEID;
  }
}

export async function zetBeschikbaarheid(b: Beschikbaarheid): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const waarde = JSON.stringify(normaliseerBeschikbaarheid(b));
  const { error } = await sb
    .from('instellingen')
    .upsert({ sleutel: SLEUTEL, waarde, bijgewerkt_op: new Date().toISOString() }, { onConflict: 'sleutel' });
  return !error;
}

export type AgendaPersoon = { id: string; naam: string; email: string | null };

/**
 * In wiens agenda de afspraken komen: de ingestelde persoon, anders Jessi
 * (op naam of op het meldadres), anders de eerste actieve persoon.
 */
export async function afspraakPersoon(inst?: Beschikbaarheid): Promise<AgendaPersoon | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const b = inst ?? (await getBeschikbaarheid());
  const { data } = await sb.from('taak_personen').select('id, naam, email, actief').order('created_at');
  const personen = ((data as { id: string; naam: string; email: string | null; actief: boolean }[]) ?? []).filter((p) => p.actief);
  const gekozen =
    (b.persoonId && personen.find((p) => p.id === b.persoonId)) ||
    personen.find((p) => p.naam.trim().toLowerCase().startsWith('jessi')) ||
    personen.find((p) => (p.email ?? '').trim().toLowerCase() === env.notifyEmail.toLowerCase()) ||
    personen[0];
  return gekozen ? { id: gekozen.id, naam: gekozen.naam, email: gekozen.email } : null;
}

type Blok = { start: number; eind: number };

type AfspraakRij = { id: string; start_op: string; eind_op: string; taak_id: string | null };
type TaakRij = { id: string; vervaldatum: string | null; tijd: string | null; eind_tijd: string | null };

/**
 * Vrije starttijden per dag voor een soort afspraak, vanaf vandaag tot het
 * ingestelde aantal dagen vooruit. `alleenDatum` beperkt de berekening tot één
 * dag (controle vlak voor het boeken). `negeerAfspraakId` laat een bestaande
 * afspraak buiten beschouwing, zodat je hem kunt verzetten naar een tijd die
 * overlapt met zijn eigen oude tijd.
 */
export async function vrijeDagen(
  soort: AfspraakSoort,
  opties: { alleenDatum?: string; negeerAfspraakId?: string; nu?: Date } = {},
): Promise<VrijeDag[]> {
  const inst = await getBeschikbaarheid();
  const soortInst = inst.soorten[soort];
  if (!soortInst?.actief) return [];
  const sb = kmsAdmin();
  if (!sb) return [];

  const nu = opties.nu ?? new Date();
  const vroegst = nu.getTime() + inst.minUrenVooraf * 3_600_000;
  const vandaag = nlDelen(nu).datum;
  const laatste = plusDagen(vandaag, inst.dagenVooruit);

  let dagen: string[] = [];
  for (let d = vandaag; d <= laatste; d = plusDagen(d, 1)) dagen.push(d);
  if (opties.alleenDatum) dagen = dagen.filter((d) => d === opties.alleenDatum);
  if (!dagen.length) return [];

  const vanMoment = nlNaarDate(dagen[0]).toISOString();
  const totMoment = nlNaarDate(plusDagen(dagen[dagen.length - 1], 1)).toISOString();
  const persoon = await afspraakPersoon(inst);

  let takenQuery = sb
    .from('taken')
    .select('id, vervaldatum, tijd, eind_tijd')
    .eq('soort', 'afspraak')
    .is('verwijderd_op', null)
    .not('tijd', 'is', null)
    .gte('vervaldatum', dagen[0])
    .lte('vervaldatum', dagen[dagen.length - 1])
    .limit(2000);
  if (persoon) takenQuery = takenQuery.or(`persoon_id.eq.${persoon.id},persoon_id.is.null`);

  const [afsprakenRes, takenRes] = await Promise.all([
    sb
      .from('afspraken')
      .select('id, start_op, eind_op, taak_id')
      .eq('status', 'gepland')
      .lt('start_op', totMoment)
      .gt('eind_op', vanMoment)
      .limit(2000),
    takenQuery,
  ]);

  const afspraken = ((afsprakenRes.data as AfspraakRij[]) ?? []).filter((a) => a.id !== opties.negeerAfspraakId);
  // De taak die bij een online afspraak hoort, telt al via de afspraak zelf.
  const gekoppeld = new Set(((afsprakenRes.data as AfspraakRij[]) ?? []).map((a) => a.taak_id).filter(Boolean));
  const buffer = inst.bufferMin * 60_000;

  const bezet: Blok[] = [];
  const perDag = new Map<string, number>();
  for (const a of afspraken) {
    const start = new Date(a.start_op).getTime();
    const eind = new Date(a.eind_op).getTime();
    bezet.push({ start: start - buffer, eind: eind + buffer });
    const dag = nlDelen(new Date(start)).datum;
    perDag.set(dag, (perDag.get(dag) ?? 0) + 1);
  }
  for (const t of (takenRes.data as TaakRij[]) ?? []) {
    if (gekoppeld.has(t.id) || !t.vervaldatum || !t.tijd) continue;
    const tijd = t.tijd.slice(0, 5);
    const eindTijd = t.eind_tijd && t.eind_tijd.slice(0, 5) > tijd ? t.eind_tijd.slice(0, 5) : plusMinuten(tijd, 60);
    bezet.push({
      start: nlNaarDate(t.vervaldatum, tijd).getTime() - buffer,
      eind: nlNaarDate(t.vervaldatum, eindTijd).getTime() + buffer,
    });
  }

  // Tijden die Jessi zelf dichtzette, tellen als bezet (zonder buffer).
  for (const [dag, tijden] of Object.entries(inst.geslotenTijden)) {
    for (const t of tijden) {
      const start = nlNaarDate(dag, t).getTime();
      bezet.push({ start, eind: start + inst.stapMin * 60_000 });
    }
  }

  const geblokkeerd = new Set(inst.geblokkeerd);
  const extra = new Set(inst.extraDagen);
  const duur = soortInst.duurMin * 60_000;
  const uit: VrijeDag[] = [];

  for (const dag of dagen) {
    if (!inst.werkdagen.includes(weekdagVan(dag)) && !extra.has(dag)) continue;
    if (geblokkeerd.has(dag)) continue;
    if ((perDag.get(dag) ?? 0) >= inst.maxPerDag) continue;
    const tijden: string[] = [];
    for (const vak of inst.tijdvakken) {
      const eindVak = minutenVan(vak.tot);
      for (let m = minutenVan(vak.van); m + soortInst.duurMin <= eindVak; m += inst.stapMin) {
        const tijd = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const start = nlNaarDate(dag, tijd).getTime();
        if (start < vroegst) continue;
        const eind = start + duur;
        if (bezet.some((b) => start < b.eind && eind > b.start)) continue;
        tijden.push(tijd);
      }
    }
    if (tijden.length) uit.push({ datum: dag, tijden });
  }
  return uit;
}

/** Is dit precieze moment (nog) vrij voor deze soort? */
export async function momentIsVrij(
  soort: AfspraakSoort,
  datum: string,
  tijd: string,
  negeerAfspraakId?: string,
): Promise<boolean> {
  const dagen = await vrijeDagen(soort, { alleenDatum: datum, negeerAfspraakId });
  return dagen.some((d) => d.datum === datum && d.tijden.includes(tijd));
}

/** Begin en eind van een afspraak als echte momenten. */
export async function afspraakMomenten(soort: AfspraakSoort, datum: string, tijd: string): Promise<{ start: Date; eind: Date }> {
  const inst = await getBeschikbaarheid();
  const start = nlNaarDate(datum, tijd);
  return { start, eind: new Date(start.getTime() + inst.soorten[soort].duurMin * 60_000) };
}
