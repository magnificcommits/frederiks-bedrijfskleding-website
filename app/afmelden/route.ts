import { kmsAdmin } from '@/lib/kms/adminClient';
import { afmeldToken } from '@/lib/kms/campagne-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pagina(boodschap: string): Response {
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Afmelden</title></head><body style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:80px auto;padding:0 20px;color:#1c1c1c;line-height:1.6;"><p style="font-size:13px;font-weight:700;letter-spacing:0.04em;color:#ec6726;text-transform:uppercase;">Frederiks Bedrijfskleding</p><p style="font-size:16px;">${boodschap}</p></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/** Eenmalige, eenvoudige afmeldlink uit de campagnemails. Voegt het adres toe aan de suppressielijst. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get('e') ?? '').trim().toLowerCase();
  const token = url.searchParams.get('t') ?? '';
  if (!email || token !== afmeldToken(email)) {
    return pagina('Deze afmeldlink is niet geldig. Mail ons gerust rechtstreeks, dan halen we je er handmatig uit.');
  }
  const sb = kmsAdmin();
  if (sb) {
    await sb.from('afmeldingen').upsert({ email, reden: 'afmeldlink' }, { onConflict: 'email' });
    const { data } = await sb.from('prospecten').select('id').ilike('email', email);
    const ids = ((data as { id: string }[]) ?? []).map((r) => r.id);
    await sb.from('prospecten').update({ status: 'afgemeld' }).ilike('email', email);
    if (ids.length) {
      await sb.from('campagne_inschrijvingen').update({ status: 'afgemeld', volgende_verzending: null }).in('prospect_id', ids);
    }
  }
  return pagina('Je bent afgemeld. Je ontvangt geen verdere berichten meer van ons. Excuses voor het ongemak.');
}
