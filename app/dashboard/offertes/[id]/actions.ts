'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed } from '@/lib/kms/adminClient';
import {
  werkOfferte,
  zetOfferteStatus,
  verwijderOfferte,
  voegRegelToe,
  werkRegel,
  verwijderRegel,
  maakOrderVanOfferteMetUitkomst,
  isOfferteStatus,
  voegPakketAlsRegels,
  getOfferte,
  getRegel,
  bepaalOfferteContact,
  listOfferteArtikelen,
  listOfferteKleuren,
  type OfferteArtikel,
  type OfferteKleur,
} from '@/lib/kms/offertes';
import { logAudit } from '@/lib/kms/audit';
import { sendEmail } from '@/lib/email';
import { offerteMailHtml } from '@/lib/documentMail';
import { headers } from 'next/headers';
import { voorwaardenPdfBase64, VOORWAARDEN_BESTANDSNAAM } from '@/lib/voorwaardenBijlage';
import { offerteAkkoordToken } from '@/lib/kms/offerteAkkoord';
import { site } from '@/content/site';

/**
 * Bedrag of aantal uit een invoerveld. Nederlandse notatie: staat er een komma,
 * dan is dat het decimaalteken en zijn punten duizendtallen (1.234,50).
 * Onleesbare invoer wordt 0 in plaats van NaN.
 */
function getalOfNul(raw: string): number {
  const schoon = raw.replace(/[^0-9.,-]/g, '').trim();
  if (schoon === '') return 0;
  const genormaliseerd = schoon.includes(',') ? schoon.replace(/\./g, '').replace(',', '.') : schoon;
  const getal = Number(genormaliseerd);
  return Number.isFinite(getal) ? getal : 0;
}

/** Artikelen voor de regelkiezer; assortiment van de klant eerst. Vanuit de browser aangeroepen. */
export async function haalArtikelenActie(organisatieId: string | null): Promise<OfferteArtikel[]> {
  if (!(await dashAuthed())) return [];
  return listOfferteArtikelen(organisatieId ? String(organisatieId) : null);
}

/** Kleuren (met foto en maten) van één artikel, zodra het in de kiezer gekozen is. */
export async function haalKleurenActie(productId: string): Promise<OfferteKleur[]> {
  if (!(await dashAuthed())) return [];
  return listOfferteKleuren(String(productId ?? ''));
}

export async function werkOfferteActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('offerteId') ?? '').trim();
  if (!id) redirect('/dashboard/offertes');
  const organisatie_id = String(formData.get('organisatie_id') ?? '').trim();
  const contactId = String(formData.get('contactpersoon_id') ?? '').trim();
  const losseNaam = String(formData.get('contactpersoon') ?? '').trim();
  const geldig_tot = String(formData.get('geldig_tot') ?? '').trim();
  const notitie = String(formData.get('notitie') ?? '').trim();
  const btwRuw = String(formData.get('btw_pct') ?? '').trim();
  const btw_pct = btwRuw === '' ? 21 : getalOfNul(btwRuw);
  // Naam en verwijzing komen uit de gekozen contactpersoon van de klant.
  const contact = await bepaalOfferteContact(organisatie_id || null, contactId || null, losseNaam || null);
  const nieuw = {
    organisatie_id: organisatie_id || null,
    contactpersoon: contact.contactpersoon,
    contactpersoon_id: contact.contactpersoon_id,
    geldig_tot: geldig_tot || null,
    notitie: notitie || null,
    btw_pct,
  };
  const oud = await getOfferte(id);
  await werkOfferte(id, nieuw);
  const voor: Record<string, unknown> = {};
  const na: Record<string, unknown> = {};
  if (oud) {
    for (const [k, v] of Object.entries(nieuw)) {
      // Zonder migratie bestaat de kolom niet en is er niets opgeslagen om te loggen.
      if (k === 'contactpersoon_id' && !('contactpersoon_id' in oud)) continue;
      const was = (oud as unknown as Record<string, unknown>)[k] ?? null;
      const gelijk = k === 'geldig_tot' ? String(was ?? '').slice(0, 10) === String(v ?? '') : String(was ?? '') === String(v ?? '');
      if (!gelijk) {
        voor[k] = was;
        na[k] = v;
      }
    }
  }
  await logAudit('offerte_gewijzigd', { entiteit: 'offertes', entiteitId: id, details: { voor, na } });
  redirect('/dashboard/offertes/' + id + '?ok=opgeslagen');
}

export async function wijzigStatusActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('offerteId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!id) redirect('/dashboard/offertes');
  if (!isOfferteStatus(status)) redirect('/dashboard/offertes/' + id + '?fout=status');
  const ok = await zetOfferteStatus(id, status);
  if (!ok) redirect('/dashboard/offertes/' + id + '?fout=status');
  await logAudit('offerte_status_gewijzigd', { entiteit: 'offertes', entiteitId: id, details: { status } });
  // Akkoord van de klant: de volgende stap is de order. Die maakt de knop
  // "Omzetten naar order"; de melding wijst Jessi erop.
  redirect('/dashboard/offertes/' + id + (status === 'geaccepteerd' ? '?ok=akkoord' : '?ok=status'));
}

export async function verwijderOfferteActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('offerteId') ?? '').trim();
  if (id) {
    await verwijderOfferte(id);
    await logAudit('offerte_verwijderd', { entiteit: 'offertes', entiteitId: id });
  }
  redirect('/dashboard/offertes');
}

export async function voegRegelActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const offerteId = String(formData.get('offerteId') ?? '').trim();
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const aantal = getalOfNul(String(formData.get('aantal') ?? '1'));
  const stukprijs = getalOfNul(String(formData.get('stukprijs') ?? ''));
  const korting_pct = getalOfNul(String(formData.get('korting_pct') ?? '0'));
  const inkoopRuw = String(formData.get('inkoop') ?? '').trim();
  const inkoop = inkoopRuw === '' ? null : getalOfNul(inkoopRuw);
  const product_id = String(formData.get('product_id') ?? '').trim() || null;
  const kleur = String(formData.get('kleur') ?? '').trim() || null;
  const maat = String(formData.get('maat') ?? '').trim() || null;
  if (!offerteId) redirect('/dashboard/offertes');
  if (aantal < 0) redirect('/dashboard/offertes/' + offerteId + '?fout=aantal');
  if (korting_pct < 0 || korting_pct > 100) redirect('/dashboard/offertes/' + offerteId + '?fout=korting');
  if (omschrijving) {
    await voegRegelToe(offerteId, { omschrijving, aantal, stukprijs, korting_pct, inkoop, product_id, kleur, maat });
    await logAudit('offerteregel_toegevoegd', {
      entiteit: 'offertes',
      entiteitId: offerteId,
      details: { omschrijving, aantal, stukprijs, korting_pct, ...(product_id ? { product_id, kleur, maat } : {}) },
    });
  }
  redirect('/dashboard/offertes/' + offerteId + '?ok=toegevoegd');
}

export async function werkRegelActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const offerteId = String(formData.get('offerteId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const aantal = getalOfNul(String(formData.get('aantal') ?? '1'));
  const stukprijs = getalOfNul(String(formData.get('stukprijs') ?? ''));
  const korting_pct = getalOfNul(String(formData.get('korting_pct') ?? '0'));
  // Maat staat alleen op artikelregels in het formulier; bij vrije regels blijft hij ongemoeid.
  const maatVeld = formData.get('maat');
  const maat = maatVeld == null ? undefined : String(maatVeld).trim() || null;
  if (aantal < 0) redirect('/dashboard/offertes/' + offerteId + '?fout=aantal');
  if (korting_pct < 0 || korting_pct > 100) redirect('/dashboard/offertes/' + offerteId + '?fout=korting');
  if (regelId && omschrijving) {
    const voorRegel = await getRegel(regelId);
    await werkRegel(regelId, { omschrijving, aantal, stukprijs, korting_pct, ...(maat !== undefined ? { maat } : {}) });
    if (voorRegel) {
      const na: Record<string, unknown> = { omschrijving, aantal, stukprijs, korting_pct };
      if (maat !== undefined) na.maat = maat;
      const voor: Record<string, unknown> = {};
      const gewijzigd: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(na)) {
        const oud = (voorRegel as unknown as Record<string, unknown>)[k] ?? null;
        if (String(oud ?? '') !== String(v ?? '') && !(typeof v === 'number' && Number(oud) === v)) {
          voor[k] = oud;
          gewijzigd[k] = v;
        }
      }
      if (Object.keys(gewijzigd).length) {
        await logAudit('offerteregel_gewijzigd', { entiteit: 'offertes', entiteitId: offerteId, details: { regelId, voor, na: gewijzigd } });
      }
    }
  }
  redirect('/dashboard/offertes/' + offerteId + '?ok=opgeslagen');
}

export async function verwijderRegelActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const offerteId = String(formData.get('offerteId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  if (regelId) {
    const oud = await getRegel(regelId);
    await verwijderRegel(regelId);
    await logAudit('offerteregel_verwijderd', { entiteit: 'offertes', entiteitId: offerteId, details: { regelId, omschrijving: oud?.omschrijving ?? null } });
  }
  redirect('/dashboard/offertes/' + offerteId + '?ok=verwijderd');
}

export async function voegPakketActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const offerteId = String(formData.get('offerteId') ?? '').trim();
  const pakketId = String(formData.get('pakketId') ?? '').trim();
  if (offerteId && pakketId) {
    const aantal = await voegPakketAlsRegels(offerteId, pakketId);
    await logAudit('offerte_pakket_toegevoegd', { entiteit: 'offertes', entiteitId: offerteId, details: { pakketId, aantal } });
  }
  redirect('/dashboard/offertes/' + offerteId + '?ok=toegevoegd');
}

export async function maakOrderVanOfferteActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('offerteId') ?? '').trim();
  if (!id) redirect('/dashboard/offertes');
  const uitkomst = await maakOrderVanOfferteMetUitkomst(id);
  if ('fout' in uitkomst) {
    redirect('/dashboard/offertes/' + id + (uitkomst.fout === 'geen_regels' ? '?fout=geen_regels' : '?fout=order'));
  }
  // Al eerder omgezet (dubbele klik, terugknop): naar die order, geen tweede.
  if (uitkomst.bestond) redirect('/dashboard/orders/' + uitkomst.orderId);
  await logAudit('offerte_omgezet_naar_order', { entiteit: 'offertes', entiteitId: id, details: { orderId: uitkomst.orderId } });
  redirect('/dashboard/orders/' + uitkomst.orderId + '?ok=uit-offerte');
}

export async function mailOfferteActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('offerteId') ?? '').trim();
  const to = String(formData.get('to') ?? '').trim();
  if (!id) redirect('/dashboard/offertes');
  if (!to) redirect('/dashboard/offertes/' + id + '?fout=mail');
  const off = await getOfferte(id);
  if (!off) redirect('/dashboard/offertes');
  // Een offerte zonder regels (of met alleen nul-regels) is een lege mail met een totaal van nul.
  if (!off.regels.some((r) => (Number(r.aantal) || 0) > 0)) redirect('/dashboard/offertes/' + id + '?fout=geen_regels');
  // Een offerte waarvan de geldigheid al voorbij is, eerst een nieuwe datum geven.
  const vandaag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
  if (off.geldig_tot && String(off.geldig_tot).slice(0, 10) < vandaag && off.status !== 'geaccepteerd') {
    redirect('/dashboard/offertes/' + id + '?fout=verlopen');
  }
  const nummer = off.offertenummer != null ? `#${off.offertenummer}` : '';
  // Algemene voorwaarden gaan altijd als PDF mee (Jessi, 27 okt). Lukt dat niet,
  // dan niet versturen: de offerte verwijst naar de bijlage.
  const pdf = await voorwaardenPdfBase64();
  if (!pdf) redirect('/dashboard/offertes/' + id + '?fout=bijlage');
  // Knop om online goed te keuren: ondertekende link naar /akkoord/<token>.
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim();
  const token = offerteAkkoordToken(id);
  const akkoordUrl = host && token ? `https://${host}/akkoord/${encodeURIComponent(token)}` : null;
  const verzending = await sendEmail({
    to,
    replyTo: site.email,
    subject: `Offerte ${nummer} van Frederiks Bedrijfskleding`.replace(/\s+/g, ' ').trim(),
    // Offerte in de huisstijl van het document: logo, regels met foto, totaal en akkoordknop.
    html: offerteMailHtml(off, { akkoordUrl }),
    attachments: [{ filename: VOORWAARDEN_BESTANDSNAAM, content: pdf }],
  }).catch(() => ({ sent: false }));
  if (!verzending.sent) redirect('/dashboard/offertes/' + id + '?fout=verzenden');
  if (off.status === 'concept') await zetOfferteStatus(id, 'verstuurd');
  await logAudit('offerte_gemaild', { entiteit: 'offertes', entiteitId: id, details: { to } });
  redirect('/dashboard/offertes/' + id + '?ok=gemaild');
}

/** Personalisatiekosten berekenen uit de goedgekeurde drukproeven van de klant (mail Jessi 21 okt). */
export async function berekenPersonalisatieOfferteActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const offerteId = String(formData.get('offerteId') ?? '').trim();
  if (!offerteId) redirect('/dashboard/offertes');
  const { berekenPersonalisatieVoorOfferte } = await import('@/lib/kms/personalisatie');
  const u = await berekenPersonalisatieVoorOfferte(offerteId);
  await logAudit('personalisatie_berekend', { entiteit: 'offertes', entiteitId: offerteId, details: { regels: u.regels, totaal: u.totaal } });
  redirect('/dashboard/offertes/' + offerteId + (u.regels > 0 ? '?ok=pers' : u.geenProef ? '?fout=pers_geen_proef' : '?fout=pers_geen'));
}

/** Klantkorting op alle artikelregels: merkkorting, anders de standaardkorting (Jessi, 27 okt). */
export async function pasKlantkortingToeActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const offerteId = String(formData.get('offerteId') ?? '').trim();
  if (!offerteId) redirect('/dashboard/offertes');
  const { pasKlantkortingToe } = await import('@/lib/kms/offertes');
  const u = await pasKlantkortingToe(offerteId);
  if (u.geenKorting) redirect('/dashboard/offertes/' + offerteId + '?fout=geen_korting');
  await logAudit('offerte_klantkorting', { entiteit: 'offertes', entiteitId: offerteId, details: { regels: u.regels } });
  revalidatePath('/dashboard/offertes/' + offerteId);
  redirect('/dashboard/offertes/' + offerteId + '?ok=korting');
}
