import { kmsAdmin } from '@/lib/kms/adminClient';
import { sendEmail, escapeHtml, emailGegevens, emailLayout } from '@/lib/email';
import { isEmailConfigured } from '@/lib/env';
import { site } from '@/content/site';

/**
 * E-mailnotificaties voor de KMS-orders, in de Frederiks-huisstijl.
 * - stuurStatusMail: statusupdate naar de besteller.
 * - stuurLeverancierBestelmail: bestelmail per leverancier na goedkeuring.
 * Best effort: doen niets zonder mailconfiguratie en laten een mutatie nooit falen.
 * Mailadressen via kmsAdmin() (service-role), ongeacht RLS.
 */

const STATUS_LABEL: Record<string, string> = {
  concept: 'Concept',
  offerte_verstuurd: 'Offerte verstuurd',
  offerte_goedgekeurd: 'Offerte goedgekeurd',
  nog_bestellen: 'Nog te bestellen',
  besteld: 'Besteld',
  deellevering: 'Deellevering',
  compleet_geleverd: 'Compleet geleverd',
  bedrukken: 'Bedrukken',
  borduren: 'Borduren',
  verpakken: 'Verpakken',
  bezorgen: 'Bezorgen',
  verzonden: 'Verzonden',
  factureren: 'Factureren',
  afgerond: 'Afgerond',
  geannuleerd: 'Geannuleerd',
};

function leesbareStatus(status: string | null | undefined): string {
  if (!status) return '';
  return STATUS_LABEL[status] ?? status.replace(/_/g, ' ');
}

function isEmail(waarde: string | null | undefined): boolean {
  return typeof waarde === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waarde.trim());
}

type OrderRij = {
  id: string;
  ordernummer: number | null;
  organisatie_id: string | null;
  medewerker_id: string | null;
  status: string | null;
  goedkeuring_status: string | null;
  aangevraagd_door: string | null;
  vervoerder: string | null;
  track_trace_code: string | null;
};

type RegelRij = {
  product_id: string | null;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
};

async function haalOrder(orderId: string): Promise<OrderRij | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const { data } = await sb
    .from('orders')
    .select('id, ordernummer, organisatie_id, medewerker_id, status, goedkeuring_status, aangevraagd_door, vervoerder, track_trace_code')
    .eq('id', orderId)
    .maybeSingle();
  return (data as OrderRij | null) ?? null;
}

/** Besteller-e-mail: eerst de gekoppelde medewerker, anders aangevraagd_door. */
async function bestellerEmail(order: OrderRij): Promise<string | null> {
  const sb = kmsAdmin();
  if (sb && order.medewerker_id) {
    const { data } = await sb.from('medewerkers').select('email').eq('id', order.medewerker_id).maybeSingle();
    const email = (data as { email: string | null } | null)?.email ?? null;
    if (isEmail(email)) return email!.trim();
  }
  if (isEmail(order.aangevraagd_door)) return order.aangevraagd_door!.trim();
  return null;
}

const cel = 'padding:9px 8px 9px 0;border-bottom:1px solid #eeeceb;color:#1c1c1c;';
const kopCel = 'padding:8px 8px 8px 0;border-bottom:2px solid #1c1c1c;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#1c1c1c;';

/** HTML van de statusupdate aan de besteller. */
export function statusMailHtml(d: { nummer: string; status: string; orderStatus: string | null; vervoerder: string | null; trackTrace: string | null }): string {
  const { nummer, status } = d;
  const verzending = d.orderStatus === 'verzonden' && (d.vervoerder || d.trackTrace);
  return emailLayout({
    heading: `Update over je bestelling ${nummer}`.trim(),
    preheader: `Je bestelling ${nummer} heeft nu de status ${status}.`.trim(),
    bodyHtml: `
      <p style="margin:14px 0 0;">De status van je bestelling is bijgewerkt.</p>
      ${emailGegevens([
        ...(nummer ? [['Bestelling', escapeHtml(nummer)] as [string, string]] : []),
        ['Nieuwe status', `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background-color:#fdf0e9;color:#b04318;font-size:13px;font-weight:700;">${escapeHtml(status)}</span>`],
        ...(verzending && d.vervoerder ? [['Vervoerder', escapeHtml(d.vervoerder)] as [string, string]] : []),
        ...(verzending && d.trackTrace ? [['Track en trace', `<strong>${escapeHtml(d.trackTrace)}</strong>`] as [string, string]] : []),
      ])}
      <p style="margin:18px 0 0;">Heb je een vraag over deze bestelling? Bel of WhatsApp gerust: <strong style="color:#1c1c1c;">${escapeHtml(site.phone)}</strong>.</p>
      <p style="margin:20px 0 0;">Groet,<br/>Frederiks Bedrijfskleding</p>
    `,
  });
}

/** Statusupdate naar de besteller, met ordernummer, status en eventueel track en trace. */
export async function stuurStatusMail(orderId: string): Promise<void> {
  if (!isEmailConfigured) return;
  const order = await haalOrder(orderId);
  if (!order) return;
  const naar = await bestellerEmail(order);
  if (!naar) return;

  const nummer = order.ordernummer != null ? `#${order.ordernummer}` : '';
  const status = leesbareStatus(order.status);

  const html = statusMailHtml({ nummer, status, orderStatus: order.status, vervoerder: order.vervoerder, trackTrace: order.track_trace_code });

  await sendEmail({ to: naar, subject: `Update bestelling ${nummer} · ${status}`.trim(), html }).catch(() => {});
}

/** HTML van de bestelmail aan een leverancier na goedkeuring. */
export function leverancierBestelmailHtml(d: { leverancier: string | null; klantnaam: string; nummer: string; regels: Pick<RegelRij, 'item_naam' | 'maat' | 'kleur' | 'aantal'>[] }): string {
  const { klantnaam, nummer } = d;
  const rijen = d.regels
    .map(
      (r) =>
        `<tr>
          <td style="${cel}font-weight:700;">${escapeHtml(r.item_naam)}</td>
          <td style="${cel}">${escapeHtml(r.maat ?? '')}</td>
          <td style="${cel}">${escapeHtml(r.kleur ?? '')}</td>
          <td style="${cel}padding-right:0;text-align:right;font-weight:700;">${escapeHtml(String(r.aantal))}</td>
        </tr>`,
    )
    .join('');

  return emailLayout({
    heading: `Bestelling ${nummer}`.trim(),
    preheader: `Bestelling ${nummer}${klantnaam ? ` voor ${klantnaam}` : ''}.`.trim(),
    bodyHtml: `
      <p style="margin:0;">Beste ${escapeHtml(d.leverancier ?? '')},</p>
      <p style="margin:14px 0 0;">Graag bestellen wij de onderstaande artikelen${klantnaam ? ` voor onze klant ${escapeHtml(klantnaam)}` : ''}.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0 0;">
        <thead>
          <tr>
            <th align="left" style="${kopCel}">Artikel</th>
            <th align="left" style="${kopCel}">Maat</th>
            <th align="left" style="${kopCel}">Kleur</th>
            <th align="right" style="${kopCel}padding-right:0;">Aantal</th>
          </tr>
        </thead>
        <tbody>${rijen}</tbody>
      </table>
      <p style="margin:18px 0 0;">Onze referentie: <strong style="color:#1c1c1c;">${escapeHtml(nummer)}</strong>. Graag een bevestiging van de levertijd.</p>
      <p style="margin:20px 0 0;">Met vriendelijke groet,<br/>Frederiks Bedrijfskleding</p>
    `,
  });
}

/** Bestelmail per leverancier na goedkeuring, met de regels en de klantnaam. */
export async function stuurLeverancierBestelmail(orderId: string): Promise<void> {
  if (!isEmailConfigured) return;
  const sb = kmsAdmin();
  if (!sb) return;

  const order = await haalOrder(orderId);
  if (!order) return;

  const { data: regelData } = await sb
    .from('orderregels')
    .select('product_id, item_naam, maat, kleur, aantal')
    .eq('order_id', orderId);
  const regels = (regelData as RegelRij[] | null) ?? [];
  if (regels.length === 0) return;

  const productIds = Array.from(new Set(regels.map((r) => r.product_id).filter((p): p is string => Boolean(p))));
  const leverancierPerProduct = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: prodData } = await sb.from('producten').select('id, leverancier_id').in('id', productIds);
    for (const p of (prodData as { id: string; leverancier_id: string | null }[]) ?? []) {
      if (p.leverancier_id) leverancierPerProduct.set(p.id, p.leverancier_id);
    }
  }

  const regelsPerLeverancier = new Map<string, RegelRij[]>();
  for (const r of regels) {
    const levId = r.product_id ? leverancierPerProduct.get(r.product_id) : undefined;
    if (!levId) continue;
    const lijst = regelsPerLeverancier.get(levId) ?? [];
    lijst.push(r);
    regelsPerLeverancier.set(levId, lijst);
  }
  if (regelsPerLeverancier.size === 0) return;

  const levIds = Array.from(regelsPerLeverancier.keys());
  const { data: levData } = await sb.from('leveranciers').select('id, naam, email').in('id', levIds);
  const leveranciers = new Map<string, { naam: string | null; email: string | null }>();
  for (const l of (levData as { id: string; naam: string | null; email: string | null }[]) ?? []) {
    leveranciers.set(l.id, { naam: l.naam, email: l.email });
  }

  let klantnaam = '';
  if (order.organisatie_id) {
    const { data: orgData } = await sb.from('organisaties').select('naam').eq('id', order.organisatie_id).maybeSingle();
    klantnaam = (orgData as { naam: string | null } | null)?.naam ?? '';
  }

  const nummer = order.ordernummer != null ? `#${order.ordernummer}` : '';

  for (const [levId, levRegels] of regelsPerLeverancier) {
    const lev = leveranciers.get(levId);
    if (!isEmail(lev?.email)) continue;

    const html = leverancierBestelmailHtml({ leverancier: lev?.naam ?? null, klantnaam, nummer, regels: levRegels });

    await sendEmail({
      to: lev!.email!.trim(),
      subject: `Bestelling ${nummer}${klantnaam ? ` · ${klantnaam}` : ''} · ${site.name}`.trim(),
      html,
    }).catch(() => {});
  }
}
