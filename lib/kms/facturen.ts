import { kmsAdmin } from '@/lib/kms/adminClient';
import { isEmailConfigured, env } from '@/lib/env';
import { sendEmail, emailLayout, escapeHtml } from '@/lib/email';

/**
 * Data-access voor de module Facturatie (zelf gebouwd, geen externe boekhouding).
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export const FACTUUR_STATUSSEN = ['concept', 'verzonden', 'betaald'] as const;
export type FactuurStatus = (typeof FACTUUR_STATUSSEN)[number];

export type Factuur = {
  id: string;
  factuurnummer: string | null;
  organisatie_id: string;
  order_id: string | null;
  factuurdatum: string | null;
  vervaldatum: string | null;
  bedrag_excl: number | null;
  btw_bedrag: number | null;
  bedrag_incl: number | null;
  status: string;
  factuur_email: string | null;
  betaaldatum: string | null;
  toegepaste_prijsafspraken: string | null;
  gemaild_op: string | null;
  created_at: string;
};

export type Factuurregel = {
  id: string;
  factuur_id: string;
  omschrijving: string;
  aantal: number;
  stukprijs: number;
  btw_pct: number;
  bedrag: number;
};

export type Organisatie = {
  id: string;
  naam: string;
  factuur_email: string | null;
  btw_nummer: string | null;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  klantnummer: string | null;
};

export type FactuurMetKlant = Factuur & { organisatie_naam: string | null };
export type FactuurDetail = Factuur & { regels: Factuurregel[]; organisatie: Organisatie | null };

export type FactuurregelVelden = {
  omschrijving: string;
  aantal?: number;
  stukprijs?: number;
  btw_pct?: number;
};

const ORG_SELECT = 'id, naam, factuur_email, btw_nummer, adres, postcode, plaats, klantnummer';

function vandaagISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDagen(datum: string | null, dagen: number): string {
  const basis = datum ? new Date(datum) : new Date();
  basis.setDate(basis.getDate() + dagen);
  return basis.toISOString().slice(0, 10);
}

async function volgendFactuurnummer(sb: NonNullable<ReturnType<typeof kmsAdmin>>): Promise<string> {
  const jaar = new Date().getFullYear();
  const prefix = `FR-${jaar}-`;
  const { data } = await sb
    .from('facturen')
    .select('factuurnummer')
    .like('factuurnummer', `${prefix}%`)
    .order('factuurnummer', { ascending: false })
    .limit(1);
  const laatste = (data as { factuurnummer: string | null }[] | null)?.[0]?.factuurnummer ?? null;
  let volgnr = 1;
  if (laatste) {
    const staart = Number(laatste.slice(prefix.length));
    if (Number.isFinite(staart)) volgnr = staart + 1;
  }
  return `${prefix}${String(volgnr).padStart(4, '0')}`;
}

export async function listFacturen(statusFilter?: string): Promise<FactuurMetKlant[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  let q = sb
    .from('facturen')
    .select('*, organisaties(naam)')
    .order('created_at', { ascending: false });
  if (statusFilter && statusFilter.trim()) q = q.eq('status', statusFilter.trim());
  const { data } = await q;
  const rows = (data as unknown as (Factuur & { organisaties: { naam: string } | null })[]) ?? [];
  return rows.map((r) => {
    const { organisaties, ...rest } = r;
    return { ...rest, organisatie_naam: organisaties?.naam ?? null } as FactuurMetKlant;
  });
}

export async function getFactuur(id: string): Promise<FactuurDetail | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data } = await sb.from('facturen').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const factuur = data as Factuur;
  const [{ data: regelData }, { data: orgData }] = await Promise.all([
    sb.from('factuurregels').select('*').eq('factuur_id', id).order('id'),
    sb.from('organisaties').select(ORG_SELECT).eq('id', factuur.organisatie_id).maybeSingle(),
  ]);
  return {
    ...factuur,
    regels: (regelData as Factuurregel[]) ?? [],
    organisatie: (orgData as Organisatie | null) ?? null,
  };
}

export async function maakLegeFactuur(organisatieId: string): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data: orgData } = await sb
    .from('organisaties')
    .select('factuur_email')
    .eq('id', organisatieId)
    .maybeSingle();
  const factuurEmail = (orgData as { factuur_email: string | null } | null)?.factuur_email ?? null;
  const factuurnummer = await volgendFactuurnummer(sb);
  const { data, error } = await sb
    .from('facturen')
    .insert({
      factuurnummer,
      organisatie_id: organisatieId,
      factuurdatum: vandaagISO(),
      status: 'concept',
      factuur_email: factuurEmail,
      bedrag_excl: 0,
      btw_bedrag: 0,
      bedrag_incl: 0,
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function maakFactuurVanOrder(orderId: string): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data: orderData } = await sb
    .from('orders')
    .select('id, organisatie_id')
    .eq('id', orderId)
    .maybeSingle();
  const order = orderData as { id: string; organisatie_id: string } | null;
  if (!order) return null;

  const [{ data: regelData }, { data: orgData }] = await Promise.all([
    sb.from('orderregels').select('item_naam, maat, kleur, aantal, stukprijs').eq('order_id', orderId).order('created_at'),
    sb.from('organisaties').select('factuur_email').eq('id', order.organisatie_id).maybeSingle(),
  ]);
  const orderregels = (regelData as { item_naam: string; maat: string | null; kleur: string | null; aantal: number; stukprijs: number | null }[]) ?? [];
  const factuurEmail = (orgData as { factuur_email: string | null } | null)?.factuur_email ?? null;

  const factuurnummer = await volgendFactuurnummer(sb);
  const { data: factuurData, error } = await sb
    .from('facturen')
    .insert({
      factuurnummer,
      organisatie_id: order.organisatie_id,
      order_id: orderId,
      factuurdatum: vandaagISO(),
      status: 'concept',
      factuur_email: factuurEmail,
      bedrag_excl: 0,
      btw_bedrag: 0,
      bedrag_incl: 0,
    })
    .select('id')
    .single();
  if (error || !factuurData) return null;
  const factuurId = (factuurData as { id: string }).id;

  if (orderregels.length > 0) {
    const rijen = orderregels.map((r) => {
      const aantal = Number(r.aantal) || 0;
      const stukprijs = Number(r.stukprijs) || 0;
      const extra = [r.maat, r.kleur].filter(Boolean).join(' / ');
      const omschrijving = extra ? `${r.item_naam} (${extra})` : r.item_naam;
      return {
        factuur_id: factuurId,
        omschrijving,
        aantal,
        stukprijs,
        btw_pct: 21,
        bedrag: aantal * stukprijs,
      };
    });
    await sb.from('factuurregels').insert(rijen);
  }
  await herberekenFactuur(factuurId);
  return factuurId;
}

export async function voegFactuurregelToe(factuurId: string, v: FactuurregelVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const aantal = Number(v.aantal) || 0;
  const stukprijs = Number(v.stukprijs) || 0;
  const btw_pct = v.btw_pct == null ? 21 : Number(v.btw_pct);
  const { error } = await sb.from('factuurregels').insert({
    factuur_id: factuurId,
    omschrijving: v.omschrijving,
    aantal,
    stukprijs,
    btw_pct,
    bedrag: aantal * stukprijs,
  });
  if (error) return false;
  await herberekenFactuur(factuurId);
  return true;
}

export async function werkFactuurregel(id: string, v: FactuurregelVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { data } = await sb.from('factuurregels').select('factuur_id').eq('id', id).maybeSingle();
  const factuurId = (data as { factuur_id: string } | null)?.factuur_id ?? null;
  const aantal = Number(v.aantal) || 0;
  const stukprijs = Number(v.stukprijs) || 0;
  const btw_pct = v.btw_pct == null ? 21 : Number(v.btw_pct);
  const { error } = await sb
    .from('factuurregels')
    .update({ omschrijving: v.omschrijving, aantal, stukprijs, btw_pct, bedrag: aantal * stukprijs })
    .eq('id', id);
  if (error) return false;
  if (factuurId) await herberekenFactuur(factuurId);
  return true;
}

export async function verwijderFactuurregel(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { data } = await sb.from('factuurregels').select('factuur_id').eq('id', id).maybeSingle();
  const factuurId = (data as { factuur_id: string } | null)?.factuur_id ?? null;
  const { error } = await sb.from('factuurregels').delete().eq('id', id);
  if (error) return false;
  if (factuurId) await herberekenFactuur(factuurId);
  return true;
}

export async function herberekenFactuur(factuurId: string): Promise<void> {
  const sb = kmsAdmin(); if (!sb) return;
  const { data } = await sb.from('factuurregels').select('bedrag, btw_pct').eq('factuur_id', factuurId);
  const regels = (data as { bedrag: number | null; btw_pct: number | null }[]) ?? [];
  const bedrag_excl = regels.reduce((t, r) => t + (Number(r.bedrag) || 0), 0);
  const btw_bedrag = regels.reduce((t, r) => t + (Number(r.bedrag) || 0) * (Number(r.btw_pct) || 0) / 100, 0);
  const bedrag_incl = bedrag_excl + btw_bedrag;
  await sb
    .from('facturen')
    .update({
      bedrag_excl: Math.round(bedrag_excl * 100) / 100,
      btw_bedrag: Math.round(btw_bedrag * 100) / 100,
      bedrag_incl: Math.round(bedrag_incl * 100) / 100,
    })
    .eq('id', factuurId);
}

export async function zetFactuurStatus(id: string, status: string, betaaldatum?: string | null): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const patch: Record<string, unknown> = { status };
  if (status === 'betaald') {
    patch.betaaldatum = betaaldatum ?? vandaagISO();
  }
  if (status === 'verzonden') {
    const { data } = await sb.from('facturen').select('factuurdatum, vervaldatum').eq('id', id).maybeSingle();
    const huidig = data as { factuurdatum: string | null; vervaldatum: string | null } | null;
    if (huidig && !huidig.vervaldatum) {
      patch.vervaldatum = plusDagen(huidig.factuurdatum, 30);
    }
  }
  const { error } = await sb.from('facturen').update(patch).eq('id', id);
  return !error;
}

export async function listOrganisaties(): Promise<{ id: string; naam: string }[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('organisaties').select('id, naam').order('naam');
  return (data as { id: string; naam: string }[]) ?? [];
}

export async function listFactureerbareOrders(): Promise<{ id: string; ordernummer: number; organisatie_naam: string | null; bedrag: number | null }[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data: factuurData } = await sb.from('facturen').select('order_id').not('order_id', 'is', null);
  const metFactuur = new Set(((factuurData as { order_id: string | null }[]) ?? []).map((f) => f.order_id).filter(Boolean) as string[]);
  const { data } = await sb
    .from('orders')
    .select('id, ordernummer, bedrag, organisaties(naam)')
    .order('ordernummer', { ascending: false });
  const rows = (data as unknown as { id: string; ordernummer: number; bedrag: number | null; organisaties: { naam: string } | null }[]) ?? [];
  return rows
    .filter((o) => !metFactuur.has(o.id))
    .map((o) => ({ id: o.id, ordernummer: o.ordernummer, bedrag: o.bedrag, organisatie_naam: o.organisaties?.naam ?? null }));
}

/** Het ingestelde e-mailadres van de boekhouder ('' als nog niet ingesteld). */
export async function getBoekhouderEmail(): Promise<string> {
  const sb = kmsAdmin(); if (!sb) return '';
  const { data } = await sb
    .from('instellingen')
    .select('waarde')
    .eq('sleutel', 'boekhouder_email')
    .maybeSingle();
  return (data as { waarde: string | null } | null)?.waarde ?? '';
}

/** Bewaart (upsert) het e-mailadres van de boekhouder. */
export async function zetBoekhouderEmail(email: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb
    .from('instellingen')
    .upsert(
      { sleutel: 'boekhouder_email', waarde: email.trim(), bijgewerkt_op: new Date().toISOString() },
      { onConflict: 'sleutel' },
    );
  return !error;
}

/**
 * Mailt de geselecteerde facturen in één e-mail naar de boekhouder, markeert ze
 * als gemaild (facturen.gemaild_op) en logt elke verzending in factuur_mail_log.
 */
export async function mailFacturenNaarBoekhouder(ids: string[]): Promise<{ ok: boolean; aantal: number; error?: string }> {
  if (!ids || ids.length === 0) return { ok: false, aantal: 0, error: 'Geen facturen geselecteerd.' };
  if (!isEmailConfigured) {
    return { ok: false, aantal: 0, error: 'E-mail is nog niet geconfigureerd (Resend). Stel dat eerst in voordat je facturen kunt mailen.' };
  }
  const boekhouder = await getBoekhouderEmail();
  if (!boekhouder.trim()) return { ok: false, aantal: 0, error: 'Stel eerst het e-mailadres van de boekhouder in.' };

  const sb = kmsAdmin();
  if (!sb) return { ok: false, aantal: 0, error: 'Leaddatabase niet gekoppeld.' };

  const { data } = await sb
    .from('facturen')
    .select('id, factuurnummer, bedrag_incl, factuurdatum, status, organisaties(naam)')
    .in('id', ids);
  const rows = (data as unknown as {
    id: string;
    factuurnummer: string | null;
    bedrag_incl: number | null;
    factuurdatum: string | null;
    status: string;
    organisaties: { naam: string } | null;
  }[]) ?? [];
  if (rows.length === 0) return { ok: false, aantal: 0, error: 'Geen facturen gevonden.' };

  const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
  const datum = (d: string | null) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  const rijenHtml = rows.map((r) => {
    const klant = escapeHtml(r.organisaties?.naam ?? '-');
    const nummer = escapeHtml(r.factuurnummer || 'concept');
    const link = `${env.siteUrl}/dashboard/facturen/${r.id}`;
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e4e2e0;"><a href="${link}" style="color:#ec6726;font-weight:700;text-decoration:none;">${nummer}</a></td>
      <td style="padding:8px 10px;border-bottom:1px solid #e4e2e0;">${klant}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e4e2e0;">${datum(r.factuurdatum)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e4e2e0;text-align:right;">${euro(Number(r.bedrag_incl) || 0)}</td>
    </tr>`;
  }).join('');

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hierbij ${rows.length === 1 ? 'de factuur' : `de ${rows.length} facturen`} ter verwerking. Klik op een factuurnummer om de factuur in te zien.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background-color:#f6f5f4;">
          <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e4e2e0;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#52504e;">Nummer</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e4e2e0;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#52504e;">Klant</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e4e2e0;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#52504e;">Datum</th>
          <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #e4e2e0;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#52504e;">Bedrag incl.</th>
        </tr>
      </thead>
      <tbody>${rijenHtml}</tbody>
    </table>`;

  const html = emailLayout({
    heading: 'Facturen ter verwerking',
    preheader: `${rows.length} ${rows.length === 1 ? 'factuur' : 'facturen'} ter verwerking`,
    bodyHtml,
  });

  try {
    await sendEmail({ to: boekhouder, subject: 'Facturen ter verwerking — Frederiks Bedrijfskleding', html });
  } catch {
    return { ok: false, aantal: 0, error: 'Versturen mislukt.' };
  }

  const nu = new Date().toISOString();
  await sb.from('facturen').update({ gemaild_op: nu }).in('id', ids);
  await sb.from('factuur_mail_log').insert(ids.map((id) => ({ factuur_id: id, naar_email: boekhouder.trim() })));

  return { ok: true, aantal: ids.length };
}

/** Verzendlogboek van een factuur naar de boekhouder, nieuwste eerst. */
export async function getFactuurMailLog(factuurId: string): Promise<{ naar_email: string; verzonden_op: string }[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('factuur_mail_log')
    .select('naar_email, verzonden_op')
    .eq('factuur_id', factuurId)
    .order('verzonden_op', { ascending: false });
  return (data as { naar_email: string; verzonden_op: string }[]) ?? [];
}
