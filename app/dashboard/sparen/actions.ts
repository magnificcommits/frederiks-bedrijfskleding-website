'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, eisEigenaar, kmsAdmin } from '@/lib/kms/adminClient';
import { zetSpaarInstellingen, wisselPuntenIn } from '@/lib/kms/sparen';
import { logAudit, huidigeActor } from '@/lib/kms/audit';
import {
  maakRegel,
  slaBeloningOp,
  slaNiveauOp,
  verwijderBeloning,
  verwijderNiveau,
  verwijderRegel,
  werkRegelBij,
  zetInstellingen,
  zetRegelActief,
  type RegelInvoer,
} from '@/lib/kms/sparenData';
import { laadEnSynchroniseer } from '@/lib/kms/sparenGrootboek';
import {
  boekHandmatig,
  kenRegelToe,
  mailSpaaroverzicht,
  registreerAanbrenging,
  vervalAanbrenging,
  vraagInwisselingAan,
  zetInwisselStatus,
} from '@/lib/kms/sparenInwisselen';
import { BELONING_SOORTEN, INWISSEL_STATUSSEN, REGEL_SOORTEN, type BeloningSoort, type InwisselStatus, type RegelSoort } from '@/lib/kms/sparenTypes';

// ---------------------------------------------------------------------------
// Hulpjes
// ---------------------------------------------------------------------------

async function eis() {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
}

const tekst = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const getalOf = (fd: FormData, k: string, terug: number) => {
  const v = tekst(fd, k).replace(',', '.');
  if (v === '') return terug;
  const n = Number(v);
  return Number.isFinite(n) ? n : terug;
};
const getalOfNull = (fd: FormData, k: string) => {
  const v = tekst(fd, k).replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const datumOfNull = (fd: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(tekst(fd, k)) ? tekst(fd, k) : null);
const ja = (fd: FormData, k: string) => ['ja', 'aan', 'on', 'true', '1'].includes(tekst(fd, k));

/** Terug naar de pagina waar het formulier stond, met een melding. */
function terug(fd: FormData, standaard: string, params: { ok?: string; fout?: string; melding?: string }): never {
  const gevraagd = tekst(fd, 'terug');
  const pad = gevraagd.startsWith('/dashboard/sparen') ? gevraagd.split('?')[0] : standaard;
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
  revalidatePath('/dashboard/sparen', 'layout');
  redirect(q.toString() ? `${pad}?${q}` : pad);
}

// ---------------------------------------------------------------------------
// Bestaande acties (vorm ongewijzigd)
// ---------------------------------------------------------------------------

export async function zetSpaarInstellingenActie(formData: FormData) {
  await eis();
  const actief = String(formData.get('actief') ?? '') === 'aan';
  const puntenPerEuro = Number(String(formData.get('punten_per_euro') ?? '').replace(',', '.')) || 1;
  const euroPerPunt = Number(String(formData.get('euro_per_punt') ?? '').replace(',', '.')) || 0.01;
  await zetSpaarInstellingen({ actief, puntenPerEuro, euroPerPunt });
  await logAudit('spaarinstellingen_gewijzigd', { entiteit: 'instellingen' });
  redirect('/dashboard/sparen/instellingen?ok=opgeslagen');
}

export async function wisselPuntenInActie(formData: FormData) {
  await eis();
  const organisatieId = String(formData.get('organisatie_id') ?? '').trim();
  const punten = Math.floor(Number(String(formData.get('punten') ?? '').replace(',', '.')));
  const r = await wisselPuntenIn(organisatieId, punten);
  if (r.ok) {
    await logAudit('spaarpunten_ingewisseld', {
      entiteit: 'organisatie',
      entiteitId: organisatieId,
      details: { organisatie_id: organisatieId, punten },
    });
    redirect('/dashboard/sparen/inwisselingen?ok=toegevoegd');
  }
  redirect(`/dashboard/sparen/inwisselingen?fout=${encodeURIComponent(r.error ?? 'Mislukt')}`);
}

// ---------------------------------------------------------------------------
// Instellingen
// ---------------------------------------------------------------------------

export async function zetSparenInstellingenActie(fd: FormData) {
  await eis();
  const actief = ja(fd, 'actief');
  const euroPerPunt = Math.max(0, getalOf(fd, 'euro_per_punt', 0.01));
  const vervalMaanden = Math.max(0, Math.min(120, Math.floor(getalOf(fd, 'verval_maanden', 0))));
  const basis = tekst(fd, 'niveau_basis') === 'punten' ? 'punten' : 'omzet';
  const email = tekst(fd, 'melding_email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) terug(fd, '/dashboard/sparen/instellingen', { fout: 'Dat e-mailadres klopt niet.' });
  const ok = await zetInstellingen({
    spaar_actief: actief ? 'true' : 'false',
    spaar_euro_per_punt: String(euroPerPunt),
    spaar_vervaltermijn_maanden: String(vervalMaanden),
    spaar_niveau_basis: basis,
    spaar_portaal_aanvragen: ja(fd, 'portaal_aanvragen') ? 'true' : 'false',
    spaar_melding_email: email,
    spaar_voorwaarden: tekst(fd, 'voorwaarden').slice(0, 2000),
  });
  await logAudit('spaarinstellingen_gewijzigd', { entiteit: 'instellingen', details: { actief, euroPerPunt, vervalMaanden, basis } });
  terug(fd, '/dashboard/sparen/instellingen', ok ? { ok: 'opgeslagen' } : { fout: 'Opslaan is niet gelukt.' });
}

export async function synchroniseerActie(fd: FormData) {
  await eis();
  const voor = await laadEnSynchroniseer();
  await logAudit('spaarpunten_gesynchroniseerd', { entiteit: 'instellingen', details: { mutaties: voor.mutaties.length } });
  terug(fd, '/dashboard/sparen/instellingen', { melding: 'Alle automatische punten zijn bijgewerkt.' });
}

// ---------------------------------------------------------------------------
// Regels
// ---------------------------------------------------------------------------

function regelUitForm(fd: FormData): RegelInvoer | string {
  const soort = tekst(fd, 'soort') as RegelSoort;
  if (!(REGEL_SOORTEN as readonly string[]).includes(soort)) return 'Onbekende soort regel.';
  const naam = tekst(fd, 'naam');
  if (!naam) return 'Geef de regel een naam.';
  const v: RegelInvoer = {
    naam,
    soort,
    actief: ja(fd, 'actief'),
    punten: Math.round(getalOf(fd, 'punten', 0)),
    factor: getalOf(fd, 'factor', soort === 'periode_actie' ? 2 : 1),
    drempelEuro: getalOfNull(fd, 'drempel_euro'),
    maanden: getalOfNull(fd, 'maanden'),
    startDatum: datumOfNull(fd, 'start_datum'),
    eindDatum: datumOfNull(fd, 'eind_datum'),
    geldigVanaf: datumOfNull(fd, 'geldig_vanaf'),
    omschrijving: tekst(fd, 'omschrijving') || null,
  };
  if (soort === 'per_euro' && (v.factor <= 0 || v.factor > 100)) return 'Vul een aantal punten per euro in tussen 0 en 100.';
  if (soort === 'drempel_bonus' && (v.drempelEuro == null || v.drempelEuro <= 0)) return 'Vul het orderbedrag in waarboven de bonus geldt.';
  if (soort === 'nabestellen' && (!v.maanden || v.maanden <= 0)) return 'Vul in binnen hoeveel maanden er nabesteld moet worden.';
  if (soort === 'periode_actie') {
    if (!v.startDatum || !v.eindDatum) return 'Een actie heeft een begin- en einddatum.';
    if (v.eindDatum < v.startDatum) return 'De einddatum ligt voor de begindatum.';
    if (v.factor < 1) return 'De vermenigvuldiger is minimaal 1 (2 = dubbele punten).';
  }
  if (!['per_euro', 'periode_actie'].includes(soort) && v.punten <= 0) return 'Vul in hoeveel punten deze regel geeft.';
  return v;
}

export async function slaRegelOpActie(fd: FormData) {
  await eis();
  const id = tekst(fd, 'id');
  const v = regelUitForm(fd);
  if (typeof v === 'string') terug(fd, '/dashboard/sparen/regels', { fout: v });
  // Nieuwe regels gelden standaard vanaf vandaag, zodat er niets met terugwerkende kracht wordt toegekend.
  if (!id && !v.geldigVanaf && v.soort !== 'per_euro') v.geldigVanaf = new Date().toISOString().slice(0, 10);
  const r = id ? await werkRegelBij(id, v) : await maakRegel(v);
  if (!r.ok) terug(fd, '/dashboard/sparen/regels', { fout: r.fout });
  await logAudit(id ? 'spaarregel_gewijzigd' : 'spaarregel_aangemaakt', { entiteit: 'spaar_regel', entiteitId: id || undefined, details: { ...v } });
  terug(fd, '/dashboard/sparen/regels', { ok: id ? 'opgeslagen' : 'toegevoegd' });
}

export async function zetRegelActiefActie(fd: FormData) {
  await eis();
  const id = tekst(fd, 'id');
  const actief = ja(fd, 'actief');
  const ok = await zetRegelActief(id, actief);
  await logAudit('spaarregel_status', { entiteit: 'spaar_regel', entiteitId: id, details: { actief } });
  terug(fd, '/dashboard/sparen/regels', ok ? { ok: 'bijgewerkt' } : { fout: 'Wijzigen is niet gelukt.' });
}

export async function verwijderRegelActie(fd: FormData) {
  await eis();
  const id = tekst(fd, 'id');
  const r = await verwijderRegel(id);
  if (r.ok) await logAudit('spaarregel_verwijderd', { entiteit: 'spaar_regel', entiteitId: id });
  terug(fd, '/dashboard/sparen/regels', r.ok ? { ok: 'verwijderd' } : { fout: r.fout });
}

// ---------------------------------------------------------------------------
// Niveaus
// ---------------------------------------------------------------------------

export async function slaNiveauOpActie(fd: FormData) {
  await eis();
  const id = tekst(fd, 'id') || null;
  const naam = tekst(fd, 'naam');
  if (!naam) terug(fd, '/dashboard/sparen/niveaus', { fout: 'Geef het niveau een naam.' });
  const v = {
    naam,
    drempel: Math.max(0, getalOf(fd, 'drempel', 0)),
    kleur: tekst(fd, 'kleur') || null,
    kortingPct: getalOf(fd, 'korting_pct', 0),
    puntenFactor: 1 + Math.max(0, getalOf(fd, 'extra_punten_pct', 0)) / 100,
    gratisLogo: ja(fd, 'gratis_logo'),
    gratisPassen: ja(fd, 'gratis_passen'),
    voorrang: ja(fd, 'voorrang'),
    extraVoordelen: tekst(fd, 'extra_voordelen') || null,
  };
  const r = await slaNiveauOp(id, v);
  if (!r.ok) terug(fd, '/dashboard/sparen/niveaus', { fout: r.fout });
  await logAudit(id ? 'spaarniveau_gewijzigd' : 'spaarniveau_aangemaakt', { entiteit: 'spaar_niveau', entiteitId: id ?? undefined, details: v });
  terug(fd, '/dashboard/sparen/niveaus', { ok: id ? 'opgeslagen' : 'toegevoegd' });
}

export async function verwijderNiveauActie(fd: FormData) {
  await eis();
  const id = tekst(fd, 'id');
  const ok = await verwijderNiveau(id);
  if (ok) await logAudit('spaarniveau_verwijderd', { entiteit: 'spaar_niveau', entiteitId: id });
  terug(fd, '/dashboard/sparen/niveaus', ok ? { ok: 'verwijderd' } : { fout: 'Verwijderen is niet gelukt.' });
}

// ---------------------------------------------------------------------------
// Beloningen
// ---------------------------------------------------------------------------

export async function slaBeloningOpActie(fd: FormData) {
  await eis();
  const id = tekst(fd, 'id') || null;
  const naam = tekst(fd, 'naam');
  const soort = tekst(fd, 'soort') as BeloningSoort;
  const puntenPrijs = Math.round(getalOf(fd, 'punten_prijs', 0));
  if (!naam) terug(fd, '/dashboard/sparen/beloningen', { fout: 'Geef de beloning een naam.' });
  if (!(BELONING_SOORTEN as readonly string[]).includes(soort)) terug(fd, '/dashboard/sparen/beloningen', { fout: 'Kies een soort.' });
  if (puntenPrijs <= 0) terug(fd, '/dashboard/sparen/beloningen', { fout: 'Vul in hoeveel punten de beloning kost.' });
  const voorraad = getalOfNull(fd, 'voorraad');
  const v = {
    naam,
    soort,
    omschrijving: tekst(fd, 'omschrijving') || null,
    puntenPrijs,
    waardeEuro: Math.max(0, getalOf(fd, 'waarde_euro', 0)),
    minNiveauId: tekst(fd, 'min_niveau_id') || null,
    actief: ja(fd, 'actief'),
    inPortaal: ja(fd, 'in_portaal'),
    voorraad: voorraad == null ? null : Math.max(0, Math.floor(voorraad)),
  };
  const r = await slaBeloningOp(id, v);
  if (!r.ok) terug(fd, '/dashboard/sparen/beloningen', { fout: r.fout });
  await logAudit(id ? 'spaarbeloning_gewijzigd' : 'spaarbeloning_aangemaakt', { entiteit: 'spaar_beloning', entiteitId: id ?? undefined, details: v });
  terug(fd, '/dashboard/sparen/beloningen', { ok: id ? 'opgeslagen' : 'toegevoegd' });
}

export async function verwijderBeloningActie(fd: FormData) {
  await eis();
  const id = tekst(fd, 'id');
  const ok = await verwijderBeloning(id);
  if (ok) await logAudit('spaarbeloning_verwijderd', { entiteit: 'spaar_beloning', entiteitId: id });
  terug(fd, '/dashboard/sparen/beloningen', ok ? { ok: 'verwijderd' } : { fout: 'Verwijderen is niet gelukt.' });
}

// ---------------------------------------------------------------------------
// Klant: boeken, toekennen, aanbrengen, mailen
// ---------------------------------------------------------------------------

export async function boekHandmatigActie(fd: FormData) {
  await eis();
  const orgId = tekst(fd, 'organisatie_id');
  const aantal = Math.abs(Math.round(getalOf(fd, 'punten', 0)));
  const punten = tekst(fd, 'richting') === 'af' ? -aantal : aantal;
  const reden = tekst(fd, 'reden');
  const door = await huidigeActor();
  const r = await boekHandmatig({ orgId, punten, reden, door });
  if (!r.ok) terug(fd, `/dashboard/sparen/klanten/${orgId}`, { fout: r.fout });
  await logAudit('spaarpunten_handmatig', { entiteit: 'organisatie', entiteitId: orgId, details: { punten, reden } });
  terug(fd, `/dashboard/sparen/klanten/${orgId}`, { melding: `${punten > 0 ? '+' : ''}${punten} punten geboekt.` });
}

export async function kenRegelToeActie(fd: FormData) {
  await eis();
  const orgId = tekst(fd, 'organisatie_id');
  const regelId = tekst(fd, 'regel_id');
  const door = await huidigeActor();
  const r = await kenRegelToe(orgId, regelId, tekst(fd, 'notitie'), door);
  if (!r.ok) terug(fd, `/dashboard/sparen/klanten/${orgId}`, { fout: r.fout });
  await logAudit('spaarregel_toegekend', { entiteit: 'organisatie', entiteitId: orgId, details: { regel_id: regelId } });
  terug(fd, `/dashboard/sparen/klanten/${orgId}`, { melding: 'Punten toegekend.' });
}

export async function registreerAanbrengingActie(fd: FormData) {
  await eis();
  const aanbrengerId = tekst(fd, 'organisatie_id');
  const door = await huidigeActor();
  const r = await registreerAanbrenging({
    aanbrengerId,
    nieuweOrgId: tekst(fd, 'nieuwe_organisatie_id') || null,
    nieuweNaam: tekst(fd, 'nieuwe_naam') || null,
    direct: tekst(fd, 'moment') === 'direct',
    notitie: tekst(fd, 'notitie') || null,
    door,
  });
  if (!r.ok) terug(fd, '/dashboard/sparen/regels', { fout: r.fout });
  await logAudit('spaar_klant_aangebracht', { entiteit: 'organisatie', entiteitId: aanbrengerId, details: { nieuwe: tekst(fd, 'nieuwe_organisatie_id') || tekst(fd, 'nieuwe_naam') } });
  terug(fd, '/dashboard/sparen/regels', { melding: r.melding });
}

export async function vervalAanbrengingActie(fd: FormData) {
  await eis();
  const id = tekst(fd, 'id');
  const ok = await vervalAanbrenging(id);
  if (ok) await logAudit('spaar_aanbrenging_vervallen', { entiteit: 'spaar_aanbrenging', entiteitId: id });
  terug(fd, '/dashboard/sparen/regels', ok ? { ok: 'bijgewerkt' } : { fout: 'Wijzigen is niet gelukt.' });
}

export async function mailOverzichtActie(fd: FormData) {
  await eis();
  const orgId = tekst(fd, 'organisatie_id');
  const r = await mailSpaaroverzicht(orgId);
  if (r.ok) await logAudit('spaaroverzicht_gemaild', { entiteit: 'organisatie', entiteitId: orgId });
  terug(fd, `/dashboard/sparen/klanten/${orgId}`, r.ok ? { melding: r.melding } : { fout: r.fout });
}

/** Zet de vaste klantkorting gelijk aan de korting van het niveau. Bewuste klik van Jessi. */
export async function zetKlantkortingActie(fd: FormData) {
  await eis();
  const orgId = tekst(fd, 'organisatie_id');
  const pct = Math.min(100, Math.max(0, getalOf(fd, 'korting_pct', 0)));
  const sb = kmsAdmin();
  if (!sb) terug(fd, `/dashboard/sparen/klanten/${orgId}`, { fout: 'Database niet gekoppeld.' });
  const { data: oud } = await sb.from('organisaties').select('korting_pct').eq('id', orgId).maybeSingle();
  const { error } = await sb.from('organisaties').update({ korting_pct: pct }).eq('id', orgId);
  if (error) terug(fd, `/dashboard/sparen/klanten/${orgId}`, { fout: 'Klantkorting aanpassen is niet gelukt.' });
  await logAudit('klantkorting_via_spaarniveau', {
    entiteit: 'organisatie',
    entiteitId: orgId,
    details: { van: (oud as { korting_pct?: number } | null)?.korting_pct ?? null, naar: pct },
  });
  terug(fd, `/dashboard/sparen/klanten/${orgId}`, { melding: `Klantkorting staat nu op ${pct.toLocaleString('nl-NL')}%.` });
}

// ---------------------------------------------------------------------------
// Inwisselingen
// ---------------------------------------------------------------------------

export async function nieuweInwisselingActie(fd: FormData) {
  await eis();
  const orgId = tekst(fd, 'organisatie_id');
  const beloningId = tekst(fd, 'beloning_id') || null;
  const door = await huidigeActor();
  const r = await vraagInwisselingAan({
    orgId,
    beloningId,
    punten: Math.floor(getalOf(fd, 'punten', 0)),
    bron: 'dashboard',
    door,
    notitie: tekst(fd, 'notitie') || null,
    directGoedkeuren: true,
  });
  const standaard = tekst(fd, 'terug') || '/dashboard/sparen/inwisselingen';
  if (!r.ok) terug(fd, standaard, { fout: r.fout });
  await logAudit('spaarpunten_ingewisseld', { entiteit: 'organisatie', entiteitId: orgId, details: { beloning_id: beloningId, inwisseling_id: r.id } });
  terug(fd, standaard, { melding: r.melding });
}

export async function zetInwisselStatusActie(fd: FormData) {
  await eis();
  const id = tekst(fd, 'id');
  const status = tekst(fd, 'status') as InwisselStatus;
  if (!(INWISSEL_STATUSSEN as readonly string[]).includes(status)) terug(fd, '/dashboard/sparen/inwisselingen', { fout: 'Onbekende status.' });
  const opv = tekst(fd, 'opvolging');
  const door = await huidigeActor();
  const r = await zetInwisselStatus(id, status, {
    door,
    reden: tekst(fd, 'reden') || null,
    opvolging: opv === 'taak' || opv === 'geen' ? opv : 'auto',
    mailKlant: ja(fd, 'mail_klant'),
  });
  if (!r.ok) terug(fd, '/dashboard/sparen/inwisselingen', { fout: r.fout });
  await logAudit('spaarinwisseling_status', { entiteit: 'spaar_inwisseling', entiteitId: id, details: { status } });
  terug(fd, '/dashboard/sparen/inwisselingen', r.melding ? { melding: r.melding } : { ok: 'status' });
}

