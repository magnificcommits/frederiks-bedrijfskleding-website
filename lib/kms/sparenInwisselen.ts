import { kmsAdmin } from '@/lib/kms/adminClient';
import { sendEmail, emailLayout, escapeHtml } from '@/lib/email';
import { voegFactuurregelToe } from '@/lib/kms/facturen';
import { maakTaak } from '@/lib/kms/taken';
import { MIGRATIE_MELDING, getBeloning, getSpaarInstellingenUitgebreid, listRegels, loyaliteitActief, ontbreekt } from '@/lib/kms/sparenData';
import { berekenStanden, laadEnSynchroniseer } from '@/lib/kms/sparenGrootboek';
import { BELONING_SOORT_LABEL, niveauVoordelen, ronde2, type InwisselStatus } from '@/lib/kms/sparenTypes';

/**
 * Schrijfacties van het spaarprogramma: handmatig boeken, regels toekennen,
 * klanten aanbrengen en inwisselen (aanvragen, goedkeuren, verwerken).
 * Alleen server-side; de aanroeper regelt de toegang (dashAuthed of portaalrol).
 */

type Uitkomst = { ok: boolean; fout?: string; melding?: string };

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);

async function orgNaam(orgId: string): Promise<{ naam: string; email: string | null }> {
  const sb = kmsAdmin();
  if (!sb) return { naam: '', email: null };
  const { data } = await sb.from('organisaties').select('naam, email_algemeen, factuur_email').eq('id', orgId).maybeSingle();
  const r = data as { naam: string | null; email_algemeen: string | null; factuur_email: string | null } | null;
  return { naam: r?.naam ?? '', email: r?.email_algemeen || r?.factuur_email || null };
}

async function huidigSaldo(orgId: string) {
  const b = await laadEnSynchroniseer(orgId);
  return { bundel: b, stand: berekenStanden(b).find((s) => s.organisatieId === orgId) ?? null };
}

// ---------------------------------------------------------------------------
// Handmatig boeken
// ---------------------------------------------------------------------------

export async function boekHandmatig(input: {
  orgId: string;
  punten: number;
  reden: string;
  door: string;
  regelSoort?: string;
  regelId?: string | null;
  omschrijving?: string;
}): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  if (!(await loyaliteitActief())) return { ok: false, fout: MIGRATIE_MELDING };
  const punten = Math.round(input.punten);
  if (!input.orgId) return { ok: false, fout: 'Kies een klant.' };
  if (!Number.isFinite(punten) || punten === 0) return { ok: false, fout: 'Vul een aantal punten in, positief of negatief.' };
  if (!input.reden.trim()) return { ok: false, fout: 'Geef een reden op. Die zie je later terug in de historie.' };
  const { error } = await sb.from('spaar_mutaties').insert({
    organisatie_id: input.orgId,
    punten,
    soort: punten > 0 ? 'bij' : 'af',
    regel_id: input.regelId ?? null,
    regel_soort: input.regelSoort ?? 'handmatig',
    omschrijving: input.omschrijving?.trim() || (punten > 0 ? 'Handmatig bijgeboekt' : 'Handmatig afgeboekt'),
    reden: input.reden.trim().slice(0, 500),
    door: input.door,
    datum: new Date().toISOString(),
  });
  if (error) return { ok: false, fout: ontbreekt(error) ? MIGRATIE_MELDING : error.message };
  return { ok: true };
}

/** Een handmatige regel (review) toekennen: punten komen uit de regel. */
export async function kenRegelToe(orgId: string, regelId: string, notitie: string, door: string): Promise<Uitkomst> {
  const { regels } = await listRegels();
  const r = regels.find((x) => x.id === regelId);
  if (!r) return { ok: false, fout: 'Regel niet gevonden.' };
  if (!r.actief) return { ok: false, fout: `De regel "${r.naam}" staat uit. Zet hem eerst aan bij Regels.` };
  if (r.punten <= 0) return { ok: false, fout: 'Deze regel geeft geen punten. Vul eerst een aantal in.' };
  return boekHandmatig({
    orgId,
    punten: r.punten,
    reden: notitie.trim() || r.naam,
    door,
    regelSoort: r.soort,
    regelId: r.id,
    omschrijving: r.naam,
  });
}

// ---------------------------------------------------------------------------
// Klant aanbrengen
// ---------------------------------------------------------------------------

export async function registreerAanbrenging(input: {
  aanbrengerId: string;
  nieuweOrgId: string | null;
  nieuweNaam: string | null;
  direct: boolean;
  notitie: string | null;
  door: string;
}): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  if (!(await loyaliteitActief())) return { ok: false, fout: MIGRATIE_MELDING };
  if (!input.aanbrengerId) return { ok: false, fout: 'Kies de klant die het bedrijf aanbracht.' };
  if (!input.nieuweOrgId && !input.nieuweNaam?.trim()) return { ok: false, fout: 'Kies de nieuwe klant of vul de naam in.' };
  if (input.nieuweOrgId && input.nieuweOrgId === input.aanbrengerId) return { ok: false, fout: 'Een klant kan zichzelf niet aanbrengen.' };
  if (!input.direct && !input.nieuweOrgId) {
    return { ok: false, fout: 'Om te wachten op de eerste order moet de nieuwe klant in het systeem staan. Kies hem in de lijst, of beloon direct.' };
  }
  const { regels } = await listRegels();
  const regel = regels.find((r) => r.soort === 'aanbrengen' && r.actief);
  if (!regel) return { ok: false, fout: 'Zet eerst de regel "Klant aangebracht" aan bij Regels.' };

  const nieuweNaam = input.nieuweOrgId ? (await orgNaam(input.nieuweOrgId)).naam : input.nieuweNaam!.trim();
  const { data, error } = await sb
    .from('spaar_aanbrengingen')
    .insert({
      organisatie_id: input.aanbrengerId,
      nieuwe_organisatie_id: input.nieuweOrgId,
      nieuwe_naam: nieuweNaam,
      status: input.direct ? 'beloond' : 'wacht',
      punten: regel.punten,
      notitie: input.notitie?.trim() || null,
      door: input.door,
      beloond_op: input.direct ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error) return { ok: false, fout: ontbreekt(error) ? MIGRATIE_MELDING : error.message };
  const id = (data as { id: string }).id;
  if (input.direct && regel.punten > 0) {
    await sb.from('spaar_mutaties').insert({
      organisatie_id: input.aanbrengerId,
      punten: regel.punten,
      soort: 'bij',
      regel_id: regel.id,
      regel_soort: 'aanbrengen',
      sleutel: `aanbrengen:${id}`,
      omschrijving: `Klant aangebracht: ${nieuweNaam}`,
      reden: input.notitie?.trim() || null,
      door: input.door,
      datum: new Date().toISOString(),
      details: { aanbrenging_id: id, nieuwe_organisatie_id: input.nieuweOrgId },
    });
  }
  return {
    ok: true,
    melding: input.direct
      ? `${regel.punten} punten bijgeboekt.`
      : `Vastgelegd. De ${regel.punten} punten worden geboekt zodra ${nieuweNaam} de eerste order plaatst.`,
  };
}

export async function vervalAanbrenging(id: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const { error } = await sb.from('spaar_aanbrengingen').update({ status: 'vervallen' }).eq('id', id).eq('status', 'wacht');
  return !error;
}

// ---------------------------------------------------------------------------
// Inwisselen
// ---------------------------------------------------------------------------

export async function vraagInwisselingAan(input: {
  orgId: string;
  beloningId: string | null;
  punten?: number;
  bron: 'dashboard' | 'portaal';
  door: string;
  notitie?: string | null;
  /** Vanuit het dashboard mag Jessi meteen goedkeuren. */
  directGoedkeuren?: boolean;
}): Promise<Uitkomst & { id?: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  if (!input.orgId) return { ok: false, fout: 'Geen klant gekozen.' };
  const inst = await getSpaarInstellingenUitgebreid();
  const loyaliteit = await loyaliteitActief();
  if (!inst.actief && input.bron === 'portaal') return { ok: false, fout: 'Het spaarprogramma staat uit.' };

  const beloning = input.beloningId ? await getBeloning(input.beloningId) : null;
  if (input.beloningId && !beloning) return { ok: false, fout: 'Beloning niet gevonden.' };
  if (beloning && !beloning.actief) return { ok: false, fout: 'Deze beloning is niet meer beschikbaar.' };
  if (beloning && input.bron === 'portaal' && !beloning.inPortaal) return { ok: false, fout: 'Deze beloning kun je niet via het portaal aanvragen.' };
  if (beloning && beloning.voorraad != null && beloning.voorraad <= 0) return { ok: false, fout: 'Deze beloning is op.' };

  const punten = beloning ? beloning.puntenPrijs : Math.floor(Number(input.punten) || 0);
  if (!Number.isFinite(punten) || punten <= 0) return { ok: false, fout: 'Vul een positief aantal punten in.' };

  const { bundel, stand } = await huidigSaldo(input.orgId);
  const beschikbaar = stand ? stand.saldo : 0;
  if (punten > beschikbaar) {
    return { ok: false, fout: `Niet genoeg punten: ${beschikbaar.toLocaleString('nl-NL')} beschikbaar, ${punten.toLocaleString('nl-NL')} nodig.` };
  }
  if (beloning?.minNiveauId) {
    const nodig = bundel.niveaus.find((n) => n.id === beloning.minNiveauId);
    const huidig = stand?.niveau.huidig;
    if (nodig && (!huidig || huidig.drempel < nodig.drempel)) {
      return { ok: false, fout: `Deze beloning is vanaf niveau ${nodig.naam}.` };
    }
  }

  const kortingEuro = ronde2(beloning ? beloning.waardeEuro : punten * inst.euroPerPunt);
  const omschrijving = beloning ? beloning.naam : `${punten.toLocaleString('nl-NL')} punten ingewisseld voor ${euro(kortingEuro)} korting`;

  if (!loyaliteit) {
    if (input.bron === 'portaal') return { ok: false, fout: 'Aanvragen via het portaal kan nog niet.' };
    // Oude tabel zonder status: direct verwerkt, zoals vroeger.
    const { error } = await sb.from('spaar_inwisselingen').insert({ organisatie_id: input.orgId, punten, korting_euro: kortingEuro, omschrijving });
    return error ? { ok: false, fout: error.message } : { ok: true, melding: `${punten} punten ingewisseld.` };
  }

  const nu = new Date().toISOString();
  const status: InwisselStatus = input.directGoedkeuren ? 'goedgekeurd' : 'aangevraagd';
  const { data, error } = await sb
    .from('spaar_inwisselingen')
    .insert({
      organisatie_id: input.orgId,
      punten,
      korting_euro: kortingEuro,
      omschrijving,
      beloning_id: beloning?.id ?? null,
      beloning_naam: beloning?.naam ?? null,
      status,
      bron: input.bron,
      aangevraagd_door: input.door,
      notitie: input.notitie?.trim() || null,
      goedgekeurd_op: input.directGoedkeuren ? nu : null,
      behandeld_door: input.directGoedkeuren ? input.door : null,
    })
    .select('id')
    .single();
  if (error) return { ok: false, fout: ontbreekt(error) ? MIGRATIE_MELDING : error.message };
  const id = (data as { id: string }).id;
  if (beloning && beloning.voorraad != null) {
    await sb.from('spaar_beloningen').update({ voorraad: Math.max(0, beloning.voorraad - 1) }).eq('id', beloning.id);
  }

  if (input.bron === 'portaal') {
    const { naam } = await orgNaam(input.orgId);
    const html = emailLayout({
      heading: 'Nieuwe spaaraanvraag',
      preheader: `${naam} wil ${omschrijving} inwisselen`,
      bodyHtml: `<p><strong>${escapeHtml(naam)}</strong> heeft via het portaal een beloning aangevraagd.</p>
<p>Beloning: ${escapeHtml(omschrijving)}<br/>Punten: ${punten.toLocaleString('nl-NL')}<br/>Waarde: ${escapeHtml(euro(kortingEuro))}<br/>Aangevraagd door: ${escapeHtml(input.door)}</p>
${input.notitie ? `<p>Toelichting: ${escapeHtml(input.notitie)}</p>` : ''}
<p>Keur de aanvraag goed of af in het dashboard onder Sparen, Inwisselingen.</p>`,
    });
    // Mail is een extraatje: lukt het niet (Resend nog niet ingesteld), dan staat de aanvraag gewoon in het dashboard.
    await sendEmail({ to: inst.meldingEmail, subject: `Spaaraanvraag van ${naam}`, html }).catch(() => ({ sent: false }));
  } else if (input.directGoedkeuren) {
    await koppelOpvolging(id);
  }
  return { ok: true, id, melding: input.bron === 'portaal' ? 'Aanvraag verstuurd.' : 'Inwisseling vastgelegd.' };
}

/**
 * Na goedkeuring: korting in euro's op een open conceptfactuur zetten als die er
 * is; anders (of bij andere beloningen) een taak aanmaken zodat het niet vergeten wordt.
 */
async function koppelOpvolging(inwisselId: string, voorkeur: 'auto' | 'taak' | 'geen' = 'auto'): Promise<string> {
  const sb = kmsAdmin();
  if (!sb || voorkeur === 'geen') return '';
  const { data } = await sb.from('spaar_inwisselingen').select('*').eq('id', inwisselId).maybeSingle();
  const r = data as { id: string; organisatie_id: string; korting_euro: number; omschrijving: string | null; beloning_id: string | null; beloning_naam: string | null; punten: number } | null;
  if (!r) return '';
  const beloning = r.beloning_id ? await getBeloning(r.beloning_id) : null;
  const isKorting = !beloning || beloning.soort === 'korting_euro';
  const naam = r.beloning_naam || r.omschrijving || 'Spaarbeloning';
  const { naam: klant } = await orgNaam(r.organisatie_id);

  if (voorkeur === 'auto' && isKorting && Number(r.korting_euro) > 0) {
    const { data: fact } = await sb
      .from('facturen')
      .select('id, factuurnummer')
      .eq('organisatie_id', r.organisatie_id)
      .eq('status', 'concept')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const f = fact as { id: string; factuurnummer: string | null } | null;
    if (f) {
      const ok = await voegFactuurregelToe(f.id, {
        omschrijving: `Spaarkorting: ${naam} (${Number(r.punten).toLocaleString('nl-NL')} punten)`,
        aantal: 1,
        stukprijs: -Math.abs(Number(r.korting_euro)),
        btw_pct: 21,
      });
      if (ok) {
        await sb
          .from('spaar_inwisselingen')
          .update({ factuur_id: f.id, status: 'verwerkt', verwerkt_op: new Date().toISOString() })
          .eq('id', r.id);
        return `Korting staat op conceptfactuur${f.factuurnummer ? ` ${f.factuurnummer}` : ''}.`;
      }
    }
  }

  const soortLabel = beloning ? BELONING_SOORT_LABEL[beloning.soort] : 'Korting';
  const omschrijving = isKorting
    ? `${klant} heeft ${Number(r.punten).toLocaleString('nl-NL')} punten ingewisseld voor ${euro(Number(r.korting_euro))} korting. Neem dit mee als kortingsregel op de volgende factuur en zet de inwisseling daarna op verwerkt.`
    : `${klant} heeft ${Number(r.punten).toLocaleString('nl-NL')} punten ingewisseld voor: ${naam} (${soortLabel}). Regel dit met de klant en zet de inwisseling daarna op verwerkt.`;
  const taak = await maakTaak({
    titel: `Spaarbeloning: ${naam} voor ${klant}`.slice(0, 200),
    organisatie_id: r.organisatie_id,
    omschrijving,
  });
  if ('id' in taak) {
    await sb.from('spaar_inwisselingen').update({ taak_id: taak.id }).eq('id', r.id);
    return 'Er staat een taak klaar om dit te regelen.';
  }
  return '';
}

export async function zetInwisselStatus(
  id: string,
  status: InwisselStatus,
  opties: { door: string; reden?: string | null; opvolging?: 'auto' | 'taak' | 'geen'; mailKlant?: boolean },
): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  if (!(await loyaliteitActief())) return { ok: false, fout: MIGRATIE_MELDING };
  const { data } = await sb.from('spaar_inwisselingen').select('*').eq('id', id).maybeSingle();
  const r = data as {
    id: string;
    organisatie_id: string;
    status: string;
    punten: number;
    korting_euro: number;
    beloning_id: string | null;
    beloning_naam: string | null;
    omschrijving: string | null;
    aangevraagd_door: string | null;
  } | null;
  if (!r) return { ok: false, fout: 'Inwisseling niet gevonden.' };
  if (r.status === status) return { ok: true };
  if (r.status === 'afgewezen') return { ok: false, fout: 'Een afgewezen aanvraag kun je niet meer wijzigen. Maak een nieuwe aan.' };
  if (status === 'afgewezen' && r.status === 'verwerkt') return { ok: false, fout: 'Deze is al verwerkt. Boek de punten handmatig terug als dat nodig is.' };
  if (status === 'afgewezen' && !opties.reden?.trim()) return { ok: false, fout: 'Geef een reden op voor de afwijzing; de klant ziet die.' };

  const nu = new Date().toISOString();
  const update: Record<string, unknown> = { status, behandeld_door: opties.door };
  if (status === 'goedgekeurd') update.goedgekeurd_op = nu;
  if (status === 'verwerkt') {
    update.verwerkt_op = nu;
    if (r.status === 'aangevraagd') update.goedgekeurd_op = nu;
  }
  if (status === 'afgewezen') update.afgewezen_reden = opties.reden!.trim().slice(0, 500);
  const { error } = await sb.from('spaar_inwisselingen').update(update).eq('id', id);
  if (error) return { ok: false, fout: error.message };

  let melding = '';
  if (status === 'afgewezen' && r.beloning_id) {
    const b = await getBeloning(r.beloning_id);
    if (b && b.voorraad != null) await sb.from('spaar_beloningen').update({ voorraad: b.voorraad + 1 }).eq('id', b.id);
  }
  if (status === 'goedgekeurd') melding = await koppelOpvolging(id, opties.opvolging ?? 'auto');

  if (opties.mailKlant && (status === 'goedgekeurd' || status === 'afgewezen')) {
    const { naam, email } = await orgNaam(r.organisatie_id);
    const naar = r.aangevraagd_door && r.aangevraagd_door.includes('@') ? r.aangevraagd_door : email;
    if (naar) {
      const wat = r.beloning_naam || r.omschrijving || 'je spaarbeloning';
      const html = emailLayout({
        heading: status === 'goedgekeurd' ? 'Je spaarbeloning is goedgekeurd' : 'Over je spaaraanvraag',
        preheader: wat,
        bodyHtml:
          status === 'goedgekeurd'
            ? `<p>Goed nieuws voor ${escapeHtml(naam)}. Je aanvraag voor <strong>${escapeHtml(wat)}</strong> is goedgekeurd. Wij regelen de rest en laten het weten als het verwerkt is.</p><p>Groet, Jessi</p>`
            : `<p>Je aanvraag voor <strong>${escapeHtml(wat)}</strong> hebben we helaas niet goedgekeurd.</p><p>Reden: ${escapeHtml(opties.reden ?? '')}</p><p>De ${Number(r.punten).toLocaleString('nl-NL')} punten staan weer op jullie saldo. Vragen? Bel of mail ons gerust.</p><p>Groet, Jessi</p>`,
      });
      const m = await sendEmail({ to: naar, subject: status === 'goedgekeurd' ? 'Spaarbeloning goedgekeurd' : 'Over je spaaraanvraag', html }).catch(() => ({ sent: false }));
      melding += m.sent ? ' Klant is gemaild.' : ' Mail is niet verstuurd (e-mail nog niet ingesteld).';
    } else {
      melding += ' Geen e-mailadres bekend, klant niet gemaild.';
    }
  }
  return { ok: true, melding: melding.trim() };
}

// ---------------------------------------------------------------------------
// Saldo-overzicht mailen
// ---------------------------------------------------------------------------

export async function mailSpaaroverzicht(orgId: string): Promise<Uitkomst> {
  const { naam, email } = await orgNaam(orgId);
  if (!email) return { ok: false, fout: 'Deze klant heeft geen algemeen e-mailadres of factuuradres.' };
  const { stand, bundel } = await huidigSaldo(orgId);
  if (!stand) return { ok: false, fout: 'Klant niet gevonden.' };
  const nogTeGaan =
    bundel.instellingen.niveauBasis === 'punten'
      ? `${Math.ceil(stand.niveau.nogTeGaan).toLocaleString('nl-NL')} punten`
      : `${euro(stand.niveau.nogTeGaan)} aan bestellingen`;
  const voordelen = niveauVoordelen(stand.niveau.huidig);
  const html = emailLayout({
    heading: 'Jullie spaaroverzicht',
    preheader: `${stand.saldo.toLocaleString('nl-NL')} punten, ${euro(stand.euroWaarde)}`,
    bodyHtml: `<p>Hallo ${escapeHtml(naam)},</p>
<p>Jullie hebben op dit moment <strong>${stand.saldo.toLocaleString('nl-NL')} punten</strong> gespaard, goed voor ${escapeHtml(euro(stand.euroWaarde))}.</p>
${stand.niveau.huidig ? `<p>Niveau: <strong>${escapeHtml(stand.niveau.huidig.naam)}</strong>${voordelen.length ? `. Daarbij hoort: ${escapeHtml(voordelen.join(', '))}.` : '.'}</p>` : ''}
${stand.niveau.volgende ? `<p>Nog ${escapeHtml(nogTeGaan)} tot niveau ${escapeHtml(stand.niveau.volgende.naam)}.</p>` : ''}
${stand.vervaltBinnenkort > 0 && stand.vervaltOp ? `<p>Let op: ${stand.vervaltBinnenkort.toLocaleString('nl-NL')} punten vervallen op ${new Date(stand.vervaltOp).toLocaleDateString('nl-NL')} als je ze niet gebruikt.</p>` : ''}
<p>In het klantportaal zie je de beloningen en kun je ze aanvragen.</p><p>Groet, Jessi</p>`,
  });
  const m = await sendEmail({ to: email, subject: 'Jullie spaaroverzicht bij Frederiks', html }).catch(() => ({ sent: false, error: 'Mislukt' }));
  if (!m.sent) return { ok: false, fout: 'De mail is niet verstuurd: e-mail is nog niet ingesteld (Resend).' };
  return { ok: true, melding: `Overzicht gemaild naar ${email}.` };
}
