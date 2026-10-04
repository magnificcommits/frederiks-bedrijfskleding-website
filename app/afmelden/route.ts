import { kmsAdmin, veiligGelijk } from '@/lib/kms/adminClient';
import { afmeldToken } from '@/lib/kms/campagne-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pagina(boodschap: string): Response {
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Afmelden</title></head><body style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:80px auto;padding:0 20px;color:#1c1c1c;line-height:1.6;"><p style="font-size:13px;font-weight:700;letter-spacing:0.04em;color:#ec6726;text-transform:uppercase;">Frederiks Bedrijfskleding</p><p style="font-size:16px;">${boodschap}</p></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/**
 * Legt een afmelding overal vast:
 *  - suppressielijst `afmeldingen` (campagnes en nieuwsbrief kijken hier allebei naar);
 *  - prospecten en hun campagne-inschrijvingen op afgemeld;
 *  - `nieuwsbrief_inschrijvingen.afgemeld = true`, zodat het adres in het
 *    nieuwsbriefoverzicht ook als "niet mailen" zichtbaar is. Bestaat er nog
 *    geen inschrijving (een klantadres), dan wordt er een aangemaakt.
 */
async function meldAf(email: string): Promise<void> {
  const sb = kmsAdmin();
  if (!sb) return;
  await sb.from('afmeldingen').upsert({ email, reden: 'afmeldlink' }, { onConflict: 'email' });
  const { data } = await sb.from('prospecten').select('id').ilike('email', email);
  const ids = ((data as { id: string }[]) ?? []).map((r) => r.id);
  await sb.from('prospecten').update({ status: 'afgemeld' }).ilike('email', email);
  if (ids.length) {
    await sb.from('campagne_inschrijvingen').update({ status: 'afgemeld', volgende_verzending: null }).in('prospect_id', ids);
  }

  // Nieuwsbrief. ilike vindt ook oudere rijen met hoofdletters; % en _ worden
  // ge-escaped zodat ze geen jokerteken zijn. Daarna nog exact controleren in JS.
  const patroon = email.replace(/[\\%_]/g, (t) => `\\${t}`);
  const { data: inschrijvingen } = await sb.from('nieuwsbrief_inschrijvingen').select('id, email').ilike('email', patroon);
  const treffers = ((inschrijvingen as { id: string; email: string | null }[]) ?? []).filter(
    (r) => (r.email ?? '').trim().toLowerCase() === email,
  );
  if (treffers.length > 0) {
    await sb
      .from('nieuwsbrief_inschrijvingen')
      .update({ afgemeld: true })
      .in(
        'id',
        treffers.map((r) => r.id),
      );
  } else {
    await sb.from('nieuwsbrief_inschrijvingen').insert({ email, bron: 'afmeldlink', afgemeld: true });
  }
}

function leesParams(req: Request): { email: string; geldig: boolean } {
  const url = new URL(req.url);
  const email = (url.searchParams.get('e') ?? '').trim().toLowerCase();
  const token = url.searchParams.get('t') ?? '';
  return { email, geldig: Boolean(email) && veiligGelijk(token, afmeldToken(email)) };
}

/** Afmeldlink uit campagnemails en nieuwsbrieven. */
export async function GET(req: Request) {
  const { email, geldig } = leesParams(req);
  if (!geldig) {
    return pagina('Deze afmeldlink is niet geldig. Mail ons gerust rechtstreeks, dan halen we je er handmatig uit.');
  }
  await meldAf(email);
  return pagina('Je bent afgemeld. Je ontvangt geen verdere berichten meer van ons. Excuses voor het ongemak.');
}

/**
 * Afmelden met één klik vanuit Gmail, Outlook en Apple Mail (RFC 8058,
 * header List-Unsubscribe-Post). Het mailprogramma doet dan een POST op
 * dezelfde url, zonder dat de ontvanger een pagina ziet.
 */
export async function POST(req: Request) {
  const { email, geldig } = leesParams(req);
  if (!geldig) return new Response('Ongeldige afmeldlink', { status: 400 });
  await meldAf(email);
  return new Response('Afgemeld', { status: 200 });
}
