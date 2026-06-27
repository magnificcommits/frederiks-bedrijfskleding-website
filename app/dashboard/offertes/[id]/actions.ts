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
  getOfferte,
  offerteTotalen,
} from '@/lib/kms/offertes';
import { logAudit } from '@/lib/kms/audit';
import { sendEmail, emailLayout, escapeHtml } from '@/lib/email';
import { formatEuro, formatDatum } from '@/lib/format';
import { site } from '@/content/site';

function getalOfNul(raw: string): number {
  const s = raw.replace(/[^0-9.,-]/g, '').replace(',', '.');
  return s === '' ? 0 : Number(s);
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
  await werkOfferte(id, {
    organisatie_id: organisatie_id || null,
    contactpersoon: contactpersoon || null,
    geldig_tot: geldig_tot || null,
    notitie: notitie || null,
    btw_pct,
  });
  await logAudit('offerte_gewijzigd', { entiteit: 'offertes', entiteitId: id });
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
  if (offerteId && omschrijving) {
    await voegRegelToe(offerteId, { omschrijving, aantal, stukprijs, korting_pct, inkoop });
    await logAudit('offerteregel_toegevoegd', { entiteit: 'offertes', entiteitId: offerteId });
  }
  redirect('/dashboard/offertes/' + offerteId);
}

export async function werkRegelActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const offerteId = String(formData.get('offerteId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const aantal = getalOfNul(String(formData.get('aantal') ?? '1'));
  const stukprijs = getalOfNul(String(formData.get('stukprijs') ?? ''));
  const korting_pct = getalOfNul(String(formData.get('korting_pct') ?? '0'));
  if (regelId && omschrijving) {
    await werkRegel(regelId, { omschrijving, aantal, stukprijs, korting_pct });
  }
  redirect('/dashboard/offertes/' + offerteId);
}

export async function verwijderRegelActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const offerteId = String(formData.get('offerteId') ?? '').trim();
  const regelId = String(formData.get('regelId') ?? '').trim();
  if (regelId) await verwijderRegel(regelId);
  redirect('/dashboard/offertes/' + offerteId);
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
      return `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#1c1c1c;">${escapeHtml(r.omschrijving ?? '')}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;color:#52504e;">${aantal}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;color:#52504e;">${formatEuro(stuk)}${kort ? ` (-${kort}%)` : ''}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;color:#1c1c1c;">${formatEuro(netto)}</td></tr>`;
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
  await sendEmail({
    to,
    replyTo: site.email,
    subject: `Offerte ${nummer} van Frederiks Bedrijfskleding`.replace(/\s+/g, ' ').trim(),
    html: emailLayout({ heading: `Offerte ${nummer}`.trim(), preheader: 'Je offerte van Frederiks Bedrijfskleding', bodyHtml }),
  }).catch(() => ({ sent: false }));
  if (off.status === 'concept') await zetOfferteStatus(id, 'verstuurd');
  await logAudit('offerte_gemaild', { entiteit: 'offertes', entiteitId: id, details: { to } });
  redirect('/dashboard/offertes/' + id + '?ok=gemaild');
}
