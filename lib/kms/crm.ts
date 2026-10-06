import { kmsAdmin } from '@/lib/kms/adminClient';
import { metIdTerugval } from '@/lib/kms/kolomTerugval';

/**
 * Data-access voor het CRM rond de klantkaart: contactpersonen, activiteiten/opvolging
 * en een verkoopoverzicht. Alle queries via kmsAdmin() (service-role, omzeilt RLS).
 * Alleen server-side gebruiken, altijd achter dashAuthed().
 */

export const ACTIVITEIT_SOORTEN = ['notitie', 'telefoon', 'bezoek', 'offerte', 'mail'] as const;
export type ActiviteitSoort = (typeof ACTIVITEIT_SOORTEN)[number];

export type Contactpersoon = {
  id: string;
  organisatie_id: string;
  naam: string;
  functie: string | null;
  email: string | null;
  telefoon: string | null;
  mobiel: string | null;
  hoofdcontact: boolean;
  /** Dit is het facturatiecontact: zijn e-mailadres gaat op de factuur. Hoogstens één per klant. */
  facturatie: boolean;
  opmerkingen: string | null;
  created_at: string;
};

export type ContactpersoonVelden = {
  naam: string;
  functie?: string | null;
  email?: string | null;
  telefoon?: string | null;
  mobiel?: string | null;
  hoofdcontact?: boolean;
  facturatie?: boolean;
  opmerkingen?: string | null;
};

export type Activiteit = {
  id: string;
  organisatie_id: string;
  soort: string;
  omschrijving: string;
  datum: string;
  opvolgdatum: string | null;
  door: string | null;
  /** Collega (taak_personen) achter `door`; bestaat pas na migratie 20261004_persoon_verwijzingen. */
  door_persoon_id?: string | null;
  created_at: string;
};

export type ActiviteitVelden = {
  soort?: string;
  omschrijving: string;
  datum?: string | null;
  opvolgdatum?: string | null;
  door?: string | null;
  door_persoon_id?: string | null;
};

export type VerkoopOrder = { id: string; ordernummer: number | null; status: string; bedrag: number | null; besteldatum: string | null };
export type VerkoopFactuur = { id: string; factuurnummer: string | null; status: string; bedrag_incl: number | null; factuurdatum: string | null };
export type HerkomstLead = { id: string; name: string | null; bron: string | null; status: string | null };

export type KlantVerkoop = {
  orders: VerkoopOrder[];
  facturen: VerkoopFactuur[];
  omzetBetaald: number;
  herkomstLead: HerkomstLead | null;
};

// ---- Contactpersonen ----

export async function listContactpersonen(orgId: string): Promise<Contactpersoon[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('contactpersonen')
    .select('*')
    .eq('organisatie_id', orgId)
    .order('hoofdcontact', { ascending: false })
    .order('naam');
  return (data as Contactpersoon[]) ?? [];
}

export async function maakContactpersoon(orgId: string, v: ContactpersoonVelden): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  // Er mag maar één facturatiecontact zijn: de vorige gaat eerst uit.
  if (v.facturatie) await sb.from('contactpersonen').update({ facturatie: false }).eq('organisatie_id', orgId).eq('facturatie', true);
  const rij: Record<string, unknown> = {
    organisatie_id: orgId,
    naam: v.naam,
    functie: v.functie || null,
    email: v.email || null,
    telefoon: v.telefoon || null,
    mobiel: v.mobiel || null,
    hoofdcontact: v.hoofdcontact ?? false,
    opmerkingen: v.opmerkingen || null,
  };
  if (v.facturatie) rij.facturatie = true;
  const { data, error } = await sb.from('contactpersonen').insert(rij).select('id').single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/**
 * Contactpersoon bijwerken. Wordt hij facturatiecontact, dan gaat het vinkje
 * bij de vorige facturatiecontact van dezelfde klant eerst uit (er mag er maar
 * één zijn). Geeft voor/na terug met alleen de gewijzigde velden.
 */
export async function werkContactpersoon(
  id: string,
  v: Partial<ContactpersoonVelden>,
): Promise<{ ok: boolean; voor: Record<string, unknown>; na: Record<string, unknown> }> {
  const sb = kmsAdmin(); if (!sb) return { ok: false, voor: {}, na: {} };
  const { data } = await sb.from('contactpersonen').select('*').eq('id', id).maybeSingle();
  const huidig = data as Record<string, unknown> | null;
  if (!huidig) return { ok: false, voor: {}, na: {} };

  const gewenst: Record<string, unknown> = {};
  if (v.naam !== undefined && v.naam.trim()) gewenst.naam = v.naam.trim();
  if (v.functie !== undefined) gewenst.functie = v.functie || null;
  if (v.email !== undefined) gewenst.email = v.email || null;
  if (v.telefoon !== undefined) gewenst.telefoon = v.telefoon || null;
  if (v.mobiel !== undefined) gewenst.mobiel = v.mobiel || null;
  if (v.hoofdcontact !== undefined) gewenst.hoofdcontact = v.hoofdcontact;
  if (v.facturatie !== undefined) gewenst.facturatie = v.facturatie;
  if (v.opmerkingen !== undefined) gewenst.opmerkingen = v.opmerkingen || null;

  const voor: Record<string, unknown> = {};
  const na: Record<string, unknown> = {};
  for (const [sleutel, waarde] of Object.entries(gewenst)) {
    const oud = huidig[sleutel] ?? null;
    if (oud !== (waarde ?? null)) {
      voor[sleutel] = oud;
      na[sleutel] = waarde;
    }
  }
  if (Object.keys(na).length === 0) return { ok: true, voor, na };

  if (na.facturatie === true) {
    await sb
      .from('contactpersonen')
      .update({ facturatie: false })
      .eq('organisatie_id', String(huidig.organisatie_id))
      .eq('facturatie', true)
      .neq('id', id);
  }
  const { error } = await sb.from('contactpersonen').update(na).eq('id', id);
  return { ok: !error, voor, na };
}

/**
 * Alle branches die al bij klanten voorkomen, voor de suggestielijst bij het
 * invullen. Zo blijft de schrijfwijze gelijk en werkt het filter op de
 * klantenlijst.
 */
export async function listBranches(): Promise<string[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('organisaties').select('branche').not('branche', 'is', null).limit(5000);
  const set = new Set<string>();
  for (const r of (data as { branche: string | null }[]) ?? []) {
    const b = r.branche?.trim();
    if (b) set.add(b);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'nl'));
}

export async function verwijderContactpersoon(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('contactpersonen').delete().eq('id', id);
  return !error;
}

export type Hoofdcontact = {
  organisatie_id: string;
  naam: string;
  email: string;
};

/**
 * Per organisatie één contactpersoon mét e-mailadres, voor alle klanten tegelijk
 * in één query. Het hoofdcontact wint; heeft die geen adres (of is er geen
 * hoofdcontact aangevinkt), dan de eerste contactpersoon die er wel een heeft.
 *
 * Gebruikt door de nieuwsbrieflijst om te tonen dat er wél een adres bekend is
 * bij een klant zonder `email_algemeen`. Bewust alleen als suggestie: een
 * contactpersoon is een persoon die morgen weg kan zijn, `email_algemeen` is het
 * adres van het bedrijf. Die twee stilzwijgend gelijkstellen levert post op aan
 * mensen die er niet meer werken.
 */
export async function listHoofdcontacten(): Promise<Hoofdcontact[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('contactpersonen')
    .select('organisatie_id, naam, email, hoofdcontact')
    .order('naam');
  const rijen =
    (data as {
      organisatie_id: string | null;
      naam: string | null;
      email: string | null;
      hoofdcontact: boolean | null;
    }[]) ?? [];

  // Sorteren in JS: `order` op een boolean zet in Postgres de null-waarden vooraan
  // bij aflopend sorteren, en dan wint een rij zonder hoofdcontact-vinkje.
  const gesorteerd = [...rijen].sort(
    (a, b) => Number(b.hoofdcontact === true) - Number(a.hoofdcontact === true),
  );

  const perOrg = new Map<string, Hoofdcontact>();
  for (const r of gesorteerd) {
    const email = r.email?.trim();
    if (!r.organisatie_id || !email || perOrg.has(r.organisatie_id)) continue;
    perOrg.set(r.organisatie_id, {
      organisatie_id: r.organisatie_id,
      naam: r.naam?.trim() || 'Contactpersoon',
      email,
    });
  }
  return [...perOrg.values()];
}

// ---- Activiteiten / opvolging ----

export async function listActiviteiten(orgId: string): Promise<Activiteit[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('klant_activiteiten')
    .select('*')
    .eq('organisatie_id', orgId)
    .order('datum', { ascending: false })
    .order('created_at', { ascending: false });
  return (data as Activiteit[]) ?? [];
}

export async function maakActiviteit(orgId: string, v: ActiviteitVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const row: Record<string, unknown> = {
    organisatie_id: orgId,
    omschrijving: v.omschrijving,
  };
  if (v.soort) row.soort = v.soort;
  if (v.datum) row.datum = v.datum;
  if (v.opvolgdatum) row.opvolgdatum = v.opvolgdatum;
  if (v.door) row.door = v.door;
  if (v.door_persoon_id) row.door_persoon_id = v.door_persoon_id;
  const { error } = await metIdTerugval(row, ['door_persoon_id'], (r) => sb.from('klant_activiteiten').insert(r));
  return !error;
}

export async function verwijderActiviteit(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('klant_activiteiten').delete().eq('id', id);
  return !error;
}

// ---- Verkoopoverzicht ----

export async function getKlantVerkoop(orgId: string): Promise<KlantVerkoop> {
  const sb = kmsAdmin();
  if (!sb) return { orders: [], facturen: [], omzetBetaald: 0, herkomstLead: null };

  const [ordersRes, facturenRes, leadRes] = await Promise.all([
    sb
      .from('orders')
      .select('id, ordernummer, status, bedrag, besteldatum')
      .eq('organisatie_id', orgId)
      .order('besteldatum', { ascending: false }),
    sb
      .from('facturen')
      .select('id, factuurnummer, status, bedrag_incl, factuurdatum')
      .eq('organisatie_id', orgId)
      .order('factuurdatum', { ascending: false }),
    sb
      .from('leads')
      .select('id, name, bron, status')
      .eq('organisatie_id', orgId)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const orders = (ordersRes.data as VerkoopOrder[]) ?? [];
  const facturen = (facturenRes.data as VerkoopFactuur[]) ?? [];
  const omzetBetaald = facturen
    .filter((f) => f.status === 'betaald')
    .reduce((t, f) => t + (Number(f.bedrag_incl) || 0), 0);
  const herkomstLead = (leadRes.data as HerkomstLead | null) ?? null;

  return { orders, facturen, omzetBetaald, herkomstLead };
}

// ---- Portaaltoegang ----

export type PortaalUitkomst = 'toegevoegd' | 'bestond' | 'elders' | 'mislukt';

/**
 * Een e-mailadres toegang geven tot het klantportaal (rij in portaal_gebruikers),
 * net als E-mail koppelen op het tabblad Contact, maar zonder dubbele rijen:
 * - staat het adres al bij deze klant, dan gebeurt er niets ('bestond');
 * - staat het bij een andere klant, dan ook niet ('elders'): één inlog hoort bij
 *   één klant, anders weet het portaal niet welke klant het moet tonen.
 * Is er een werknemer bij, dan wordt die gekoppeld (medewerker_id).
 */
export async function geefPortaalToegang(
  orgId: string,
  email: string,
  naam: string | null,
  medewerkerId?: string | null,
  rol?: 'beheerder' | 'leidinggevende' | 'medewerker',
): Promise<PortaalUitkomst> {
  const sb = kmsAdmin(); if (!sb) return 'mislukt';
  const adres = email.trim().toLowerCase();
  if (!orgId || !adres.includes('@')) return 'mislukt';
  // ilike zonder jokertekens: % en _ in een adres letterlijk nemen.
  const patroon = adres.replace(/[\\%_]/g, (t) => `\\${t}`);
  const { data } = await sb.from('portaal_gebruikers').select('id, organisatie_id').ilike('email', patroon).limit(5);
  const bestaande = (data as { id: string; organisatie_id: string | null }[] | null) ?? [];
  if (bestaande.some((r) => r.organisatie_id === orgId)) return 'bestond';
  if (bestaande.length > 0) return 'elders';
  const rij: Record<string, unknown> = { organisatie_id: orgId, email: adres };
  if (naam?.trim()) rij.naam = naam.trim();
  if (medewerkerId) rij.medewerker_id = medewerkerId;
  // Zonder keuze is de database-standaard 'beheerder' (werkgever).
  if (rol) rij.rol = rol;
  const { error } = await sb.from('portaal_gebruikers').insert(rij);
  if (error) return 'mislukt';
  await zorgAuthGebruiker(adres);
  return 'toegevoegd';
}

/**
 * Uitnodiging voor het klantportaal. Zonder deze mail wist een nieuwe gebruiker
 * niet dat hij kon inloggen, of waar. Inloggen gaat met een link per mail: de
 * gebruiker vult op de inlogpagina zijn adres in en krijgt de link toegestuurd.
 * Best effort: false als mailen niet lukte (dan moet Jessi het zelf laten weten).
 */
/** Onderwerp en HTML van de uitnodiging. Los, zodat het KMS hem als voorbeeld kan tonen. */
export async function portaalUitnodigingMail(email: string, naam: string | null, klant: string | null): Promise<{ subject: string; html: string; inlog: string }> {
  const [{ emailLayout, escapeHtml }, { site }, { appUrl }] = await Promise.all([import('@/lib/email'), import('@/content/site'), import('@/lib/appUrl')]);
  const inlog = `${appUrl()}/portaal/login`;
  return {
    inlog,
    subject: `Je toegang tot het klantportaal${klant ? ` van ${klant}` : ''} bij Frederiks Bedrijfskleding`,
    html: emailLayout({
      heading: 'Welkom in het klantportaal',
      preheader: 'Je kunt nu inloggen in het klantportaal van Frederiks Bedrijfskleding.',
      bodyHtml: `
        <p style="margin:0;">${naam ? `Hallo ${escapeHtml(naam)},` : 'Hallo,'}</p>
        <p style="margin:14px 0 0;">Je hebt toegang gekregen tot het klantportaal van Frederiks Bedrijfskleding${klant ? ` voor <strong>${escapeHtml(klant)}</strong>` : ''}. Daar bestel je kleding binnen je budget, volg je bestellingen en keur je drukproeven goed.</p>
        <p style="margin:22px 0;"><a href="${escapeHtml(inlog)}" style="display:inline-block;background:#f06a20;color:#111;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;">Naar het portaal</a></p>
        <p style="margin:0;"><strong>Zo log je in:</strong></p>
        <ol style="margin:6px 0 0;padding-left:20px;">
          <li>Vul op de inlogpagina dit e-mailadres in: <strong>${escapeHtml(email)}</strong>.</li>
          <li>Je krijgt direct een mail met een inloglink en een code.</li>
          <li>Klik op de link, of typ de code over. Een wachtwoord is niet nodig.</li>
        </ol>
        <p style="margin:14px 0 0;">Tip: zet het portaal op je telefoon als app, dan staat het met één tik op je beginscherm.</p>
        <p style="margin:14px 0 0;">Vragen? Bel of app gerust: <strong>${escapeHtml(site.phone)}</strong>.</p>
      `,
    }),
  };
}

/**
 * Stuurt de uitnodiging en legt vast of dat lukte (audit_log, per klant), zodat het
 * KMS per persoon kan tonen of en wanneer hij is uitgenodigd.
 */
export async function stuurPortaalUitnodiging(email: string, naam: string | null, orgId: string, door?: string): Promise<boolean> {
  const [{ sendEmail }, { site }, { logAudit }] = await Promise.all([import('@/lib/email'), import('@/content/site'), import('@/lib/kms/audit')]);
  const sb = kmsAdmin();
  const { data } = sb ? await sb.from('organisaties').select('naam').eq('id', orgId).maybeSingle() : { data: null };
  const klant = (data as { naam: string | null } | null)?.naam ?? null;
  const mail = await portaalUitnodigingMail(email, naam, klant);
  const res = await sendEmail({ to: email, replyTo: site.email, subject: mail.subject, html: mail.html }).catch((e: unknown) => ({ sent: false, error: String(e) }));
  await logAudit(res.sent ? 'portaal_uitnodiging_verstuurd' : 'portaal_uitnodiging_mislukt', {
    entiteit: 'organisatie',
    entiteitId: orgId,
    details: { email: email.toLowerCase(), fout: res.sent ? null : (res as { error?: string }).error ?? null },
    ...(door ? { actor: door } : {}),
  });
  return res.sent;
}

/**
 * Zorgt dat er een Supabase-account bestaat voor dit adres. Het inlogscherm maakt zelf
 * geen accounts meer aan (shouldCreateUser: false), dus wie toegang krijgt, krijgt hier
 * meteen een (bevestigd) account. Bestaat het al, dan gebeurt er niets.
 */
export async function zorgAuthGebruiker(email: string): Promise<void> {
  const sb = kmsAdmin();
  const adres = email.trim().toLowerCase();
  if (!sb || !adres.includes('@')) return;
  await sb.auth.admin.createUser({ email: adres, email_confirm: true }).catch(() => undefined);
}

export type PortaalActiviteit = { id: string; actor: string | null; actie: string; details: Record<string, unknown> | null; created_at: string };

/** Wat er rond het portaal van deze klant is gebeurd: uitnodigingen, toegang, bestellingen, goedkeuringen. */
export async function portaalActiviteit(orgId: string, limiet = 40): Promise<PortaalActiviteit[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('audit_log')
    .select('id, actor, actie, details, created_at')
    .eq('entiteit', 'organisatie')
    .eq('entiteit_id', orgId)
    .or('actie.like.portaal%,actie.like.portaalgebruiker%')
    .order('created_at', { ascending: false })
    .limit(limiet);
  return (data as PortaalActiviteit[] | null) ?? [];
}

/**
 * Laatste inlog per e-mailadres, uit Supabase Auth. Null = nog nooit ingelogd.
 * Leest maximaal 10 pagina's van 1000 gebruikers; ruim genoeg voor het portaal.
 */
export async function laatsteLogins(emails: string[]): Promise<Record<string, string | null>> {
  const sb = kmsAdmin();
  const gezocht = new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean));
  const uit: Record<string, string | null> = {};
  if (!sb || gezocht.size === 0) return uit;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) {
      const e = u.email?.toLowerCase();
      if (e && gezocht.has(e)) uit[e] = u.last_sign_in_at ?? null;
    }
    if (data.users.length < 1000) break;
  }
  return uit;
}

export type PortaalKlantRij = {
  orgId: string;
  naam: string;
  isDemo: boolean;
  werkgevers: number;
  leidinggevenden: number;
  werknemers: number;
  logins: number;
  ooitIngelogd: number;
  laatsteLogin: string | null;
  actiesMaand: number;
  medewerkersInSysteem: number;
};

/**
 * Per klant met portaaltoegang: hoeveel logins per rol, hoeveel daarvan ooit inlogden,
 * de laatste inlog en het aantal handelingen in de laatste 30 dagen.
 */
export async function portaalOverzicht(): Promise<PortaalKlantRij[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const sinds = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: pg }, { data: acties }] = await Promise.all([
    sb.from('portaal_gebruikers').select('organisatie_id, email, rol').limit(5000),
    sb.from('audit_log').select('entiteit_id, actie').eq('entiteit', 'organisatie').like('actie', 'portaal\\_%').gte('created_at', sinds).limit(10000),
  ]);
  const gebruikers = (pg as { organisatie_id: string | null; email: string; rol: string }[] | null) ?? [];
  const orgIds = [...new Set(gebruikers.map((g) => g.organisatie_id).filter((v): v is string => Boolean(v)))];
  if (orgIds.length === 0) return [];
  const [{ data: orgs }, { data: mws }, logins] = await Promise.all([
    sb.from('organisaties').select('id, naam, is_demo').in('id', orgIds),
    sb.from('medewerkers').select('organisatie_id').in('organisatie_id', orgIds).eq('actief', true).limit(20000),
    laatsteLogins(gebruikers.map((g) => g.email)),
  ]);
  const mwTelling = new Map<string, number>();
  for (const m of (mws as { organisatie_id: string }[] | null) ?? []) mwTelling.set(m.organisatie_id, (mwTelling.get(m.organisatie_id) ?? 0) + 1);
  const actieTelling = new Map<string, number>();
  for (const a of (acties as { entiteit_id: string | null; actie: string }[] | null) ?? []) {
    if (a.entiteit_id && !a.actie.startsWith('portaal_uitnodiging')) actieTelling.set(a.entiteit_id, (actieTelling.get(a.entiteit_id) ?? 0) + 1);
  }
  return ((orgs as { id: string; naam: string; is_demo: boolean | null }[] | null) ?? []).map((o) => {
    const eigen = gebruikers.filter((g) => g.organisatie_id === o.id);
    const datums = eigen.map((g) => logins[g.email.toLowerCase()]).filter((d): d is string => Boolean(d));
    return {
      orgId: o.id,
      naam: o.naam,
      isDemo: Boolean(o.is_demo),
      werkgevers: eigen.filter((g) => g.rol === 'beheerder').length,
      leidinggevenden: eigen.filter((g) => g.rol === 'leidinggevende').length,
      werknemers: eigen.filter((g) => g.rol === 'medewerker').length,
      logins: eigen.length,
      ooitIngelogd: datums.length,
      laatsteLogin: datums.sort().at(-1) ?? null,
      actiesMaand: actieTelling.get(o.id) ?? 0,
      medewerkersInSysteem: mwTelling.get(o.id) ?? 0,
    };
  }).sort((a, b) => (b.laatsteLogin ?? '').localeCompare(a.laatsteLogin ?? '') || a.naam.localeCompare(b.naam, 'nl'));
}
