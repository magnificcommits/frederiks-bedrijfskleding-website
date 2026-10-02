'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import {
  werkOfferte,
  zetOfferteStatus,
  verwijderOfferte,
  voegRegelToe,
  werkRegel,
  verwijderRegel,
  maakOrderVanOfferte,
  voegPakketAlsRegels,
  getOfferte,
  getRegel,
  offerteTotalen,
  listOfferteArtikelen,
  listOfferteKleuren,
  type OfferteArtikel,
  type OfferteKleur,
} from '@/lib/kms/offertes';
import { logAudit } from '@/lib/kms/audit';
import { sendEmail, emailLayout, escapeHtml } from '@/lib/email';
import { formatEuro, formatDatum } from '@/lib/format';
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
  const contactpersoon = String(formData.get('contactpersoon') ?? '').trim();
  const geldig_tot = String(formData.get('geldig_tot') ?? '').trim();
  const notitie = String(formData.get('notitie') ?? '').trim();
  const btwRuw = String(formData.get('btw_pct') ?? '').trim();
  const btw_pct = btwRuw === '' ? 21 : getalOfNul(btwRuw);
  const nieuw = {
    organisatie_id: organisatie_id || null,
    contactpersoon: contactpersoon || null,
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
  if (id && status) {
    await zetOfferteStatus(id, status);
    await logAudit('offerte_status_gewijzigd', { entiteit: 'offertes', entiteitId: id, details: { status } });
  }
  redirect('/dashboard/offertes/' + id + '?ok=status');
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
  const orderId = await maakOrderVanOfferte(id);
  if (!orderId) redirect('/dashboard/offertes/' + id + '?fout=order');
  await logAudit('offerte_omgezet_naar_order', { entiteit: 'offertes', entiteitId: id, details: { orderId } });
  redirect('/dashboard/orders/' + orderId + '?ok=uit-offerte');
}

export async function mailOfferteActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('offerteId') ?? '').trim();
  const to = String(formData.get('to') ?? '').trim();
  if (!id) redirect('/dashboard/offertes');
  if (!to) redirect('/dashboard/offertes/' + id + '?fout=mail');
  const off = await getOfferte(id);
  if (!off) redirect('/dashboard/offertes');
  const { subtotaal, korting, btw, totaal } = offerteTotalen(off.regels, off.btw_pct);
  const nummer = off.offertenummer != null ? `#${off.offertenummer}` : '';
  const rijen = off.regels
    .map((r) => {
      const aantal = Number(r.aantal) || 0;
      const stuk = Number(r.stukprijs) || 0;
      const kort = Number(r.korting_pct) || 0;
      const netto = aantal * stuk * (1 - kort / 100);
      const oms = (r.omschrijving ?? '').toLowerCase();
      const extra = [
        r.kleur && !oms.includes(r.kleur.trim().toLowerCase()) ? `Kleur: ${r.kleur.trim()}` : '',
        r.maat && !oms.includes(`maat ${r.maat.trim().toLowerCase()}`) ? `Maat: ${r.maat.trim()}` : '',
      ].filter(Boolean).join(' · ');
      return `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#1c1c1c;">${escapeHtml(r.omschrijving ?? '')}${extra ? `<br><span style="font-size:12px;color:#52504e;">${escapeHtml(extra)}</span>` : ''}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;color:#52504e;">${aantal}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;color:#52504e;">${formatEuro(stuk)}${kort ? ` (-${kort}%)` : ''}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;color:#1c1c1c;">${formatEuro(netto)}</td></tr>`;
    })
    .join('');
  const bodyHtml = `
    <p style="margin:0;">Beste ${escapeHtml(off.contactpersoon || off.organisatie_naam || 'relatie')},</p>
    <p style="margin:14px 0 0;">Hierbij onze offerte ${escapeHtml(nummer)}${off.geldig_tot ? `, geldig tot ${escapeHtml(formatDatum(off.geldig_tot))}` : ''}.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <thead><tr><th style="text-align:left;padding:6px 0;border-bottom:2px solid #1c1c1c;">Omschrijving</th><th style="text-align:right;padding:6px 0;border-bottom:2px solid #1c1c1c;">Aantal</th><th style="text-align:right;padding:6px 0;border-bottom:2px solid #1c1c1c;">Stukprijs</th><th style="text-align:right;padding:6px 0;border-bottom:2px solid #1c1c1c;">Bedrag</th></tr></thead>
      <tbody>${rijen || '<tr><td colspan="4" style="padding:8px 0;color:#52504e;">Geen regels.</td></tr>'}</tbody>
    </table>
    <table style="margin-left:auto;font-size:14px;">
      ${korting ? `<tr><td style="padding:2px 12px 2px 0;color:#52504e;">Korting</td><td style="text-align:right;color:#1c1c1c;">${formatEuro(-korting)}</td></tr>` : ''}
      <tr><td style="padding:2px 12px 2px 0;color:#52504e;">Subtotaal</td><td style="text-align:right;color:#1c1c1c;">${formatEuro(subtotaal)}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#52504e;">Btw (${off.btw_pct ?? 21}%)</td><td style="text-align:right;color:#1c1c1c;">${formatEuro(btw)}</td></tr>
      <tr><td style="padding:6px 12px 2px 0;font-weight:800;color:#1c1c1c;">Totaal</td><td style="text-align:right;font-weight:800;color:#1c1c1c;">${formatEuro(totaal)}</td></tr>
    </table>
    ${off.notitie ? `<p style="margin:16px 0 0;white-space:pre-wrap;color:#1c1c1c;">${escapeHtml(off.notitie)}</p>` : ''}
    <p style="margin:16px 0 0;">Akkoord of een vraag? Antwoord gerust op deze mail, of bel <strong style="color:#1c1c1c;">${escapeHtml(site.phone)}</strong>.</p>
  `;
  const verzending = await sendEmail({
    to,
    replyTo: site.email,
    subject: `Offerte ${nummer} van Frederiks Bedrijfskleding`.replace(/\s+/g, ' ').trim(),
    html: emailLayout({ heading: `Offerte ${nummer}`.trim(), preheader: 'Je offerte van Frederiks Bedrijfskleding', bodyHtml }),
  }).catch(() => ({ sent: false }));
  if (!verzending.sent) redirect('/dashboard/offertes/' + id + '?fout=verzenden');
  if (off.status === 'concept') await zetOfferteStatus(id, 'verstuurd');
  await logAudit('offerte_gemaild', { entiteit: 'offertes', entiteitId: id, details: { to } });
  redirect('/dashboard/offertes/' + id + '?ok=gemaild');
}
