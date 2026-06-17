import { kmsAdmin } from '@/lib/kms/adminClient';
import { sendEmail, escapeHtml, emailLayout } from '@/lib/email';
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

const cel = 'padding:8px 12px;border:1px solid #e4e2e0;';

/** Statusupdate naar de besteller, met ordernummer, status en eventueel track en trace. */
export async function stuurStatusMail(orderId: string): Promise<void> {
  if (!isEmailConfigured) return;
  const order = await haalOrder(orderId);
  if (!order) return;
  const naar = await bestellerEmail(order);
  if (!naar) return;

  const nummer = order.ordernummer != null ? `#${order.ordernummer}` : '';
  const status = leesbareStatus(order.status);

  let extra = '';
  if (order.status === 'verzonden' && (order.vervoerder || order.track_trace_code)) {
    const regels: string[] = [];
    if (order.vervoerder) regels.push(`<p style="margin:6px 0 0;"><strong style="color:#1c1c1c;">Vervoerder:</strong> ${escapeHtml(order.vervoerder)}</p>`);
    if (order.track_trace_code) regels.push(`<p style="margin:6px 0 0;"><strong style="color:#1c1c1c;">Track en trace:</strong> ${escapeHtml(order.track_trace_code)}</p>`);
    extra = regels.join('');
  }

  const html = emailLayout({
    heading: `Update over je bestelling ${nummer}`.trim(),
    preheader: `Je bestelling ${nummer} heeft nu de status ${status}.`.trim(),
    bodyHtml: `
      <p style="margin:0;">De status van je bestelling is bijgewerkt.</p>
      <p style="margin:14px 0 0;"><strong style="color:#1c1c1c;">Nieuwe status:</strong> ${escapeHtml(status)}</p>
      ${extra}
      <p style="margin:16px 0 0;">Heb je een vraag over deze bestelling? Bel of WhatsApp gerust: <strong style="color:#1c1c1c;">${escapeHtml(site.phone)}</strong>.</p>
    `,
  });

  await sendEmail({ to: naar, subject: `Update bestelling ${nummer} · ${status}`.trim(), html }).catch(() => {});
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

    const rijen = levRegels
      .map(
        (r) =>
          `<tr>
            <td style="${cel}">${escapeHtml(r.item_naam)}</td>
            <td style="${cel}">${escapeHtml(r.maat ?? '')}</td>
            <td style="${cel}">${escapeHtml(r.kleur ?? '')}</td>
            <td style="${cel}text-align:right;">${escapeHtml(String(r.aantal))}</td>
          </tr>`,
      )
      .join('');

    const html = emailLayout({
      heading: `Bestelling ${nummer}`.trim(),
      preheader: `Bestelling ${nummer}${klantnaam ? ` voor ${klantnaam}` : ''}.`.trim(),
      bodyHtml: `
        <p style="margin:0;">Beste ${escapeHtml(lev?.naam ?? '')},</p>
        <p style="margin:14px 0 0;">Graag bestellen wij de onderstaande artikelen${klantnaam ? ` voor onze klant ${escapeHtml(klantnaam)}` : ''}.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;margin:14px 0;">
          <thead>
            <tr style="background-color:#f6f5f4;">
              <th style="${cel}text-align:left;color:#1c1c1c;">Artikel</th>
              <th style="${cel}text-align:left;color:#1c1c1c;">Maat</th>
              <th style="${cel}text-align:left;color:#1c1c1c;">Kleur</th>
              <th style="${cel}text-align:right;color:#1c1c1c;">Aantal</th>
            </tr>
          </thead>
          <tbody>${rijen}</tbody>
        </table>
        <p style="margin:0;">Onze referentie: ${escapeHtml(nummer)}. Graag een bevestiging van de levertijd.</p>
      `,
    });

    await sendEmail({
      to: lev!.email!.trim(),
      subject: `Bestelling ${nummer}${klantnaam ? ` · ${klantnaam}` : ''} · ${site.name}`.trim(),
      html,
    }).catch(() => {});
  }
}
