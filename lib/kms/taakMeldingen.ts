import { kmsAdmin } from '@/lib/kms/adminClient';
import { env, isEmailConfigured } from '@/lib/env';
import { sendEmail, emailLayout, escapeHtml } from '@/lib/email';
import { listTaakPersonen, type TaakPersoon } from '@/lib/kms/taakPersonen';
import { listTaakStatussen } from '@/lib/kms/taakStatussen';
import {
  takenV2Actief,
  leegPrullenbak,
  archiveerAfgerondeTaken,
  synchroniseerAutoTaken,
} from '@/lib/kms/taken';
import { KLEUR_HEX, schoneKleur } from '@/app/dashboard/taken/statusKleur';
import { nlDelen, plusDagen, maandagVan, datumLang, datumKort, tijdKort, tijdvak } from '@/app/dashboard/taken/tijd';

/**
 * E-mailmeldingen voor taken. Wordt elke 10 minuten aangeroepen door
 * /api/cron/taken (Supabase pg_cron + pg_net; zie de migratie 20261003_taken_v2).
 *
 * - Herinneringen: taken met herinnering_op <= nu die nog niet verstuurd zijn.
 * - Dagoverzicht om 07:00 (venster 07:00–07:29 Nederlandse tijd): vandaag, verlopen, morgen.
 * - Weekoverzicht op maandag 07:00: de hele week per dag. Wie het weekoverzicht
 *   krijgt, krijgt op maandag geen apart dagoverzicht (de week bevat vandaag al).
 * - Opruimen: prullenbak ouder dan 30 dagen weg, afgeronde taken na 14 dagen naar het archief.
 *
 * taak_meldingen_log voorkomt dubbel mailen: één dag- en weekoverzicht per persoon
 * per datum (unieke index), en herinneringen worden eerst "geclaimd" door
 * herinnering_verstuurd_op te zetten voordat de mail de deur uit gaat.
 *
 * Zonder Resend (isEmailConfigured false) wordt niets verstuurd en niets als
 * verstuurd gemarkeerd; het rapport zegt wat er verstuurd zou zijn.
 */

export type MeldingenRapport = {
  ok: boolean;
  fout?: string;
  moment: string;
  emailIngesteld: boolean;
  proef: boolean;
  herinneringen: { verstuurd: number; details: string[] };
  dagoverzicht: string[];
  weekoverzicht: string[];
  opgeruimd: { prullenbakVerwijderd: number; prullenbakGearchiveerd: number; afgerondGearchiveerd: number } | null;
  autotaken: { aangemaakt: number; afgerond: number } | null;
};

type MeldTaak = {
  id: string;
  titel: string;
  omschrijving: string | null;
  soort: string;
  status: string;
  werkstatus: string | null;
  vervaldatum: string | null;
  tijd: string | null;
  eind_tijd: string | null;
  locatie: string | null;
  persoon_id: string | null;
  herinnering_op: string | null;
  organisaties: { naam: string | null } | null;
};

const MELD_KOLOMMEN =
  'id, titel, omschrijving, soort, status, werkstatus, vervaldatum, tijd, eind_tijd, locatie, persoon_id, herinnering_op, organisaties(naam)';

function dashboardUrl(): string {
  return `${env.siteUrl.replace(/\/$/, '')}/dashboard/taken`;
}

/* ------------------------------------------------------------------ */
/* HTML-bouwstenen                                                     */
/* ------------------------------------------------------------------ */

type KleurOpzoek = (werkstatus: string | null) => { bg: string; tekst: string };

function knop(tekst: string, href: string): string {
  return `<p style="margin:24px 0 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background-color:#ec6726;color:#1c1c1c;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:8px;">${escapeHtml(tekst)}</a></p>`;
}

function kortTekst(s: string | null, max = 160): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function taakRegel(t: MeldTaak, kleur: KleurOpzoek, metDatum = false): string {
  const afspraak = t.soort === 'afspraak';
  const tijd = tijdKort(t.tijd);
  const eind = tijdKort(t.eind_tijd);
  const wanneer = metDatum
    ? tijdvak(t.vervaldatum, t.tijd, afspraak ? t.eind_tijd : null)
    : tijd
      ? afspraak && eind
        ? `${tijd}–${eind}`
        : tijd
      : afspraak
        ? 'Hele dag'
        : '';
  const k = kleur(t.werkstatus);
  const status = t.werkstatus
    ? `<span style="display:inline-block;background-color:${k.bg};color:${k.tekst};font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;">${escapeHtml(t.werkstatus)}</span>`
    : '';
  const label = afspraak
    ? `<span style="display:inline-block;background-color:#e0f2fe;color:#0c4a6e;font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;margin-right:6px;">AFSPRAAK</span>`
    : '';
  const klant = t.organisaties?.naam && t.organisaties.naam !== t.titel ? ` <span style="color:#52504e;">(${escapeHtml(t.organisaties.naam)})</span>` : '';
  const omschrijving = kortTekst(t.omschrijving);
  const locatie = afspraak && t.locatie ? `<div style="color:#52504e;font-size:13px;margin-top:2px;">Locatie: ${escapeHtml(t.locatie)}</div>` : '';
  return `<tr>
  <td valign="top" style="padding:10px 12px 10px 0;width:86px;border-bottom:1px solid #eeeceb;color:#1c1c1c;font-size:14px;font-weight:700;white-space:nowrap;">${escapeHtml(wanneer)}</td>
  <td valign="top" style="padding:10px 0;border-bottom:1px solid #eeeceb;font-size:14px;line-height:1.45;">
    <div>${label}<strong style="color:#1c1c1c;">${escapeHtml(t.titel)}</strong>${klant}</div>
    ${omschrijving ? `<div style="color:#52504e;margin-top:2px;">${escapeHtml(omschrijving)}</div>` : ''}
    ${locatie}
    ${status ? `<div style="margin-top:6px;">${status}</div>` : ''}
  </td>
</tr>`;
}

function blok(kop: string, taken: MeldTaak[], kleur: KleurOpzoek, opties: { kleurKop?: string; metDatum?: boolean; max?: number } = {}): string {
  if (taken.length === 0) return '';
  const max = opties.max ?? 25;
  const rest = taken.length - max;
  return `<h2 style="margin:26px 0 6px;font-size:16px;font-weight:800;color:${opties.kleurKop ?? '#1c1c1c'};">${escapeHtml(kop)} <span style="color:#828282;font-weight:600;">(${taken.length})</span></h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${taken
    .slice(0, max)
    .map((t) => taakRegel(t, kleur, opties.metDatum))
    .join('')}</table>${rest > 0 ? `<p style="margin:6px 0 0;color:#52504e;font-size:13px;">En nog ${rest} meer in het dashboard.</p>` : ''}`;
}

function sorteer(taken: MeldTaak[]): MeldTaak[] {
  return [...taken].sort((a, b) => {
    if (a.vervaldatum !== b.vervaldatum) return String(a.vervaldatum ?? '9999') < String(b.vervaldatum ?? '9999') ? -1 : 1;
    const ta = tijdKort(a.tijd);
    const tb = tijdKort(b.tijd);
    if (ta !== tb) return !ta ? -1 : !tb ? 1 : ta < tb ? -1 : 1;
    return a.titel.localeCompare(b.titel, 'nl');
  });
}

function telTekst(taken: MeldTaak[]): string {
  const afspraken = taken.filter((t) => t.soort === 'afspraak').length;
  const losse = taken.length - afspraken;
  const delen: string[] = [];
  if (afspraken) delen.push(`${afspraken} ${afspraken === 1 ? 'afspraak' : 'afspraken'}`);
  if (losse) delen.push(`${losse} ${losse === 1 ? 'taak' : 'taken'}`);
  return delen.join(' en ') || 'niets gepland';
}

export function bouwDagoverzicht(
  persoon: TaakPersoon,
  vandaag: string,
  taken: MeldTaak[],
  kleur: KleurOpzoek,
): { onderwerp: string; html: string; aantal: number } {
  const morgen = plusDagen(vandaag, 1);
  const vandaagLijst = sorteer(taken.filter((t) => t.vervaldatum === vandaag));
  const verlopen = sorteer(taken.filter((t) => t.vervaldatum && t.vervaldatum < vandaag));
  const morgenLijst = sorteer(taken.filter((t) => t.vervaldatum === morgen));
  const aantal = vandaagLijst.length + verlopen.length + morgenLijst.length;

  const intro = vandaagLijst.length
    ? `<p style="margin:0;">Vandaag staan er ${telTekst(vandaagLijst)} voor je klaar.${verlopen.length ? ` Er ${verlopen.length === 1 ? 'is' : 'zijn'} ook ${verlopen.length} verlopen.` : ''}</p>`
    : `<p style="margin:0;">Voor vandaag staat er niets gepland.${verlopen.length ? ` Wel ${verlopen.length === 1 ? 'is er 1 taak' : `zijn er ${verlopen.length} taken`} verlopen.` : ''}</p>`;

  const body = [
    intro,
    blok(`Vandaag, ${datumLang(vandaag)}`, vandaagLijst, kleur),
    blok('Verlopen', verlopen, kleur, { kleurKop: '#b91c1c', metDatum: true, max: 15 }),
    blok(`Morgen, ${datumLang(morgen)}`, morgenLijst, kleur),
    knop('Open je taken', dashboardUrl()),
    `<p style="margin:20px 0 0;color:#828282;font-size:12px;">Je krijgt deze mail elke ochtend om 7 uur. Uitzetten kan in het dashboard onder Taken → Instellingen.</p>`,
  ].join('');

  const onderwerp = vandaagLijst.length
    ? `Vandaag: ${telTekst(vandaagLijst)}${verlopen.length ? ` (${verlopen.length} verlopen)` : ''}`
    : `Vandaag niets gepland${verlopen.length ? `, ${verlopen.length} verlopen` : ''}`;
  return {
    onderwerp,
    aantal,
    html: emailLayout({ heading: `Goedemorgen ${persoon.naam}`, bodyHtml: body, preheader: onderwerp }),
  };
}

export function bouwWeekoverzicht(
  persoon: TaakPersoon,
  vandaag: string,
  taken: MeldTaak[],
  kleur: KleurOpzoek,
): { onderwerp: string; html: string; aantal: number } {
  const maandag = maandagVan(vandaag);
  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(maandag, i));
  const verlopen = sorteer(taken.filter((t) => t.vervaldatum && t.vervaldatum < maandag));
  const week = taken.filter((t) => t.vervaldatum && t.vervaldatum >= maandag && t.vervaldatum <= dagen[6]);
  const aantal = week.length + verlopen.length;

  const perDag = dagen
    .map((d) => {
      const lijst = sorteer(week.filter((t) => t.vervaldatum === d));
      if (lijst.length === 0) return '';
      const naam = datumLang(d);
      return blok(naam.charAt(0).toUpperCase() + naam.slice(1), lijst, kleur, { max: 30 });
    })
    .join('');

  const body = [
    `<p style="margin:0;">Deze week (${escapeHtml(datumKort(maandag))} t/m ${escapeHtml(datumKort(dagen[6]))}) staan er ${telTekst(week)} op je naam.${verlopen.length ? ` Daarnaast ${verlopen.length === 1 ? 'is er 1 taak' : `zijn er ${verlopen.length} taken`} verlopen.` : ''}</p>`,
    blok('Verlopen', verlopen, kleur, { kleurKop: '#b91c1c', metDatum: true, max: 15 }),
    perDag || '<p style="margin:20px 0 0;">Er staat deze week nog niets gepland.</p>',
    knop('Open de agenda', `${dashboardUrl()}?weergave=agenda`),
    `<p style="margin:20px 0 0;color:#828282;font-size:12px;">Je krijgt dit overzicht elke maandag om 7 uur. Uitzetten kan in het dashboard onder Taken → Instellingen.</p>`,
  ].join('');

  const onderwerp = `Je week: ${telTekst(week)}${verlopen.length ? ` (${verlopen.length} verlopen)` : ''}`;
  return {
    onderwerp,
    aantal,
    html: emailLayout({ heading: `Je week, ${persoon.naam}`, bodyHtml: body, preheader: onderwerp }),
  };
}

function bouwHerinnering(t: MeldTaak, vandaag: string): { onderwerp: string; html: string } {
  const afspraak = t.soort === 'afspraak';
  const wanneer = tijdvak(t.vervaldatum, t.tijd, afspraak ? t.eind_tijd : null, vandaag);
  const regels = [
    wanneer ? `<p style="margin:0;"><strong>${afspraak ? 'Wanneer' : 'Gepland'}:</strong> ${escapeHtml(wanneer)}</p>` : '',
    t.organisaties?.naam ? `<p style="margin:6px 0 0;"><strong>Klant:</strong> ${escapeHtml(t.organisaties.naam)}</p>` : '',
    afspraak && t.locatie ? `<p style="margin:6px 0 0;"><strong>Waar:</strong> ${escapeHtml(t.locatie)}</p>` : '',
    t.omschrijving
      ? `<p style="margin:14px 0 0;white-space:pre-line;">${escapeHtml(String(t.omschrijving).slice(0, 2000))}</p>`
      : '',
    knop(afspraak ? 'Bekijk de afspraak' : 'Bekijk de taak', dashboardUrl()),
  ].join('');
  const onderwerp = `${afspraak ? 'Afspraak' : 'Herinnering'}: ${t.titel}${wanneer ? ` (${wanneer})` : ''}`;
  return {
    onderwerp,
    html: emailLayout({ heading: afspraak ? `Afspraak: ${t.titel}` : `Niet vergeten: ${t.titel}`, bodyHtml: regels, preheader: onderwerp }),
  };
}

/* ------------------------------------------------------------------ */
/* Verwerken                                                           */
/* ------------------------------------------------------------------ */

function ontvangers(t: { persoon_id: string | null }, personen: TaakPersoon[]): TaakPersoon[] {
  const metMail = personen.filter((p) => p.actief && p.email);
  if (t.persoon_id) return metMail.filter((p) => p.id === t.persoon_id);
  return metMail.filter((p) => p.ook_zonder_persoon);
}

export async function verwerkTaakMeldingen(opties: { forceer?: 'dag' | 'week' | null; proef?: boolean; nu?: Date } = {}): Promise<MeldingenRapport> {
  const nu = opties.nu ?? new Date();
  const nl = nlDelen(nu);
  const proef = Boolean(opties.proef);
  const rapport: MeldingenRapport = {
    ok: true,
    moment: `${nl.datum} ${nl.tijd} (Europe/Amsterdam)`,
    emailIngesteld: isEmailConfigured,
    proef,
    herinneringen: { verstuurd: 0, details: [] },
    dagoverzicht: [],
    weekoverzicht: [],
    opgeruimd: null,
    autotaken: null,
  };

  const sb = kmsAdmin();
  if (!sb) return { ...rapport, ok: false, fout: 'Database niet ingesteld.' };
  if (!(await takenV2Actief())) return { ...rapport, ok: false, fout: 'Migratie 20261003_taken_v2 is nog niet gedraaid.' };

  const [personen, statussen] = await Promise.all([listTaakPersonen(), listTaakStatussen()]);
  const kleurPerStatus = new Map(statussen.map((s) => [s.naam, KLEUR_HEX[schoneKleur(s.kleur)]]));
  const kleur: KleurOpzoek = (w) => kleurPerStatus.get(w ?? '') ?? KLEUR_HEX.grijs;

  /* ---------- 0. Automatische taken ---------- */
  // Eén keer per uur de orders en portaalbestellingen omzetten, zodat nieuwe orders
  // ook in de ochtendmail staan als niemand de takenpagina heeft geopend.
  if (!proef && (nl.minuut < 10 || opties.forceer)) rapport.autotaken = await synchroniseerAutoTaken();

  /* ---------- 1. Herinneringen ---------- */
  {
    const { data, error } = await sb
      .from('taken')
      .select(MELD_KOLOMMEN)
      .is('herinnering_verstuurd_op', null)
      .lte('herinnering_op', nu.toISOString())
      .is('verwijderd_op', null)
      .is('gearchiveerd_op', null)
      .order('herinnering_op')
      .limit(100);
    if (error) rapport.herinneringen.details.push(`Ophalen mislukt: ${error.message}`);
    const grensOud = nu.getTime() - 24 * 3600_000;
    for (const t of ((data as unknown as MeldTaak[]) ?? [])) {
      const markeer = async () => {
        if (!proef) await sb.from('taken').update({ herinnering_verstuurd_op: nu.toISOString() }).eq('id', t.id);
      };
      if (t.status === 'klaar') {
        await markeer();
        rapport.herinneringen.details.push(`"${t.titel}": al afgerond, overgeslagen.`);
        continue;
      }
      if (t.herinnering_op && new Date(t.herinnering_op).getTime() < grensOud) {
        await markeer();
        rapport.herinneringen.details.push(`"${t.titel}": meer dan een dag oud, overgeslagen.`);
        continue;
      }
      const aan = ontvangers(t, personen);
      if (aan.length === 0) {
        await markeer();
        rapport.herinneringen.details.push(`"${t.titel}": geen persoon met e-mailadres, alleen in het dashboard.`);
        continue;
      }
      const lijst = aan.map((p) => p.email).join(', ');
      if (!isEmailConfigured || proef) {
        rapport.herinneringen.details.push(
          `"${t.titel}": zou naar ${lijst} gaan${!isEmailConfigured ? ' (e-mail niet ingesteld, niet verstuurd)' : ' (proef)'}.`,
        );
        continue;
      }
      // Claimen: alleen wie de kolom van leeg naar gevuld zet, mag versturen.
      const { data: geclaimd } = await sb
        .from('taken')
        .update({ herinnering_verstuurd_op: nu.toISOString() })
        .eq('id', t.id)
        .is('herinnering_verstuurd_op', null)
        .select('id');
      if (!geclaimd || geclaimd.length === 0) continue;
      const mail = bouwHerinnering(t, nl.datum);
      let gelukt = 0;
      for (const p of aan) {
        const res = await sendEmail({ to: String(p.email), subject: mail.onderwerp, html: mail.html });
        if (res.sent) {
          gelukt += 1;
          await sb.from('taak_meldingen_log').insert({ persoon_id: p.id, soort: 'herinnering', taak_id: t.id, datum: nl.datum, aantal: 1 });
        } else {
          rapport.herinneringen.details.push(`"${t.titel}" naar ${p.email} mislukt: ${res.error ?? 'onbekende fout'}`);
        }
      }
      if (gelukt === 0) {
        // Niets de deur uit: vrijgeven, de volgende ronde probeert het opnieuw.
        await sb.from('taken').update({ herinnering_verstuurd_op: null }).eq('id', t.id);
      } else {
        rapport.herinneringen.verstuurd += gelukt;
      }
    }
  }

  /* ---------- 2. Dag- en weekoverzicht ---------- */
  const inVenster = nl.uur === 7 && nl.minuut < 30;
  const doeWeek = opties.forceer === 'week' || (!opties.forceer && inVenster && nl.weekdag === 1);
  const doeDag = opties.forceer === 'dag' || (!opties.forceer && inVenster);
  if (doeDag || doeWeek) {
    const vandaag = nl.datum;
    const grens = doeWeek ? plusDagen(maandagVan(vandaag), 6) : plusDagen(vandaag, 1);
    const taken: MeldTaak[] = [];
    for (let van = 0; van < 10000; van += 1000) {
      const { data, error } = await sb
        .from('taken')
        .select(MELD_KOLOMMEN)
        .eq('status', 'open')
        .is('verwijderd_op', null)
        .is('gearchiveerd_op', null)
        .not('vervaldatum', 'is', null)
        .lte('vervaldatum', grens)
        .order('id')
        .range(van, van + 999);
      if (error) {
        rapport.dagoverzicht.push(`Ophalen mislukt: ${error.message}`);
        break;
      }
      taken.push(...((data as unknown as MeldTaak[]) ?? []));
      if (!data || data.length < 1000) break;
    }

    for (const p of personen.filter((x) => x.actief)) {
      const week = doeWeek && (p.weekoverzicht || opties.forceer === 'week');
      const dag = !week && doeDag && (p.dagoverzicht || opties.forceer === 'dag');
      if (!week && !dag) continue;
      const doel = week ? rapport.weekoverzicht : rapport.dagoverzicht;
      if (!p.email) {
        doel.push(`${p.naam}: geen e-mailadres ingesteld.`);
        continue;
      }
      const eigen = taken.filter((t) => (t.persoon_id ? t.persoon_id === p.id : p.ook_zonder_persoon));
      const mail = week ? bouwWeekoverzicht(p, vandaag, eigen, kleur) : bouwDagoverzicht(p, vandaag, eigen, kleur);
      const soort = week ? 'week' : 'dag';

      if (!isEmailConfigured || proef) {
        doel.push(`${p.naam}: "${mail.onderwerp}" naar ${p.email}${!isEmailConfigured ? ' (e-mail niet ingesteld, niet verstuurd)' : ' (proef)'}.`);
        continue;
      }
      // Claim in het log (unieke index per persoon + soort + datum). Bij forceren geen claim.
      let logId: string | null = null;
      if (!opties.forceer) {
        const { data: claim, error: claimFout } = await sb
          .from('taak_meldingen_log')
          .insert({ persoon_id: p.id, soort, datum: vandaag, aantal: mail.aantal })
          .select('id')
          .single();
        if (claimFout) {
          doel.push(`${p.naam}: ${claimFout.code === '23505' ? 'vandaag al verstuurd' : `log mislukt (${claimFout.message})`}.`);
          continue;
        }
        logId = (claim as { id: string }).id;
      }
      if (mail.aantal === 0 && soort === 'dag') {
        doel.push(`${p.naam}: niets gepland, geen mail.`);
        continue;
      }
      const res = await sendEmail({ to: p.email, subject: mail.onderwerp, html: mail.html });
      if (res.sent) {
        doel.push(`${p.naam}: verstuurd ("${mail.onderwerp}").`);
      } else {
        doel.push(`${p.naam}: versturen mislukt (${res.error ?? 'onbekende fout'}).`);
        if (logId) await sb.from('taak_meldingen_log').delete().eq('id', logId);
      }
    }
  }

  /* ---------- 3. Opruimen en automatische taken ---------- */
  if (!proef) {
    const [prullenbak, afgerond] = await Promise.all([leegPrullenbak(30), archiveerAfgerondeTaken(14)]);
    rapport.opgeruimd = {
      prullenbakVerwijderd: prullenbak.verwijderd,
      prullenbakGearchiveerd: prullenbak.gearchiveerd,
      afgerondGearchiveerd: afgerond,
    };
  }

  return rapport;
}
