'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import { uploadMediaMetNaam } from '@/lib/kms/storage';
import { logAudit } from '@/lib/kms/audit';
import {
  LOGO_TECHNIEKEN,
  WERKBON_STATUSSEN,
  bestandExtensie,
  getLogo,
  logoExtraBestanden,
  maakLogoMetId,
  meetBestand,
  productieSoort,
  verwijderLogo,
  volgOrderstatus,
  werkbonVoorOrder,
  werkLogoProductie,
  zetWerkbon,
  type BeeldMeta,
  type ExtraBestand,
  type LogoKleur,
  type LogoPositie,
  type ProductieSoort,
  type WerkbonStatus,
} from '@/lib/kms/logos';
import { veiligTerugPad } from '../drukproeven/terug';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tekst(fd: FormData, sleutel: string, max = 500): string {
  return String(fd.get(sleutel) ?? '').trim().slice(0, max);
}

function terugUit(fd: FormData): string | null {
  const v = fd.get('terug');
  return veiligTerugPad(typeof v === 'string' ? v : null);
}

/** Pad met één extra queryparameter, ook als het pad er al een paar heeft. */
function metParam(pad: string, sleutel: string, waarde: string): string {
  const [basis, qs = ''] = pad.split('?');
  const p = new URLSearchParams(qs);
  p.set(sleutel, waarde);
  return `${basis}?${p.toString()}`;
}

function detailPad(logoId: string, terug: string | null): string {
  return terug ? `/dashboard/logos/${logoId}?terug=${encodeURIComponent(terug)}` : `/dashboard/logos/${logoId}`;
}

function vernieuw(orgId?: string | null, logoId?: string | null) {
  revalidatePath('/dashboard/logos');
  if (logoId) revalidatePath(`/dashboard/logos/${logoId}`);
  if (orgId) revalidatePath(`/dashboard/klanten/${orgId}`);
}

/* ------------------------------------------------------------------------- */
/* Logo aanmaken en verwijderen                                               */
/* ------------------------------------------------------------------------- */

export async function nieuwLogo(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orgId = tekst(formData, 'orgId', 60);
  const naam = tekst(formData, 'naam', 160);
  const terug = terugUit(formData);
  const fout = (code: string) => redirect(metParam(terug ?? '/dashboard/logos?tab=bibliotheek', 'melding', code));

  // Eerst afkeuren, dan pas uploaden. Andersom staat het bestand al in de bucket
  // terwijl er nooit een rij komt die ernaar verwijst, en zulke wezen ruimt
  // niemand meer op.
  if (!UUID.test(orgId)) return fout('geen_klant');
  if (!naam) return fout('geen_naam');

  const logoBestand = formData.get('logo_bestand') as File | null;
  const vectorBestand = formData.get('vectorbestand') as File | null;
  const borduurBestand = formData.get('borduurbestand') as File | null;

  // Uploads geven naast de URL ook de originele bestandsnaam terug; die bewaren
  // we, want de opslagnaam in de bucket is gegenereerd en zegt Jessi niets.
  const [logoUpload, vectorUpload, borduurUpload, logoMeta] = await Promise.all([
    uploadMediaMetNaam(logoBestand, 'logos'),
    uploadMediaMetNaam(vectorBestand, 'logos'),
    uploadMediaMetNaam(borduurBestand, 'logos'),
    meetBestand(logoBestand),
  ]);

  const logo_bestand_url = logoUpload?.url ?? (tekst(formData, 'logo_bestand_url', 1000) || null);
  const vectorbestand_url = vectorUpload?.url ?? (tekst(formData, 'vectorbestand_url', 1000) || null);
  const borduurbestand_url = borduurUpload?.url ?? (tekst(formData, 'borduurbestand_url', 1000) || null);
  const opmerkingen = tekst(formData, 'opmerkingen', 2000) || null;
  const technieken = formData.getAll('technieken').map(String).filter((t) => (LOGO_TECHNIEKEN as readonly string[]).includes(t));

  const id = await maakLogoMetId(
    orgId,
    {
      naam,
      logo_bestand_url,
      vectorbestand_url,
      borduurbestand_url,
      logo_bestand_naam: logoUpload?.origineleNaam ?? null,
      vectorbestand_naam: vectorUpload?.origineleNaam ?? null,
      borduurbestand_naam: borduurUpload?.origineleNaam ?? null,
      opmerkingen,
    },
    {
      ...(technieken.length ? { technieken } : {}),
      ...(logoMeta ? { bestand_meta: { logo: logoMeta } } : {}),
    },
  );

  if (!id) return fout('mislukt');
  await logAudit('logo_toegevoegd', { entiteit: 'logo', entiteitId: id, details: { naam, organisatie_id: orgId } });
  vernieuw(orgId, id);
  // Vanaf de klantkaart terug daarheen; anders naar het logo zelf, waar Jessi
  // meteen kleuren en posities kan invullen.
  return redirect(terug ? metParam(terug, 'ok', 'toegevoegd') : `/dashboard/logos/${id}?ok=toegevoegd`);
}

export async function verwijderLogoActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orgId = tekst(formData, 'orgId', 60);
  const logoId = tekst(formData, 'logoId', 60);
  const terug = terugUit(formData);
  if (UUID.test(logoId)) {
    const logo = await getLogo(logoId);
    if (logo && (await verwijderLogo(logoId))) {
      await logAudit('logo_verwijderd', { entiteit: 'logo', entiteitId: logoId, details: { naam: logo.naam, organisatie_id: logo.organisatie_id } });
    }
  }
  vernieuw(orgId || null, null);
  return redirect(metParam(terug ?? '/dashboard/logos?tab=bibliotheek', 'ok', 'verwijderd'));
}

/* ------------------------------------------------------------------------- */
/* Logo-details: kleuren, posities, technieken, steken                        */
/* ------------------------------------------------------------------------- */

function getal(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? '').replace(',', '.').trim());
  return String(v ?? '').trim() && Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
}

function leesKleuren(fd: FormData): LogoKleur[] {
  const namen = fd.getAll('kleur_naam');
  const pantones = fd.getAll('kleur_pantone');
  const hexen = fd.getAll('kleur_hex');
  const uit: LogoKleur[] = [];
  for (let i = 0; i < Math.min(namen.length, 20); i++) {
    const naam = String(namen[i] ?? '').trim().slice(0, 60) || null;
    const pantone = String(pantones[i] ?? '').trim().slice(0, 40) || null;
    let hex = String(hexen[i] ?? '').trim().toLowerCase();
    if (hex && !hex.startsWith('#')) hex = `#${hex}`;
    if (/^#[0-9a-f]{3}$/.test(hex)) hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    const geldigeHex = /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
    if (naam || pantone || geldigeHex) uit.push({ naam, pantone, hex: geldigeHex });
  }
  return uit;
}

function leesPosities(fd: FormData): LogoPositie[] {
  const namen = fd.getAll('pos_naam');
  const breedtes = fd.getAll('pos_breedte');
  const hoogtes = fd.getAll('pos_hoogte');
  const uit: LogoPositie[] = [];
  for (let i = 0; i < Math.min(namen.length, 20); i++) {
    const positie = String(namen[i] ?? '').trim().slice(0, 80);
    if (!positie) continue;
    uit.push({ positie, breedte_cm: getal(breedtes[i] ?? null), hoogte_cm: getal(hoogtes[i] ?? null) });
  }
  return uit;
}

export async function werkLogoActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const logoId = tekst(formData, 'logoId', 60);
  const terug = terugUit(formData);
  if (!UUID.test(logoId)) redirect('/dashboard/logos?tab=bibliotheek');
  const logo = await getLogo(logoId);
  if (!logo) redirect('/dashboard/logos?tab=bibliotheek');

  const naam = tekst(formData, 'naam', 160);
  if (!naam) redirect(metParam(detailPad(logoId, terug), 'melding', 'geen_naam'));
  const opmerkingen = tekst(formData, 'opmerkingen', 2000) || null;
  const technieken = formData.getAll('technieken').map(String).filter((t) => (LOGO_TECHNIEKEN as readonly string[]).includes(t));
  const stekenRuw = Number(String(formData.get('steken') ?? '').replace(/[.\s]/g, ''));
  const steken = Number.isFinite(stekenRuw) && stekenRuw > 0 ? Math.min(Math.round(stekenRuw), 2_000_000) : null;
  const kleuren = leesKleuren(formData);
  const posities = leesPosities(formData);

  const uitkomst = await werkLogoProductie(logoId, { naam, opmerkingen }, { technieken, steken, kleuren, posities });
  if (uitkomst.ok) {
    await logAudit('logo_bijgewerkt', {
      entiteit: 'logo',
      entiteitId: logoId,
      details: { naam, kleuren: kleuren.length, posities: posities.length, technieken, steken, zonder_migratie: uitkomst.migratieNodig },
    });
  }
  vernieuw(logo.organisatie_id, logoId);
  if (!uitkomst.ok) redirect(metParam(detailPad(logoId, terug), 'melding', uitkomst.migratieNodig ? 'migratie' : 'mislukt'));
  redirect(metParam(detailPad(logoId, terug), uitkomst.migratieNodig ? 'melding' : 'ok', uitkomst.migratieNodig ? 'migratie' : 'opgeslagen'));
}

/* ------------------------------------------------------------------------- */
/* Bestanden bij een logo                                                     */
/* ------------------------------------------------------------------------- */

const VASTE_KOLOM: Record<'logo' | 'vector' | 'borduur', { url: string; naam: string }> = {
  logo: { url: 'logo_bestand_url', naam: 'logo_bestand_naam' },
  vector: { url: 'vectorbestand_url', naam: 'vectorbestand_naam' },
  borduur: { url: 'borduurbestand_url', naam: 'borduurbestand_naam' },
};

function vasteSleutel(soort: ProductieSoort): 'logo' | 'vector' | 'borduur' | null {
  if (soort === 'bitmap') return 'logo';
  if (soort === 'vector') return 'vector';
  if (soort === 'borduur') return 'borduur';
  return null;
}

/**
 * Voegt een bestand toe. Is de vaste plek voor dat soort bestand nog leeg
 * (logo, vector, borduur), dan komt het daar: die plekken gebruiken de werkbon
 * en de drukproef-editor. Anders gaat het in de lijst met extra bestanden.
 */
export async function voegBestandToeActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const logoId = tekst(formData, 'logoId', 60);
  const terug = terugUit(formData);
  if (!UUID.test(logoId)) redirect('/dashboard/logos?tab=bibliotheek');
  const logo = await getLogo(logoId);
  if (!logo) redirect('/dashboard/logos?tab=bibliotheek');
  const terugNaar = (sleutel: string, waarde: string) => redirect(metParam(detailPad(logoId, terug), sleutel, waarde));

  const file = formData.get('bestand') as File | null;
  const geplakt = tekst(formData, 'url', 1000);
  if ((!file || typeof file === 'string' || file.size === 0) && !/^https:\/\//i.test(geplakt)) return terugNaar('melding', 'geen_bestand');

  const upload = await uploadMediaMetNaam(file, 'logos');
  const url = upload?.url ?? (/^https:\/\//i.test(geplakt) ? geplakt : '');
  if (!url) return terugNaar('melding', 'mislukt');
  const naam = upload?.origineleNaam ?? null;
  const meta: BeeldMeta | null = upload ? await meetBestand(file) : null;

  const gekozen = tekst(formData, 'soort', 20);
  const soort: ProductieSoort = (['vector', 'bitmap', 'borduur', 'overig'] as string[]).includes(gekozen)
    ? (gekozen as ProductieSoort)
    : productieSoort(bestandExtensie(url, naam), 'overig');

  const vast = vasteSleutel(soort);
  const kolom = vast ? VASTE_KOLOM[vast] : null;
  const plekVrij = Boolean(kolom && !(logo as unknown as Record<string, string | null>)[kolom.url]);

  let uitkomst: { ok: boolean; migratieNodig: boolean };
  if (plekVrij && kolom && vast) {
    const huidigeMeta = logo.bestand_meta && typeof logo.bestand_meta === 'object' ? (logo.bestand_meta as Record<string, BeeldMeta | null>) : {};
    uitkomst = await werkLogoProductie(
      logoId,
      { [kolom.url]: url, [kolom.naam]: naam },
      meta ? { bestand_meta: { ...huidigeMeta, [vast]: meta } } : {},
    );
    // Zonder migratie lukt het bestand wel, alleen de meting niet: dat is geen fout.
    if (uitkomst.ok && uitkomst.migratieNodig && meta) uitkomst = { ok: true, migratieNodig: false };
  } else {
    const nieuw: ExtraBestand = {
      id: Math.random().toString(36).slice(2, 10),
      url,
      naam,
      soort,
      meta,
      toegevoegd_op: new Date().toISOString(),
    };
    uitkomst = await werkLogoProductie(logoId, {}, { bestanden: [...logoExtraBestanden(logo), nieuw] });
  }

  if (uitkomst.ok) {
    await logAudit('logo_bestand_toegevoegd', { entiteit: 'logo', entiteitId: logoId, details: { naam: naam ?? url, soort, plek: plekVrij ? vast : 'extra' } });
  }
  vernieuw(logo.organisatie_id, logoId);
  if (!uitkomst.ok) return terugNaar('melding', uitkomst.migratieNodig ? 'migratie_bestand' : 'mislukt');
  return terugNaar('ok', 'toegevoegd');
}

export async function verwijderBestandActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const logoId = tekst(formData, 'logoId', 60);
  const sleutel = tekst(formData, 'sleutel', 1000);
  const terug = terugUit(formData);
  if (!UUID.test(logoId)) redirect('/dashboard/logos?tab=bibliotheek');
  const logo = await getLogo(logoId);
  if (!logo) redirect('/dashboard/logos?tab=bibliotheek');

  let ok = false;
  if (sleutel === 'logo' || sleutel === 'vector' || sleutel === 'borduur') {
    const kolom = VASTE_KOLOM[sleutel];
    const huidigeMeta = logo.bestand_meta && typeof logo.bestand_meta === 'object' ? { ...(logo.bestand_meta as Record<string, unknown>) } : null;
    if (huidigeMeta) delete huidigeMeta[sleutel];
    const r = await werkLogoProductie(logoId, { [kolom.url]: null, [kolom.naam]: null }, huidigeMeta ? { bestand_meta: huidigeMeta as Record<string, BeeldMeta | null> } : {});
    ok = r.ok;
  } else {
    const rest = logoExtraBestanden(logo).filter((b) => b.id !== sleutel);
    ok = (await werkLogoProductie(logoId, {}, { bestanden: rest })).ok;
  }
  if (ok) await logAudit('logo_bestand_verwijderd', { entiteit: 'logo', entiteitId: logoId, details: { sleutel } });
  vernieuw(logo.organisatie_id, logoId);
  redirect(metParam(detailPad(logoId, terug), ok ? 'ok' : 'melding', ok ? 'verwijderd' : 'mislukt'));
}

/* ------------------------------------------------------------------------- */
/* Werkbonstatus (planning)                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Verschuift een werkbon in de planning. De orderstatus loopt mee: start de
 * productie, dan gaat de order naar bedrukken/borduren; klaar, dan naar
 * verpakken. Zonder tabel werkbonnen (migratie) lukt alleen dat laatste.
 */
export async function zetWerkbonStatusActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const orderId = tekst(formData, 'orderId', 60);
  const status = tekst(formData, 'status', 40) as WerkbonStatus;
  const terug = terugUit(formData) ?? '/dashboard/logos';
  if (!UUID.test(orderId) || !(WERKBON_STATUSSEN as readonly string[]).includes(status)) redirect(metParam(terug, 'melding', 'mislukt'));

  const { kaart } = await werkbonVoorOrder(orderId);
  if (!kaart) redirect(metParam(terug, 'melding', 'mislukt'));

  const opslag = await zetWerkbon(orderId, { status }, kaart.status);
  const order = await volgOrderstatus(orderId, status, kaart.technieken[0] ?? null);
  if (opslag.ok || order) {
    await logAudit('werkbon_status', {
      entiteit: 'order',
      entiteitId: orderId,
      details: { voor: { werkbon: kaart.status }, na: { werkbon: status }, ...(order ? { orderstatus: order } : {}), opgeslagen: opslag.ok },
    });
  }
  revalidatePath('/dashboard/logos');
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath(`/dashboard/orders/${orderId}/werkbon`);

  if (!opslag.ok && opslag.tabelOntbreekt) redirect(metParam(terug, 'melding', order ? 'werkbon_tabel_order' : 'werkbon_tabel'));
  if (!opslag.ok) redirect(metParam(terug, 'melding', 'mislukt'));
  if (order) redirect(metParam(terug, 'melding', `order_${order.naar}`));
  redirect(metParam(terug, 'ok', 'status'));
}
