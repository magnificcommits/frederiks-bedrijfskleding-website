/**
 * Dunne client voor de Moneybird API v2 (https://developer.moneybird.com).
 *
 * Het token en de administratie-ID komen uit de omgevingsvariabelen
 * MONEYBIRD_API_TOKEN en MONEYBIRD_ADMINISTRATIE_ID en blijven op de server.
 * Ze gaan nooit naar de browser en komen niet in de database of het logboek.
 *
 * Elke aanroep geeft { ok: true, data } of { ok: false, melding, status } terug,
 * met een melding in gewone taal die Jessi zonder uitleg begrijpt.
 */

const BASIS = 'https://moneybird.com/api/v2';

export function moneybirdToken(): string {
  return (process.env.MONEYBIRD_API_TOKEN ?? '').trim();
}

export function moneybirdAdministratieId(): string {
  return (process.env.MONEYBIRD_ADMINISTRATIE_ID ?? '').trim();
}

/** Staan token en administratie-ID allebei in de omgevingsvariabelen? */
export function isMoneybirdGeconfigureerd(): boolean {
  return Boolean(moneybirdToken() && moneybirdAdministratieId());
}

/** Link naar een verkoopfactuur in Moneybird, voor de knop "Openen in Moneybird". */
export function moneybirdFactuurUrl(factuurId: string): string {
  return `https://moneybird.com/${encodeURIComponent(moneybirdAdministratieId())}/sales_invoices/${encodeURIComponent(factuurId)}`;
}

export type MbResultaat<T> = { ok: true; data: T } | { ok: false; status: number; melding: string };

/** Haalt een leesbare foutomschrijving uit het antwoord van Moneybird (zonder het token). */
function foutUitBody(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const b = body as Record<string, unknown>;
  const fout = b.error ?? b.errors ?? b.message;
  if (typeof fout === 'string') return fout;
  if (fout && typeof fout === 'object') {
    return Object.entries(fout as Record<string, unknown>)
      .map(([veld, v]) => `${veld}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      .join('; ');
  }
  return '';
}

function meldingVoorStatus(status: number, detail: string): string {
  const extra = detail ? ` (Moneybird zegt: ${detail.slice(0, 300)})` : '';
  switch (status) {
    case 401:
      return 'Moneybird accepteert het token niet. Maak een nieuw token aan en zet het in Vercel (zie docs/boekhouding-koppelen.md).';
    case 403:
      return `Het token mag dit niet doen. Geef het token rechten voor Verkoop, Contacten en Instellingen.${extra}`;
    case 404:
      return `Niet gevonden in Moneybird. Klopt de administratie-ID, of is het onderdeel daar verwijderd?${extra}`;
    case 422:
      return `Moneybird weigert de gegevens.${extra || ' Controleer klant en factuurregels.'}`;
    case 429:
      return 'Moneybird krijgt even te veel verzoeken (maximaal 150 per 5 minuten). Probeer het over een paar minuten opnieuw.';
    case 0:
      return `Moneybird is niet bereikbaar. Controleer de internetverbinding of probeer het later opnieuw.${extra}`;
    default:
      if (status >= 500) return `Moneybird heeft een storing (fout ${status}). Probeer het later opnieuw.`;
      return `Onverwachte fout ${status} van Moneybird.${extra}`;
  }
}

/**
 * Doet één verzoek. `pad` zonder administratie (bv. 'contacts.json'); met
 * `zonderAdministratie` gaat het verzoek naar /api/v2/<pad> (voor administrations.json).
 */
export async function mbVerzoek<T>(
  methode: 'GET' | 'POST' | 'PATCH',
  pad: string,
  opties: { body?: unknown; zonderAdministratie?: boolean; query?: Record<string, string> } = {},
): Promise<MbResultaat<T>> {
  const token = moneybirdToken();
  const admin = moneybirdAdministratieId();
  if (!token) return { ok: false, status: 0, melding: 'De koppeling met Moneybird staat nog niet aan: MONEYBIRD_API_TOKEN ontbreekt.' };
  if (!opties.zonderAdministratie && !admin) {
    return { ok: false, status: 0, melding: 'De koppeling met Moneybird staat nog niet aan: MONEYBIRD_ADMINISTRATIE_ID ontbreekt.' };
  }
  const url = new URL(opties.zonderAdministratie ? `${BASIS}/${pad}` : `${BASIS}/${encodeURIComponent(admin)}/${pad}`);
  for (const [k, v] of Object.entries(opties.query ?? {})) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, {
      method: methode,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(opties.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opties.body !== undefined ? JSON.stringify(opties.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    const naam = e instanceof Error ? e.name : '';
    return { ok: false, status: 0, melding: meldingVoorStatus(0, naam === 'TimeoutError' ? 'geen antwoord binnen 20 seconden' : '') };
  }

  const tekst = await res.text();
  let body: unknown = null;
  if (tekst) {
    try {
      body = JSON.parse(tekst);
    } catch {
      body = null;
    }
  }
  if (!res.ok) return { ok: false, status: res.status, melding: meldingVoorStatus(res.status, foutUitBody(body)) };
  return { ok: true, data: body as T };
}

// ---------------------------------------------------------------------------
// Typen (alleen de velden die we gebruiken)
// ---------------------------------------------------------------------------

export type MbAdministratie = { id: string; name: string; currency?: string; country?: string };
export type MbBtwTarief = { id: string; name: string; percentage: string; tax_rate_type: string; active: boolean; show_tax?: boolean };
export type MbGrootboek = { id: string; name: string; account_type: string; account_id: string | null };
export type MbContact = {
  id: string;
  company_name: string | null;
  firstname?: string | null;
  lastname?: string | null;
  email: string | null;
  send_invoices_to_email: string | null;
  chamber_of_commerce: string | null;
  tax_number: string | null;
  customer_id: string | null;
};
export type MbVerkoopfactuur = {
  id: string;
  invoice_id: string | null;
  reference: string | null;
  state: string;
  paid_at: string | null;
  total_price_incl_tax: string | null;
  contact_id: string;
};

// ---------------------------------------------------------------------------
// Aanroepen
// ---------------------------------------------------------------------------

export async function mbAdministraties(): Promise<MbResultaat<MbAdministratie[]>> {
  return mbVerzoek<MbAdministratie[]>('GET', 'administrations.json', { zonderAdministratie: true });
}

/** Actieve btw-tarieven voor verkoopfacturen. */
export async function mbBtwTarieven(): Promise<MbResultaat<MbBtwTarief[]>> {
  const r = await mbVerzoek<MbBtwTarief[]>('GET', 'tax_rates.json', { query: { filter: 'tax_rate_type:sales_invoice' } });
  if (!r.ok) return r;
  return { ok: true, data: (r.data ?? []).filter((t) => t.active !== false) };
}

/** Omzetrekeningen (account_type 'revenue'), voor de keuze van het standaard grootboek. */
export async function mbOmzetGrootboeken(): Promise<MbResultaat<MbGrootboek[]>> {
  const r = await mbVerzoek<MbGrootboek[]>('GET', 'ledger_accounts.json');
  if (!r.ok) return r;
  return { ok: true, data: (r.data ?? []).filter((g) => g.account_type === 'revenue') };
}

export async function mbContact(id: string): Promise<MbResultaat<MbContact>> {
  return mbVerzoek<MbContact>('GET', `contacts/${encodeURIComponent(id)}.json`);
}

export async function mbZoekContacten(zoekterm: string): Promise<MbResultaat<MbContact[]>> {
  return mbVerzoek<MbContact[]>('GET', 'contacts.json', { query: { query: zoekterm, per_page: '50' } });
}

export async function mbMaakContact(contact: Record<string, unknown>): Promise<MbResultaat<MbContact>> {
  return mbVerzoek<MbContact>('POST', 'contacts.json', { body: { contact } });
}

export async function mbMaakVerkoopfactuur(factuur: Record<string, unknown>): Promise<MbResultaat<MbVerkoopfactuur>> {
  return mbVerzoek<MbVerkoopfactuur>('POST', 'sales_invoices.json', { body: { sales_invoice: factuur } });
}

/**
 * Maakt een conceptfactuur definitief. 'Manual' = definitief zonder dat Moneybird
 * iets mailt; 'Email' = Moneybird mailt de factuur naar het contact.
 */
export async function mbVerstuurVerkoopfactuur(id: string, manier: 'Manual' | 'Email'): Promise<MbResultaat<MbVerkoopfactuur>> {
  return mbVerzoek<MbVerkoopfactuur>('PATCH', `sales_invoices/${encodeURIComponent(id)}/send_invoice.json`, {
    body: { sales_invoice_sending: { delivery_method: manier, sending_scheduled: false } },
  });
}

export async function mbVerkoopfactuur(id: string): Promise<MbResultaat<MbVerkoopfactuur>> {
  return mbVerzoek<MbVerkoopfactuur>('GET', `sales_invoices/${encodeURIComponent(id)}.json`);
}

/** Moneybird-state in gewone taal. */
export const MB_STATUS_LABEL: Record<string, string> = {
  draft: 'Concept',
  scheduled: 'Ingepland',
  open: 'Openstaand',
  pending_payment: 'Wacht op betaling',
  late: 'Te laat',
  reminded: 'Herinnering verstuurd',
  paid: 'Betaald',
  uncollectible: 'Oninbaar',
};
