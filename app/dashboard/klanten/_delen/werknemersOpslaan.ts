import { listAfdelingen, maakAfdelingMetId } from '@/lib/kms/structuur';
import { listWerknemers, maakWerknemers, werkWerknemerBij, type WerknemerVelden } from '@/lib/kms/werknemers';
import { logAudit } from '@/lib/kms/audit';

/**
 * Server-side opslag voor de werknemerslijst uit de wizard en het plakvenster
 * op het tabblad Werknemers. Alleen aanroepen vanuit een server action, ná
 * dashAuthed().
 *
 * Een afdeling komt binnen als 'id:<uuid>' (bestaande afdeling) of
 * 'nieuw:<naam>' (uit een geplakte lijst; wordt aangemaakt als hij nog niet
 * bestaat). Alles wat niet bij deze klant hoort, wordt genegeerd.
 */

export type InvoerRij = { voornaam: string; achternaam: string; afdeling: string; email: string };
export type AfdelingWijziging = { id: string; afdeling: string };

export type OpslagUitkomst = {
  aangemaakt: number;
  dubbel: number;
  afdelingenAangemaakt: number;
  gewijzigd: number;
  ongeldigeEmail: number;
  mislukt: number;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function tekst(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** JSON uit een verborgen formulierveld veilig inlezen. */
export function leesJsonLijst(ruw: FormDataEntryValue | null): unknown[] {
  if (typeof ruw !== 'string' || !ruw) return [];
  try {
    const v = JSON.parse(ruw);
    return Array.isArray(v) ? v.slice(0, 1000) : [];
  } catch {
    return [];
  }
}

export function naarInvoerRijen(lijst: unknown[]): InvoerRij[] {
  return lijst.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    return { voornaam: tekst(o.voornaam), achternaam: tekst(o.achternaam), afdeling: tekst(o.afdeling, 240), email: tekst(o.email) };
  });
}

export function naarWijzigingen(lijst: unknown[]): AfdelingWijziging[] {
  return lijst
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return { id: tekst(o.id, 64), afdeling: tekst(o.afdeling, 240) };
    })
    .filter((w) => w.id);
}

export async function slaWerknemersOp(
  orgId: string,
  rijen: InvoerRij[],
  wijzigingen: AfdelingWijziging[] = [],
): Promise<OpslagUitkomst> {
  const uitkomst: OpslagUitkomst = { aangemaakt: 0, dubbel: 0, afdelingenAangemaakt: 0, gewijzigd: 0, ongeldigeEmail: 0, mislukt: 0 };
  if (!orgId) return uitkomst;

  const [afdelingen, bestaand] = await Promise.all([listAfdelingen(orgId), listWerknemers(orgId)]);
  const afdelingIds = new Set(afdelingen.map((a) => a.id));
  const opNaam = new Map(afdelingen.map((a) => [a.naam.trim().toLowerCase(), a.id]));
  const nieuweAfdelingen: string[] = [];

  async function afdelingVoor(waarde: string): Promise<string | null> {
    if (!waarde) return null;
    if (waarde.startsWith('id:')) {
      const id = waarde.slice(3);
      return afdelingIds.has(id) ? id : null;
    }
    const naam = (waarde.startsWith('nieuw:') ? waarde.slice(6) : waarde).trim().slice(0, 120);
    if (!naam) return null;
    const sleutel = naam.toLowerCase();
    const bekend = opNaam.get(sleutel);
    if (bekend) return bekend;
    const id = await maakAfdelingMetId(orgId, { naam });
    if (!id) return null;
    opNaam.set(sleutel, id);
    afdelingIds.add(id);
    nieuweAfdelingen.push(naam);
    return id;
  }

  // Wie er al is (op e-mail, anders op naam), zodat twee keer plakken geen dubbelen geeft.
  const gezien = new Set<string>();
  for (const w of bestaand) {
    if (w.email) gezien.add(`e:${w.email.trim().toLowerCase()}`);
    gezien.add(`n:${w.naam.trim().toLowerCase()}`);
  }

  const teMaken: WerknemerVelden[] = [];
  for (const r of rijen) {
    const naam = [r.voornaam, r.achternaam].filter(Boolean).join(' ').trim();
    if (!naam) continue;
    let email = r.email.toLowerCase();
    if (email && !EMAIL.test(email)) {
      uitkomst.ongeldigeEmail += 1;
      email = '';
    }
    const sleutel = email ? `e:${email}` : `n:${naam.toLowerCase()}`;
    if (gezien.has(sleutel) || (!email && gezien.has(`n:${naam.toLowerCase()}`))) {
      uitkomst.dubbel += 1;
      continue;
    }
    gezien.add(sleutel);
    gezien.add(`n:${naam.toLowerCase()}`);
    teMaken.push({
      naam,
      voornaam: r.voornaam || null,
      achternaam: r.achternaam || null,
      email: email || null,
      afdeling_id: await afdelingVoor(r.afdeling),
    });
  }

  const gemaakt = teMaken.length > 0 ? await maakWerknemers(orgId, teMaken) : [];
  uitkomst.aangemaakt = gemaakt.length;
  uitkomst.mislukt = teMaken.length - gemaakt.length;
  uitkomst.afdelingenAangemaakt = nieuweAfdelingen.length;

  // Afdeling van bestaande werknemers wijzigen (alleen werknemers van deze klant).
  const eigen = new Map(bestaand.map((w) => [w.id, w]));
  for (const w of wijzigingen) {
    const huidig = eigen.get(w.id);
    if (!huidig) continue;
    const nieuw = await afdelingVoor(w.afdeling);
    if ((huidig.afdeling_id ?? null) === nieuw) continue;
    const { ok, voor, na } = await werkWerknemerBij(w.id, { afdeling_id: nieuw });
    if (ok && Object.keys(na).length > 0) {
      uitkomst.gewijzigd += 1;
      await logAudit('werknemer_gewijzigd', { entiteit: 'medewerker', entiteitId: w.id, details: { voor, na } });
    }
  }

  if (nieuweAfdelingen.length > 0) {
    await logAudit('afdeling_aangemaakt', { entiteit: 'organisatie', entiteitId: orgId, details: { namen: nieuweAfdelingen, via: 'werknemerslijst' } });
  }
  if (gemaakt.length > 0) {
    await logAudit('werknemers_toegevoegd', {
      entiteit: 'organisatie',
      entiteitId: orgId,
      details: { aantal: gemaakt.length, namen: gemaakt.slice(0, 50).map((g) => g.naam) },
    });
  }
  return uitkomst;
}

/** Korte terugmelding in gewone taal, voor bovenaan de volgende pagina. */
export function uitkomstTekst(u: OpslagUitkomst): string {
  const delen: string[] = [];
  if (u.aangemaakt > 0) delen.push(`${u.aangemaakt} ${u.aangemaakt === 1 ? 'werknemer' : 'werknemers'} toegevoegd`);
  if (u.afdelingenAangemaakt > 0) delen.push(`${u.afdelingenAangemaakt} nieuwe ${u.afdelingenAangemaakt === 1 ? 'afdeling' : 'afdelingen'} aangemaakt`);
  if (u.gewijzigd > 0) delen.push(`bij ${u.gewijzigd} de afdeling aangepast`);
  if (u.dubbel > 0) delen.push(`${u.dubbel} overgeslagen omdat ze er al stonden`);
  if (u.ongeldigeEmail > 0) delen.push(`${u.ongeldigeEmail} e-mailadres${u.ongeldigeEmail === 1 ? '' : 'sen'} niet herkend (weggelaten)`);
  if (u.mislukt > 0) delen.push(`${u.mislukt} niet gelukt, probeer die nog eens`);
  if (delen.length === 0) return 'Er was niets nieuws om op te slaan.';
  const zin = delen.join(', ');
  return zin.charAt(0).toUpperCase() + zin.slice(1) + '.';
}
