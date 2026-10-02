/**
 * Verzendmotor voor nieuwsbrieven, via Resend.
 *
 * Werkwijze (hervatbaar en binnen de tijdslimiet van een serverless functie):
 *  1. startVerzending() zet alle ontvangers van de doelgroep in de wachtrij
 *     (tabel nieuwsbrief_ontvangers, status 'wachtrij') en de brief op 'verzenden'.
 *  2. verwerkBatch() pakt telkens maximaal 50 adressen uit de wachtrij en
 *     verstuurt die in één Resend-batch. Het dashboard roept dit herhaald aan
 *     tot de wachtrij leeg is; de cron doet hetzelfde voor ingeplande brieven.
 *
 * Dubbel versturen voorkomen: een batch "claimt" zijn rijen eerst door in de
 * kolom `fout` een markering `bezig:<tijd>` te zetten, alleen op rijen die nog
 * geen markering hebben. Twee tegelijk lopende processen (twee tabbladen, of
 * cron en dashboard) pakken zo nooit dezelfde rij. Blijft een claim hangen
 * (functie gecrasht), dan wordt hij na 10 minuten weer vrijgegeven.
 *
 * Alleen server-side gebruiken.
 */
import crypto from 'crypto';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { env, isEmailConfigured } from '@/lib/env';
import { bedrijf } from '@/content/bedrijf';
import { afmeldUrl } from '@/lib/kms/campagne-engine';
import { ontvangersVoorDoelgroep } from '@/lib/kms/nieuwsbrief';
import { renderNieuwsbrief, renderOnderwerp, type Ontvanger } from './render';
import { STANDAARD_AFZENDER, getNieuwsbrief, siteUrl, webversieUrl, type Nieuwsbrief } from './opslag';

export const BATCH_GROOTTE = 50;
const CLAIM_PREFIX = 'bezig:';
const CLAIM_VERLOOPT_MS = 10 * 60 * 1000;

export const GEEN_MAIL_MELDING =
  'Versturen kan nog niet: de mailkoppeling (Resend) is niet ingesteld. Vraag Tim om de RESEND_API_KEY in te vullen. Er is niets verstuurd.';

export function nieuwsbriefMailKlaar(): boolean {
  return isEmailConfigured;
}

/** Het e-mailadres van de afzender: NIEUWSBRIEF_FROM_EMAIL, anders het adres uit RESEND_FROM_EMAIL. */
function afzenderAdres(): string {
  const eigen = (process.env.NIEUWSBRIEF_FROM_EMAIL ?? '').trim();
  const bron = eigen || env.resendFrom;
  const m = bron.match(/<([^>]+)>/);
  return (m ? m[1] : bron).trim();
}

function afzender(naam: string | null | undefined): string {
  const schoon = (naam || STANDAARD_AFZENDER).replace(/[<>"\r\n]/g, '').trim() || STANDAARD_AFZENDER;
  return `${schoon} <${afzenderAdres()}>`;
}

function lijstAfmeldHeaders(url: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${url}>, <mailto:${bedrijf.email}?subject=Afmelden%20nieuwsbrief>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

async function resendClient() {
  const { Resend } = await import('resend');
  return new Resend(env.resendApiKey);
}

/* ------------------------------------------------------------------ */
/* Testmail                                                            */
/* ------------------------------------------------------------------ */

export type Uitkomst = { ok: true; melding: string } | { ok: false; melding: string };

export async function verstuurTestmail(id: string, naar: string): Promise<Uitkomst> {
  const adres = naar.trim().toLowerCase();
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(adres)) return { ok: false, melding: 'Vul een geldig e-mailadres in.' };
  if (!isEmailConfigured) return { ok: false, melding: GEEN_MAIL_MELDING };
  const brief = await getNieuwsbrief(id);
  if (!brief) return { ok: false, melding: 'Deze nieuwsbrief bestaat niet meer.' };

  const ontvanger: Ontvanger = { email: adres, naam: null, bedrijf: null };
  const url = afmeldUrl(adres);
  const html = renderNieuwsbrief(brief.ontwerp, {
    onderwerp: brief.onderwerp || brief.naam,
    preheader: brief.preheader,
    modus: 'email',
    ontvanger,
    afmeldUrl: url,
    webUrl: webversieUrl(brief.web_token),
    siteUrl: siteUrl(),
  });
  try {
    const resend = await resendClient();
    const { error } = await resend.emails.send({
      from: afzender(brief.afzender_naam),
      to: adres,
      replyTo: bedrijf.email,
      subject: `[Test] ${renderOnderwerp(brief.onderwerp || brief.naam, ontvanger)}`,
      html,
      headers: lijstAfmeldHeaders(url),
    });
    if (error) return { ok: false, melding: `De testmail is niet verstuurd: ${error.message}` };
  } catch (err) {
    return { ok: false, melding: `De testmail is niet verstuurd: ${err instanceof Error ? err.message : 'onbekende fout'}` };
  }
  return { ok: true, melding: `Testmail verstuurd naar ${adres}.` };
}

/* ------------------------------------------------------------------ */
/* Wachtrij vullen                                                     */
/* ------------------------------------------------------------------ */

export type StartUitkomst = { ok: true; aantal: number } | { ok: false; melding: string };

/** Controleer of een brief klaar is om verstuurd te worden. */
export function controleerVerzendklaar(brief: Nieuwsbrief): string | null {
  if (brief.is_template) return 'Een template kun je niet versturen. Maak eerst een nieuwsbrief van deze template.';
  if (!brief.onderwerp?.trim()) return 'Vul eerst een onderwerp in.';
  if (brief.ontwerp.secties.length === 0) return 'De nieuwsbrief is nog leeg.';
  return null;
}

/**
 * Zet de ontvangers in de wachtrij en de brief op 'verzenden'. Adressen die al
 * in de wachtrij of verzonden staan worden niet opnieuw toegevoegd, dus
 * opnieuw starten na een onderbreking is veilig.
 */
export async function startVerzending(id: string): Promise<StartUitkomst> {
  // Let op: een brief op 'verzenden' mag opnieuw gestart worden (hervatten).
  const sb = kmsAdmin();
  if (!sb) return { ok: false, melding: 'De database is niet gekoppeld.' };
  if (!isEmailConfigured) return { ok: false, melding: GEEN_MAIL_MELDING };
  const brief = await getNieuwsbrief(id);
  if (!brief) return { ok: false, melding: 'Deze nieuwsbrief bestaat niet meer.' };
  if (brief.status === 'verzonden') return { ok: false, melding: 'Deze nieuwsbrief is al verzonden. Maak een kopie om hem opnieuw te gebruiken.' };
  const fout = controleerVerzendklaar(brief);
  if (fout) return { ok: false, melding: fout };

  const ontvangers = await ontvangersVoorDoelgroep(brief.doelgroep);

  const { data: bestaandData } = await sb.from('nieuwsbrief_ontvangers').select('email').eq('nieuwsbrief_id', id);
  const bestaand = new Set(((bestaandData as { email: string }[]) ?? []).map((r) => r.email.toLowerCase()));
  const nieuw = ontvangers.filter((o) => !bestaand.has(o.email.toLowerCase()));

  if (nieuw.length === 0 && bestaand.size === 0) {
    return { ok: false, melding: 'Er zijn geen ontvangers in deze doelgroep. Kies een andere doelgroep.' };
  }

  for (let i = 0; i < nieuw.length; i += 500) {
    const stuk = nieuw.slice(i, i + 500).map((o) => ({
      nieuwsbrief_id: id,
      email: o.email,
      naam: o.naam,
      ...(o.organisatie_id ? { organisatie_id: o.organisatie_id } : {}),
      status: 'wachtrij',
    }));
    const { error } = await sb.from('nieuwsbrief_ontvangers').insert(stuk);
    if (error) {
      // Mogelijk een dubbel adres in dit stuk (unieke index); dan per rij.
      for (const rij of stuk) await sb.from('nieuwsbrief_ontvangers').insert(rij);
    }
  }

  const totaal = await tel(id);
  await sb
    .from('nieuwsbrieven')
    .update({ status: 'verzenden', aantal_ontvangers: totaal.totaal, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { ok: true, aantal: totaal.totaal };
}

/* ------------------------------------------------------------------ */
/* Batch versturen                                                     */
/* ------------------------------------------------------------------ */

type Tellingen = { totaal: number; verzonden: number; fouten: number; wachtrij: number };

async function tel(id: string): Promise<Tellingen> {
  const sb = kmsAdmin();
  if (!sb) return { totaal: 0, verzonden: 0, fouten: 0, wachtrij: 0 };
  const telStatus = async (status?: string) => {
    let q = sb.from('nieuwsbrief_ontvangers').select('id', { count: 'exact', head: true }).eq('nieuwsbrief_id', id);
    if (status) q = q.eq('status', status);
    const { count } = await q;
    return count ?? 0;
  };
  const [totaal, verzonden, fouten, wachtrij] = await Promise.all([telStatus(), telStatus('verzonden'), telStatus('fout'), telStatus('wachtrij')]);
  return { totaal, verzonden, fouten, wachtrij };
}

export type BatchUitkomst = {
  verzonden: number;
  fouten: number;
  totaal: number;
  resterend: number;
  klaar: boolean;
  /** Gevuld als deze batch niet kon worden verstuurd. */
  melding?: string;
  /** True als het later opnieuw proberen zin heeft (bv. te veel tegelijk). */
  opnieuwProberen?: boolean;
};

type Claim = { id: string; email: string; naam: string | null; organisatie_id: string | null };

async function claimBatch(id: string): Promise<Claim[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  // Hangende claims (ouder dan 10 minuten) weer vrijgeven.
  const grens = new Date(Date.now() - CLAIM_VERLOOPT_MS).toISOString();
  await sb
    .from('nieuwsbrief_ontvangers')
    .update({ fout: null })
    .eq('nieuwsbrief_id', id)
    .eq('status', 'wachtrij')
    .like('fout', `${CLAIM_PREFIX}%`)
    .lt('fout', `${CLAIM_PREFIX}${grens}`);

  const { data: kandidaten } = await sb
    .from('nieuwsbrief_ontvangers')
    .select('id')
    .eq('nieuwsbrief_id', id)
    .eq('status', 'wachtrij')
    .is('fout', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_GROOTTE);
  const ids = ((kandidaten as { id: string }[]) ?? []).map((r) => r.id);
  if (ids.length === 0) return [];

  const { data } = await sb
    .from('nieuwsbrief_ontvangers')
    .update({ fout: `${CLAIM_PREFIX}${new Date().toISOString()}` })
    .in('id', ids)
    .eq('status', 'wachtrij')
    .is('fout', null)
    .select('id, email, naam, organisatie_id');
  return (data as Claim[]) ?? [];
}

async function bedrijfsnamen(ids: string[]): Promise<Map<string, string>> {
  const sb = kmsAdmin();
  const uniek = [...new Set(ids)];
  if (!sb || uniek.length === 0) return new Map();
  const { data } = await sb.from('organisaties').select('id, naam').in('id', uniek);
  return new Map(((data as { id: string; naam: string | null }[]) ?? []).map((o) => [o.id, o.naam ?? '']));
}

/** Werk de cijfers op de brief bij en rond af als de wachtrij leeg is. */
async function werkStandBij(id: string): Promise<Tellingen & { klaar: boolean }> {
  const sb = kmsAdmin();
  const t = await tel(id);
  const klaar = t.wachtrij === 0;
  if (sb) {
    const nu = new Date().toISOString();
    await sb
      .from('nieuwsbrieven')
      .update({
        aantal_ontvangers: t.totaal,
        aantal_verzonden: t.verzonden,
        aantal_fouten: t.fouten,
        updated_at: nu,
        ...(klaar ? { status: t.verzonden === 0 && t.fouten > 0 ? 'mislukt' : 'verzonden', verzonden_op: nu } : {}),
      })
      .eq('id', id)
      .eq('status', 'verzenden');
  }
  return { ...t, klaar };
}

/** Verstuur één batch (max 50) uit de wachtrij van deze brief. */
export async function verwerkBatch(id: string): Promise<BatchUitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { verzonden: 0, fouten: 0, totaal: 0, resterend: 0, klaar: false, melding: 'De database is niet gekoppeld.' };
  if (!isEmailConfigured) {
    const t = await tel(id);
    return { verzonden: t.verzonden, fouten: t.fouten, totaal: t.totaal, resterend: t.wachtrij, klaar: false, melding: GEEN_MAIL_MELDING };
  }

  const brief = await getNieuwsbrief(id);
  if (!brief) return { verzonden: 0, fouten: 0, totaal: 0, resterend: 0, klaar: false, melding: 'Deze nieuwsbrief bestaat niet meer.' };
  if (brief.status !== 'verzenden') {
    const t = await tel(id);
    return {
      verzonden: t.verzonden,
      fouten: t.fouten,
      totaal: t.totaal,
      resterend: t.wachtrij,
      klaar: brief.status === 'verzonden' || brief.status === 'mislukt',
      ...(brief.status === 'verzonden' || brief.status === 'mislukt' ? {} : { melding: 'Deze nieuwsbrief staat niet op versturen.' }),
    };
  }

  const claims = await claimBatch(id);
  if (claims.length === 0) {
    const stand = await werkStandBij(id);
    // Nog adressen in de wachtrij, maar allemaal al "geclaimd" door een ander proces
    // (ander tabblad, de cron, of een onderbroken poging die na 10 minuten vrijkomt).
    // Dan rustig opnieuw proberen in plaats van in een snelle lus te blijven vragen.
    return {
      verzonden: stand.verzonden,
      fouten: stand.fouten,
      totaal: stand.totaal,
      resterend: stand.wachtrij,
      klaar: stand.klaar,
      ...(stand.klaar
        ? {}
        : {
            opnieuwProberen: true,
            melding: 'Een deel van de adressen wordt op dit moment al verstuurd (bijvoorbeeld in een ander tabblad). Even geduld, er wordt zo opnieuw gekeken.',
          }),
    };
  }

  const namen = await bedrijfsnamen(claims.map((c) => c.organisatie_id).filter((x): x is string => !!x));
  const web = webversieUrl(brief.web_token);
  const basis = siteUrl();
  const van = afzender(brief.afzender_naam);

  const berichten = claims.map((c) => {
    const ontvanger: Ontvanger = { email: c.email, naam: c.naam, bedrijf: c.organisatie_id ? namen.get(c.organisatie_id) ?? null : null };
    const url = afmeldUrl(c.email);
    return {
      from: van,
      to: c.email,
      replyTo: bedrijf.email,
      subject: renderOnderwerp(brief.onderwerp || brief.naam, ontvanger),
      html: renderNieuwsbrief(brief.ontwerp, {
        onderwerp: brief.onderwerp || brief.naam,
        preheader: brief.preheader,
        modus: 'email',
        ontvanger,
        afmeldUrl: url,
        webUrl: web,
        siteUrl: basis,
      }),
      headers: lijstAfmeldHeaders(url),
    };
  });

  const sleutel = `nieuwsbrief-${id}-${crypto
    .createHash('sha256')
    .update(claims.map((c) => c.id).sort().join(','))
    .digest('hex')
    .slice(0, 32)}`;

  const nu = new Date().toISOString();
  try {
    const resend = await resendClient();
    const { data, error } = await resend.batch.send(berichten, { batchValidation: 'permissive', idempotencyKey: sleutel });

    if (error || !data) {
      const code = error?.statusCode ?? null;
      const tijdelijk = code === null || code === 429 || code >= 500;
      if (tijdelijk) {
        // Claims vrijgeven: deze adressen komen bij de volgende poging weer aan de beurt.
        await sb.from('nieuwsbrief_ontvangers').update({ fout: null }).in('id', claims.map((c) => c.id));
        const t = await tel(id);
        return {
          verzonden: t.verzonden,
          fouten: t.fouten,
          totaal: t.totaal,
          resterend: t.wachtrij,
          klaar: false,
          opnieuwProberen: true,
          melding: `Even te druk bij de mailserver (${error?.message ?? 'geen antwoord'}). Er wordt zo opnieuw geprobeerd.`,
        };
      }
      await sb
        .from('nieuwsbrief_ontvangers')
        .update({ status: 'fout', fout: (error?.message ?? 'Onbekende fout').slice(0, 500) })
        .in('id', claims.map((c) => c.id));
    } else {
      const fouten = new Map<number, string>();
      const uitgebreid = data as { data: { id: string }[]; errors?: { index: number; message: string }[] };
      for (const f of uitgebreid.errors ?? []) fouten.set(f.index, f.message);
      const ids = uitgebreid.data ?? [];
      let volgende = 0;
      const gelukt: { id: string; resend_id: string | null }[] = [];
      const mislukt: { id: string; fout: string }[] = [];
      claims.forEach((c, i) => {
        if (fouten.has(i)) mislukt.push({ id: c.id, fout: fouten.get(i) ?? 'Onbekende fout' });
        else gelukt.push({ id: c.id, resend_id: ids[volgende++]?.id ?? null });
      });
      // Per rij bijwerken: elke rij heeft een eigen resend_id.
      await Promise.all(
        gelukt.map((g) =>
          sb
            .from('nieuwsbrief_ontvangers')
            .update({ status: 'verzonden', fout: null, verzonden_op: nu, ...(g.resend_id ? { resend_id: g.resend_id } : {}) })
            .eq('id', g.id),
        ),
      );
      await Promise.all(
        mislukt.map((m) => sb.from('nieuwsbrief_ontvangers').update({ status: 'fout', fout: m.fout.slice(0, 500) }).eq('id', m.id)),
      );
    }
  } catch (err) {
    await sb.from('nieuwsbrief_ontvangers').update({ fout: null }).in('id', claims.map((c) => c.id));
    const t = await tel(id);
    return {
      verzonden: t.verzonden,
      fouten: t.fouten,
      totaal: t.totaal,
      resterend: t.wachtrij,
      klaar: false,
      opnieuwProberen: true,
      melding: `Versturen is onderbroken (${err instanceof Error ? err.message : 'onbekende fout'}). Er wordt zo opnieuw geprobeerd.`,
    };
  }

  const stand = await werkStandBij(id);
  return { verzonden: stand.verzonden, fouten: stand.fouten, totaal: stand.totaal, resterend: stand.wachtrij, klaar: stand.klaar };
}

/* ------------------------------------------------------------------ */
/* Cron: ingeplande brieven                                            */
/* ------------------------------------------------------------------ */

const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Verwerkt ingeplande en onderbroken verzendingen tot `tijdMs` op is.
 * - status 'gepland' met gepland_op in het verleden: wachtrij vullen en starten;
 * - status 'verzenden' die al 10 minuten niet is bijgewerkt: hervatten (een
 *   verzending die nu vanuit het dashboard loopt laten we met rust).
 */
export async function verwerkGeplandeNieuwsbrieven(tijdMs = 50_000): Promise<{ gestart: number; verzonden: number; fouten: number; klaar: string[]; melding?: string }> {
  const sb = kmsAdmin();
  const resultaat = { gestart: 0, verzonden: 0, fouten: 0, klaar: [] as string[] };
  if (!sb) return { ...resultaat, melding: 'Database niet gekoppeld.' };
  if (!isEmailConfigured) return { ...resultaat, melding: 'Resend niet geconfigureerd; niets verstuurd.' };
  const eind = Date.now() + tijdMs;
  const nu = new Date().toISOString();

  const { data: gepland } = await sb
    .from('nieuwsbrieven')
    .select('id')
    .eq('status', 'gepland')
    .eq('is_template', false)
    .lte('gepland_op', nu)
    .order('gepland_op', { ascending: true });
  for (const r of (gepland as { id: string }[]) ?? []) {
    const start = await startVerzending(r.id);
    if (start.ok) resultaat.gestart++;
    else await sb.from('nieuwsbrieven').update({ status: 'mislukt', updated_at: nu }).eq('id', r.id).eq('status', 'gepland');
  }

  const stilGrens = new Date(Date.now() - CLAIM_VERLOOPT_MS).toISOString();
  const { data: lopend } = await sb.from('nieuwsbrieven').select('id, updated_at').eq('status', 'verzenden').eq('is_template', false);
  const teDoen = ((lopend as { id: string; updated_at: string }[]) ?? []).filter(
    (r) => r.updated_at < stilGrens || ((gepland as { id: string }[]) ?? []).some((g) => g.id === r.id),
  );

  for (const r of teDoen) {
    let laatste: BatchUitkomst | null = null;
    while (Date.now() < eind) {
      laatste = await verwerkBatch(r.id);
      if (laatste.klaar) {
        resultaat.klaar.push(r.id);
        break;
      }
      if (laatste.melding && !laatste.opnieuwProberen) break;
      await wacht(laatste.opnieuwProberen ? 2000 : 600);
    }
    // De tellingen per brief zijn cumulatief; de eindstand per brief optellen.
    if (laatste) {
      resultaat.verzonden += laatste.verzonden;
      resultaat.fouten += laatste.fouten;
    }
    if (Date.now() >= eind) break;
  }
  return resultaat;
}

/** Zet de mislukte adressen van een brief terug in de wachtrij en hervat. */
export async function probeerFoutenOpnieuw(id: string): Promise<StartUitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, melding: 'De database is niet gekoppeld.' };
  if (!isEmailConfigured) return { ok: false, melding: GEEN_MAIL_MELDING };
  const { data } = await sb
    .from('nieuwsbrief_ontvangers')
    .update({ status: 'wachtrij', fout: null })
    .eq('nieuwsbrief_id', id)
    .eq('status', 'fout')
    .select('id');
  const aantal = ((data as { id: string }[]) ?? []).length;
  if (aantal === 0) return { ok: false, melding: 'Er zijn geen mislukte adressen om opnieuw te proberen.' };
  await sb.from('nieuwsbrieven').update({ status: 'verzenden', updated_at: new Date().toISOString() }).eq('id', id);
  return { ok: true, aantal };
}
